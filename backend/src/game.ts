import type {
  DeckItem,
  GameStats,
  LeaderboardEntry,
  Player,
  Room,
  RoundResult,
  RoundResultPayload,
  RoundTwist,
  ExtraKind,
} from "./types.js";

/** Pure game rules. No I/O, no timers: easy to unit-test. */

/**
 * Score for a correct answer: 500 for knowing the answer, plus up to 500 more
 * for speed, decreasing linearly over the round. Speed still matters, but a
 * correct answer is always worth at least half, so network lag barely matters.
 */
export function calculateScore(timeTakenMs: number, roundDurationMs: number): number {
  if (!Number.isFinite(timeTakenMs) || timeTakenMs < 0 || roundDurationMs <= 0) return 0;
  const remaining = Math.max(0, 1 - timeTakenMs / roundDurationMs);
  return Math.round(500 + 500 * remaining);
}

/** +10% per consecutive correct answer after the first, capped at +50%. */
export function streakMultiplier(streak: number): number {
  return 1 + Math.min(0.5, Math.max(0, streak - 1) * 0.1);
}

/**
 * Time Machine bonus for guessing the year the media was taken: full points for
 * the exact year, fewer the further off. Independent of answer speed.
 */
export function yearBonus(guess: number | undefined, actual: number | undefined): number {
  if (guess === undefined || actual === undefined) return 0;
  const off = Math.abs(guess - actual);
  return [300, 200, 100, 50][off] ?? 0;
}

/** Every few rounds a photo is revealed slowly (it starts blurred and sharpens). */
export const SLOW_REVEAL_EVERY = 4;

/** In Slow Reveal mode every photo is a slow reveal; otherwise every fourth one. */
export function twistFor(round: number, mediaType: "photo" | "video", slowRevealMode = false): RoundTwist | null {
  if (mediaType !== "photo" || round <= 0) return null;
  return slowRevealMode || round % SLOW_REVEAL_EVERY === 0 ? "slowReveal" : null;
}

/** Party extras run after every third round, alternating when both are on. */
export const EXTRA_EVERY = 3;
export const CAPTION_VOTE_POINTS = 100;
export const STORY_APPLAUSE_POINTS = 50;

export function extraFor(round: number, settings: { captionThis: boolean; storyTime: boolean }): ExtraKind | null {
  if (round <= 0 || round % EXTRA_EVERY !== 0) return null;
  const kinds: ExtraKind[] = [];
  if (settings.captionThis) kinds.push("caption");
  if (settings.storyTime) kinds.push("story");
  if (kinds.length === 0) return null;
  return kinds[(round / EXTRA_EVERY - 1) % kinds.length];
}

/** Upper bounds on what a client may subtract from its answer time. */
export const MAX_LATENCY_CREDIT_MS = 500;
export const MAX_DISPLAY_DELAY_CREDIT_MS = 1500;
/** Extra time the server waits after the round duration before closing it. */
export const ROUND_GRACE_MS = MAX_LATENCY_CREDIT_MS + MAX_DISPLAY_DELAY_CREDIT_MS;

/**
 * Answer time measured by the server, independent of the phone's clock:
 * time since the round was sent, minus the player's network delay and the time
 * their phone needed to display the media (both measured, both capped).
 */
export function answerTime(
  serverElapsedMs: number,
  latencyMs: number,
  displayDelayMs: number | undefined
): number {
  const latency = clamp(latencyMs, 0, MAX_LATENCY_CREDIT_MS);
  const display = clamp(displayDelayMs ?? 0, 0, MAX_DISPLAY_DELAY_CREDIT_MS);
  return Math.max(0, Math.round(serverElapsedMs - latency - display));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Builds the game deck. Each owner's media is shuffled, then owners are drawn
 * round-robin in a random order every cycle, so the same player rarely appears
 * several rounds in a row.
 */
export function buildDeck(players: Player[], random: () => number = Math.random): DeckItem[] {
  const queues = players
    .map((p) => shuffle(p.mediaPool.map((m) => ({ ...m, ownerId: p.id })), random))
    .filter((q) => q.length > 0);

  const ordered: Omit<DeckItem, "index">[] = [];
  while (queues.some((q) => q.length > 0)) {
    const cycle = shuffle(queues.filter((q) => q.length > 0), random);
    for (const queue of cycle) {
      const item = queue.shift();
      if (item) ordered.push(item);
    }
  }
  return ordered.map((item, index) => ({ ...item, index }));
}

export function leaderboard(room: Room): LeaderboardEntry[] {
  return room.players.map((p) => {
    const round = room.roundScores.get(p.id);
    return {
      playerId: p.id,
      playerName: p.name,
      totalScore: p.score,
      roundScore: round?.roundScore ?? 0,
      timeTaken: round?.timeTaken ?? null,
    };
  });
}

/** Scores the current round and records it in the history. */
export function scoreRound(room: Room): RoundResultPayload {
  const media = room.currentMedia!;
  const actualOwnerId = media.ownerId;
  const actualYear = room.settings.timeMachine ? (media.year ?? null) : null;

  const results: RoundResult[] = room.players.map((player) => {
    const guess = room.guesses.get(player.id);
    const guessedPlayerId = guess?.guessedPlayerId ?? null;
    const yearGuess = actualYear !== null ? (guess?.year ?? null) : null;
    const bonus = actualYear !== null ? yearBonus(guess?.year, actualYear) : 0;

    const isCorrect = guessedPlayerId !== null && guessedPlayerId === actualOwnerId;
    const streak = isCorrect ? (room.streaks.get(player.id) ?? 0) + 1 : 0;
    const speedScore = isCorrect
      ? Math.round(calculateScore(guess!.timeTaken, room.settings.timer * 1000) * streakMultiplier(streak))
      : 0;
    const roundScore = speedScore + bonus;
    const timeTaken = guessedPlayerId !== null ? guess!.timeTaken : null;

    room.streaks.set(player.id, streak);
    player.score += roundScore;
    room.roundScores.set(player.id, { roundScore, timeTaken });

    return {
      playerId: player.id,
      playerName: player.name,
      guessedPlayerId,
      isCorrect,
      roundScore,
      timeTaken,
      totalScore: player.score,
      tooSlow: guessedPlayerId === null,
      streak,
      yearGuess,
      yearBonus: bonus,
    };
  });

  room.roundHistory.push({
    round: room.currentRound,
    actualOwnerId,
    results: results.map(({ playerId, playerName, isCorrect, timeTaken, streak, guessedPlayerId }) => ({
      playerId,
      playerName,
      isCorrect,
      timeTaken,
      streak,
      guessed: guessedPlayerId !== null,
    })),
  });

  return { actualOwnerId, actualYear, results, leaderboard: leaderboard(room) };
}

export function calculateGameStats(room: Room): GameStats {
  const stats: GameStats = {
    longestStreak: { playerName: null, streak: 0 },
    fastestAnswer: { playerName: null, time: null, round: null },
    averageTime: null,
    worstPlayer: { playerName: null, score: Infinity },
    hardestRound: { round: null, correctCount: Infinity },
    masterOfDisguise: { playerName: null, fooled: 0 },
  };
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? null;

  // Longest streak reached at any point in the game
  const running = new Map<string, number>();
  for (const round of room.roundHistory) {
    for (const r of round.results) {
      const streak = r.isCorrect ? (running.get(r.playerId) ?? 0) + 1 : 0;
      running.set(r.playerId, streak);
      if (streak > stats.longestStreak.streak) {
        stats.longestStreak = { playerName: r.playerName, streak };
      }
    }
  }

  const correctTimes: number[] = [];
  for (const round of room.roundHistory) {
    for (const r of round.results) {
      if (!r.isCorrect || r.timeTaken == null) continue;
      correctTimes.push(r.timeTaken);
      if (stats.fastestAnswer.time === null || r.timeTaken < stats.fastestAnswer.time) {
        stats.fastestAnswer = { playerName: nameOf(r.playerId) ?? r.playerName, time: r.timeTaken, round: round.round };
      }
    }
  }
  if (correctTimes.length > 0) {
    stats.averageTime = Math.round(correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length);
  }

  const worst = [...room.players].sort((a, b) => a.score - b.score)[0];
  if (worst) {
    const correctAnswers = room.roundHistory.filter((round) =>
      round.results.some((r) => r.playerId === worst.id && r.isCorrect)
    ).length;
    stats.worstPlayer = {
      playerName: worst.name,
      score: worst.score,
      correctAnswers,
      totalRounds: room.roundHistory.length,
    };
  }

  // Whose media fooled the most people (wrong guesses by others).
  const fooled = new Map<string, number>();
  for (const round of room.roundHistory) {
    const wrong = round.results.filter((r) => r.playerId !== round.actualOwnerId && r.guessed && !r.isCorrect).length;
    fooled.set(round.actualOwnerId, (fooled.get(round.actualOwnerId) ?? 0) + wrong);
  }
  for (const [ownerId, count] of fooled) {
    const name = nameOf(ownerId);
    if (name && count > stats.masterOfDisguise.fooled) stats.masterOfDisguise = { playerName: name, fooled: count };
  }

  for (const round of room.roundHistory) {
    const correct = round.results.filter((r) => r.isCorrect).length;
    if (correct < stats.hardestRound.correctCount) {
      stats.hardestRound = { round: round.round, correctCount: correct };
    }
  }
  return stats;
}
