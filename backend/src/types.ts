export type PlayerState = "selecting" | "compressing" | "uploading" | "ready";

/** Externally visible game state. "playing" covers both the round and results phases. */
export type GameState = "lobby" | "syncing" | "playing" | "finished";

/**
 * Sub-phase while `gameState === "playing"`: a guessing round and its results,
 * or, in caption mode, writing captions, voting, and the caption results.
 */
export type RoundPhase = "round" | "results" | "caption" | "captionVote" | "captionResults";

export interface CaptionEntry {
  /** Opaque id shown while voting, so captions stay anonymous until the results. */
  id: string;
  authorId: string;
  text: string;
}

export interface CaptionState {
  endsAt: number;
  captions: CaptionEntry[];
  /** Voter id → caption id. */
  votes: Map<string, string>;
  /** Last result sent, replayed to players who reconnect. */
  result: unknown;
}

export type MediaType = "photo" | "video";

export interface GameSettings {
  rounds: number;
  timer: number;
  mode: "Photo" | "Video" | "Mix";
  playVideoWithSound: boolean;
  blindMode: boolean;
  /** Time Machine: players also guess the year the media was taken. */
  timeMachine: boolean;
  /** Slow Reveal mode: every photo starts blurred and sharpens. */
  slowReveal: boolean;
  /** Caption mode: instead of guessing, players caption each photo and vote for the best caption. */
  captionMode: boolean;
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
  /** Media the player prepared on their phone (ids only: nothing is uploaded yet). */
  mediaPool: PoolItem[];
  /** Every file received from this player (for validation and cleanup). */
  uploadedFiles: Set<string>;
  /** X25519 public key (base64) used to receive the room key. */
  publicKey: string | null;
  /** Whether this player holds the room key (can decrypt the game's media). */
  hasRoomKey: boolean;
  /** The sealed room key relayed to this player, kept to replay after a reconnect. */
  roomKeyShare: { from: string; sealed: string } | null;
  /** True once the player has uploaded the media the server asked them for. */
  uploadsDone: boolean;
  /** Games won and points scored across rematches in this room. */
  seriesWins: number;
  seriesScore: number;
}

export interface PoolItem {
  /** Opaque id chosen by the owner's phone. */
  id: string;
  mediaType: MediaType;
  /** Year the media was taken (Time Machine). Only revealed with the round result. */
  year?: number;
}

export interface DeckItem extends PoolItem {
  ownerId: string;
  index: number;
  /** Encrypted file on the server, once the owner has uploaded it. */
  filename?: string;
}

export interface Guess {
  /** Null while only a year has been guessed (Time Machine). */
  guessedPlayerId: string | null;
  timeTaken: number;
  year?: number;
}

/** A special rule applied to one round. */
export type RoundTwist = "slowReveal";

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
  /** Time Machine: the year guessed and the points it earned. */
  yearGuess: number | null;
  yearBonus: number;
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
  /** Time Machine: the year the media was taken. */
  actualYear: number | null;
  results: RoundResult[];
  leaderboard: LeaderboardEntry[];
}

export interface RoundHistoryEntry {
  round: number;
  actualOwnerId: string;
  results: Array<Pick<RoundResult, "playerId" | "playerName" | "isCorrect" | "timeTaken" | "streak"> & { guessed: boolean }>;
}

export interface Room {
  pin: string;
  players: Player[];
  settings: GameSettings;
  gameState: GameState;
  phase: RoundPhase | null;
  /** While syncing: first the owners upload the chosen media, then everyone downloads it. */
  syncStage: "collecting" | "downloading" | null;
  /** Shuffled media for this game. */
  deck: DeckItem[];
  /** Position in `deck` of the media currently shown. */
  deckPosition: number;
  /** 1-based number of the current round. */
  currentRound: number;
  /** Rounds that will actually be played (≤ settings.rounds, ≤ deck size). */
  totalRounds: number;
  currentMedia: DeckItem | null;
  currentTwist: RoundTwist | null;
  /** Caption mode: the captions and votes of the current round. */
  caption: CaptionState | null;
  /** Caption mode: the most voted caption of the game so far. */
  bestCaption: { playerName: string; text: string; votes: number } | null;
  /** Once finished: the room of the rematch, which other players can join. */
  rematchPin: string | null;
  roundStartedAt: number;
  guesses: Map<string, Guess>;
  readyPlayers: Set<string>;
  streaks: Map<string, number>;
  roundScores: Map<string, { roundScore: number; timeTaken: number | null }>;
  roundHistory: RoundHistoryEntry[];
  lastRoundResult: RoundResultPayload | null;
  finalResult: { leaderboard: LeaderboardEntry[]; stats: GameStats | null } | null;
  lastActivityTime: number;
  /** Games finished in this room (rematches keep the room). */
  gamesPlayed: number;
}

export interface GameStats {
  longestStreak: { playerName: string | null; streak: number };
  fastestAnswer: { playerName: string | null; time: number | null; round: number | null };
  averageTime: number | null;
  worstPlayer: { playerName: string | null; score: number; correctAnswers?: number; totalRounds?: number };
  hardestRound: { round: number | null; correctCount: number };
  /** The owner whose media fooled the most guesses. */
  masterOfDisguise: { playerName: string | null; fooled: number };
  /** Caption mode: the most voted caption. */
  bestCaption?: { playerName: string; text: string; votes: number } | null;
}

/** The only room representation ever sent to clients. */
export interface PublicRoom {
  pin: string;
  players: PublicPlayer[];
  settings: GameSettings;
  gameState: GameState;
  gamesPlayed: number;
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
  /** X25519 public key (base64), so others can seal the room key for this player. */
  publicKey: string | null;
  hasRoomKey: boolean;
  seriesWins: number;
  seriesScore: number;
}
