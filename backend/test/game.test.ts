import { describe, expect, it } from "vitest";
import {
  streakMultiplier,
  answerTime,
  buildDeck,
  calculateGameStats,
  calculateScore,
  MAX_DISPLAY_DELAY_CREDIT_MS,
  MAX_LATENCY_CREDIT_MS,
  scoreRound,
  twistFor,
  yearBonus,
} from "../src/game.js";
import { RoomRegistry } from "../src/rooms.js";
import { TokenBucket } from "../src/rateLimit.js";
import type { Player, Room } from "../src/types.js";

function makeRoom(playerCount: number, mediaPerPlayer: number): Room {
  const registry = new RoomRegistry();
  const { room } = registry.createRoom("s0", "P0", {});
  for (let i = 1; i < playerCount; i++) registry.joinRoom(room.pin, `s${i}`, `P${i}`);
  room.players.forEach((p: Player) => {
    p.mediaPool = Array.from({ length: mediaPerPlayer }, (_, k) => ({
      id: `${p.id}-${k}`,
      filename: `${p.id}-${k}.jpg`,
      mediaType: "photo" as const,
    }));
  });
  return room;
}

describe("calculateScore", () => {
  it("gives 500 for knowing the answer plus up to 500 for speed", () => {
    expect(calculateScore(0, 10_000)).toBe(1000);
    expect(calculateScore(5000, 10_000)).toBe(750);
    expect(calculateScore(10_000, 10_000)).toBe(500);
    expect(calculateScore(12_000, 10_000)).toBe(500);
    expect(calculateScore(-5, 10_000)).toBe(0);
  });

  it("keeps lag from mattering much: 200 ms costs 2% at most", () => {
    expect(calculateScore(1000, 5000) - calculateScore(1200, 5000)).toBeLessThanOrEqual(20);
  });
});

describe("streakMultiplier", () => {
  it("adds 10% per consecutive correct answer, capped at 50%", () => {
    expect([1, 2, 3, 6, 10].map(streakMultiplier)).toEqual([1, 1.1, 1.2, 1.5, 1.5]);
  });
});

describe("yearBonus", () => {
  it("rewards the exact year most, and nothing beyond 3 years off", () => {
    expect([2020, 2021, 2018, 2023, 2024].map((g) => yearBonus(g, 2020))).toEqual([300, 200, 100, 50, 0]);
    expect(yearBonus(undefined, 2020)).toBe(0);
  });
});

describe("twistFor", () => {
  it("slow-reveals every fourth round, photos only", () => {
    expect([1, 2, 3, 4, 8].map((r) => twistFor(r, "photo"))).toEqual([null, null, null, "slowReveal", "slowReveal"]);
    expect(twistFor(4, "video")).toBeNull();
  });
});

describe("answerTime", () => {
  it("is measured by the server and ignores the phone's clock", () => {
    expect(answerTime(2000, 100, 300)).toBe(1600);
  });

  it("caps the latency and display delay a client can claim", () => {
    expect(answerTime(5000, 10_000, 10_000)).toBe(5000 - MAX_LATENCY_CREDIT_MS - MAX_DISPLAY_DELAY_CREDIT_MS);
    expect(answerTime(100, 500, 1500)).toBe(0);
  });
});

describe("buildDeck", () => {
  it("contains every media exactly once with sequential indexes", () => {
    const room = makeRoom(3, 4);
    const deck = buildDeck(room.players);
    expect(deck).toHaveLength(12);
    expect(new Set(deck.map((d) => d.filename)).size).toBe(12);
    expect(deck.map((d) => d.index)).toEqual([...Array(12).keys()]);
  });

  it("never shows the same owner twice within a cycle", () => {
    const room = makeRoom(3, 4);
    const deck = buildDeck(room.players);
    for (let cycle = 0; cycle < 4; cycle++) {
      const owners = deck.slice(cycle * 3, cycle * 3 + 3).map((d) => d.ownerId);
      expect(new Set(owners).size).toBe(3);
    }
  });
});

describe("scoreRound", () => {
  it("scores correct guesses, including the owner guessing their own media", () => {
    const room = makeRoom(2, 1);
    const [a, b] = room.players;
    room.currentMedia = { ...a.mediaPool[0], ownerId: a.id, index: 0 };
    room.currentRound = 1;
    room.guesses.set(a.id, { guessedPlayerId: a.id, timeTaken: 500 });
    room.guesses.set(b.id, { guessedPlayerId: b.id, timeTaken: 500 });

    const result = scoreRound(room);
    const ra = result.results.find((r) => r.playerId === a.id)!;
    const rb = result.results.find((r) => r.playerId === b.id)!;
    expect(ra.isCorrect).toBe(true);
    expect(ra.roundScore).toBe(calculateScore(500, room.settings.timer * 1000));
    expect(rb.isCorrect).toBe(false);
    expect(rb.roundScore).toBe(0);
    expect(a.score).toBe(calculateScore(500, room.settings.timer * 1000));
  });

  it("marks players who didn't answer as too slow", () => {
    const room = makeRoom(2, 1);
    room.currentMedia = { ...room.players[0].mediaPool[0], ownerId: room.players[0].id, index: 0 };
    const result = scoreRound(room);
    expect(result.results.every((r) => r.tooSlow)).toBe(true);
  });
});

describe("calculateGameStats", () => {
  it("reports the longest streak reached during the game, not just the final one", () => {
    const room = makeRoom(2, 3);
    const [a] = room.players;
    const pattern = [true, true, true, false];
    pattern.forEach((correct, i) => {
      room.currentRound = i + 1;
      room.currentMedia = { ...a.mediaPool[0], ownerId: a.id, index: i };
      room.guesses.clear();
      room.guesses.set(a.id, { guessedPlayerId: correct ? a.id : room.players[1].id, timeTaken: 1000 });
      scoreRound(room);
    });
    expect(calculateGameStats(room).longestStreak).toEqual({ playerName: "P0", streak: 3 });
  });
});

describe("masterOfDisguise", () => {
  it("names the owner whose media fooled the most guesses", () => {
    const room = makeRoom(3, 2);
    const [a, b, c] = room.players;
    room.currentRound = 1;
    room.currentMedia = { ...a.mediaPool[0], ownerId: a.id, index: 0 };
    room.guesses.set(b.id, { guessedPlayerId: c.id, timeTaken: 500 });
    room.guesses.set(c.id, { guessedPlayerId: b.id, timeTaken: 500 });
    scoreRound(room);
    room.currentRound = 2;
    room.currentMedia = { ...b.mediaPool[0], ownerId: b.id, index: 1 };
    room.guesses.clear();
    room.guesses.set(a.id, { guessedPlayerId: b.id, timeTaken: 500 });
    scoreRound(room);
    expect(calculateGameStats(room).masterOfDisguise).toEqual({ playerName: "P0", fooled: 2 });
  });
});

describe("TokenBucket", () => {
  it("allows a burst then refills over time", () => {
    let now = 0;
    const bucket = new TokenBucket(3, 1, () => now);
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, true, false]);
    now += 1000;
    expect(bucket.take()).toBe(true);
    expect(bucket.take()).toBe(false);
  });
});

describe("RoomRegistry", () => {
  it("makes duplicate names unique", () => {
    const registry = new RoomRegistry();
    const { room } = registry.createRoom("s0", "Alex", {});
    const joined = registry.joinRoom(room.pin, "s1", "Alex");
    expect("player" in joined && joined.player.name).toBe("Alex 2");
  });

  it("only resumes with the right token", () => {
    const registry = new RoomRegistry();
    const { room, player } = registry.createRoom("s0", "Host", {});
    registry.detachSocket("s0");
    expect(registry.resume(room.pin, player.id, "wrong-token", "s1")).toBeNull();
    expect(registry.resume(room.pin, player.id, player.resumeToken, "s1")?.player.connected).toBe(true);
  });
});
