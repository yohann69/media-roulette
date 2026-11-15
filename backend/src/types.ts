export type PlayerState = "selecting" | "compressing" | "uploading" | "ready";

/** Externally visible game state. "playing" covers both the round and results phases. */
export type GameState = "lobby" | "syncing" | "playing" | "finished";

/** Sub-phase while `gameState === "playing"`. */
export type RoundPhase = "round" | "results";

export type MediaType = "photo" | "video";

export interface GameSettings {
  rounds: number;
  timer: number;
  mode: "Photo" | "Video" | "Mix";
  playVideoWithSound: boolean;
  blindMode: boolean;
}

export interface Player {
  /** Stable identity for the whole session, independent of the socket connection. */
  id: string;
  /** Current socket, or null while disconnected (within the reconnect grace period). */
  socketId: string | null;
  name: string;
  isHost: boolean;
  score: number;
  state: PlayerState;
  connected: boolean;
  /** Secret that lets this player resume after a disconnect. Never sent to others. */
  resumeToken: string;
  /** Secret that authorizes this player's media uploads and downloads. Never sent to others. */
  uploadToken: string;
  /** Smoothed one-way network delay, measured by the server. */
  latencyMs: number;
  /** Media pool confirmed by the player (only files they uploaded). */
  mediaPool: PoolItem[];
  /** Every file received from this player, pooled or not (for validation and cleanup). */
  uploadedFiles: Set<string>;
}

export interface PoolItem {
  id: string;
  filename: string;
  mediaType: MediaType;
}

export interface DeckItem extends PoolItem {
  ownerId: string;
  index: number;
}

export interface Guess {
  guessedPlayerId: string;
  timeTaken: number;
}

export interface RoundResult {
  playerId: string;
  playerName: string;
  guessedPlayerId: string | null;
  isCorrect: boolean;
  roundScore: number;
  timeTaken: number | null;
  totalScore: number;
  tooSlow: boolean;
  streak: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  totalScore: number;
  roundScore: number;
  timeTaken: number | null;
}

export interface RoundResultPayload {
  actualOwnerId: string;
  results: RoundResult[];
  leaderboard: LeaderboardEntry[];
}

export interface RoundHistoryEntry {
  round: number;
  actualOwnerId: string;
  results: Array<Pick<RoundResult, "playerId" | "playerName" | "isCorrect" | "timeTaken" | "streak">>;
}

export interface Room {
  pin: string;
  players: Player[];
  settings: GameSettings;
  gameState: GameState;
  phase: RoundPhase | null;
  /** Shuffled media for this game. */
  deck: DeckItem[];
  /** Position in `deck` of the media currently shown. */
  deckPosition: number;
  /** 1-based number of the current round. */
  currentRound: number;
  /** Rounds that will actually be played (≤ settings.rounds, ≤ deck size). */
  totalRounds: number;
  currentMedia: DeckItem | null;
  roundStartedAt: number;
  guesses: Map<string, Guess>;
  readyPlayers: Set<string>;
  streaks: Map<string, number>;
  roundScores: Map<string, { roundScore: number; timeTaken: number | null }>;
  roundHistory: RoundHistoryEntry[];
  lastRoundResult: RoundResultPayload | null;
  finalResult: { leaderboard: LeaderboardEntry[]; stats: GameStats | null } | null;
  lastActivityTime: number;
}

export interface GameStats {
  longestStreak: { playerName: string | null; streak: number };
  fastestAnswer: { playerName: string | null; time: number | null; round: number | null };
  averageTime: number | null;
  worstPlayer: { playerName: string | null; score: number; correctAnswers?: number; totalRounds?: number };
  hardestRound: { round: number | null; correctCount: number };
}

/** The only room representation ever sent to clients. */
export interface PublicRoom {
  pin: string;
  players: PublicPlayer[];
  settings: GameSettings;
  gameState: GameState;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  state: PlayerState;
  connected: boolean;
  /** Number of media items this player has confirmed. */
  mediaCount: number;
}
