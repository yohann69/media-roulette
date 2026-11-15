import crypto from "node:crypto";
import * as mediaStore from "./mediaStore.js";
import type { GameSettings, Player, PublicRoom, Room } from "./types.js";

const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");

export const DEFAULT_SETTINGS: GameSettings = {
  rounds: 10,
  timer: 5,
  mode: "Photo",
  playVideoWithSound: true,
  blindMode: false,
  timeMachine: false,
};

export interface PlayerContext {
  room: Room;
  player: Player;
}

/**
 * Owns all rooms and players, and the indexes used to find them from a socket
 * or an upload token. Contains no game rules and no networking.
 */
export class RoomRegistry {
  readonly rooms = new Map<string, Room>();
  private bySocket = new Map<string, { pin: string; playerId: string }>();
  private byUploadToken = new Map<string, { pin: string; playerId: string }>();

  private generatePin(): string {
    let pin: string;
    do {
      pin = crypto.randomInt(100000, 1000000).toString();
    } while (this.rooms.has(pin));
    return pin;
  }

  private newPlayer(name: string, socketId: string, isHost: boolean, publicKey?: string): Player {
    return {
      id: randomToken(12),
      socketId,
      name,
      isHost,
      score: 0,
      state: "selecting",
      connected: true,
      resumeToken: randomToken(),
      uploadToken: randomToken(),
      latencyMs: 100,
      mediaPool: [],
      uploadedFiles: new Set(),
      publicKey: publicKey ?? null,
      // The host's phone creates the room key; others receive it from a player who has it.
      hasRoomKey: isHost,
      roomKeyShare: null,
      uploadsDone: false,
      seriesWins: 0,
      seriesScore: 0,
    };
  }

  private index(room: Room, player: Player) {
    if (player.socketId) this.bySocket.set(player.socketId, { pin: room.pin, playerId: player.id });
    this.byUploadToken.set(player.uploadToken, { pin: room.pin, playerId: player.id });
  }

  /** Makes names unique within a room ("Alex", "Alex 2", ...). */
  private uniqueName(room: Room, name: string): string {
    const taken = new Set(room.players.map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let n = 2; ; n++) {
      const suffix = ` ${n}`;
      const candidate = name.slice(0, 16 - suffix.length) + suffix;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
  }

  createRoom(socketId: string, hostName: string, settings: Partial<GameSettings>, publicKey?: string): PlayerContext {
    const pin = this.generatePin();
    const player = this.newPlayer(hostName, socketId, true, publicKey);
    const room: Room = {
      pin,
      players: [player],
      settings: { ...DEFAULT_SETTINGS, ...stripUndefined(settings) },
      gameState: "lobby",
      phase: null,
      syncStage: null,
      deck: [],
      deckPosition: -1,
      currentRound: 0,
      totalRounds: 0,
      currentMedia: null,
      currentTwist: null,
      roundStartedAt: 0,
      guesses: new Map(),
      readyPlayers: new Set(),
      streaks: new Map(),
      roundScores: new Map(),
      roundHistory: [],
      lastRoundResult: null,
      finalResult: null,
      lastActivityTime: Date.now(),
      gamesPlayed: 0,
    };
    this.rooms.set(pin, room);
    this.index(room, player);
    return { room, player };
  }

  joinRoom(pin: string, socketId: string, name: string, publicKey?: string): PlayerContext | { error: string } {
    const room = this.rooms.get(pin);
    if (!room) return { error: "Room not found" };
    if (room.gameState !== "lobby") return { error: "Game already started" };

    const existing = this.getContext(socketId);
    if (existing && existing.room.pin === pin) return existing;

    const player = this.newPlayer(this.uniqueName(room, name), socketId, false, publicKey);
    room.players.push(player);
    room.lastActivityTime = Date.now();
    this.index(room, player);
    return { room, player };
  }

  getContext(socketId: string): PlayerContext | null {
    const ref = this.bySocket.get(socketId);
    if (!ref) return null;
    const room = this.rooms.get(ref.pin);
    const player = room?.players.find((p) => p.id === ref.playerId);
    return room && player ? { room, player } : null;
  }

  /** Marks the socket's player as disconnected. They keep their seat until removed. */
  detachSocket(socketId: string): PlayerContext | null {
    const ctx = this.getContext(socketId);
    this.bySocket.delete(socketId);
    if (!ctx) return null;
    ctx.player.socketId = null;
    ctx.player.connected = false;
    return ctx;
  }

  /** Reattaches a returning player to a new socket, if their resume token matches. */
  resume(pin: string, playerId: string, resumeToken: string, socketId: string): PlayerContext | null {
    const room = this.rooms.get(pin);
    const player = room?.players.find((p) => p.id === playerId);
    if (!room || !player) return null;
    const expected = Buffer.from(player.resumeToken);
    const given = Buffer.from(resumeToken);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

    if (player.socketId) this.bySocket.delete(player.socketId);
    player.socketId = socketId;
    player.connected = true;
    this.index(room, player);
    room.lastActivityTime = Date.now();
    return { room, player };
  }

  /**
   * Removes a player for good, with their media. Promotes a new host if needed
   * and deletes the room once it's empty.
   */
  removePlayer(room: Room, playerId: string): { roomDeleted: boolean; hostChanged: boolean } {
    const index = room.players.findIndex((p) => p.id === playerId);
    if (index === -1) return { roomDeleted: false, hostChanged: false };
    const [player] = room.players.splice(index, 1);

    if (player.socketId) this.bySocket.delete(player.socketId);
    this.byUploadToken.delete(player.uploadToken);
    player.uploadedFiles.forEach((filename) => mediaStore.deleteFile(room.pin, filename));
    room.readyPlayers.delete(player.id);
    room.guesses.delete(player.id);

    if (room.players.length === 0) {
      this.deleteRoom(room.pin);
      return { roomDeleted: true, hostChanged: false };
    }

    if (player.isHost) {
      // Prefer someone who is currently connected.
      const candidates = room.players.filter((p) => p.connected);
      const pool = candidates.length > 0 ? candidates : room.players;
      this.setHost(room, pool[Math.floor(Math.random() * pool.length)].id);
      return { roomDeleted: false, hostChanged: true };
    }
    return { roomDeleted: false, hostChanged: false };
  }

  setHost(room: Room, playerId: string) {
    room.players.forEach((p) => (p.isHost = p.id === playerId));
  }

  deleteRoom(pin: string) {
    const room = this.rooms.get(pin);
    if (!room) return;
    for (const p of room.players) {
      if (p.socketId) this.bySocket.delete(p.socketId);
      this.byUploadToken.delete(p.uploadToken);
    }
    mediaStore.deleteRoom(pin);
    this.rooms.delete(pin);
  }

  resolveUploadToken(token: unknown): PlayerContext | null {
    if (typeof token !== "string") return null;
    const ref = this.byUploadToken.get(token);
    if (!ref) return null;
    const room = this.rooms.get(ref.pin);
    const player = room?.players.find((p) => p.id === ref.playerId);
    return room && player ? { room, player } : null;
  }

  publicRoom(room: Room): PublicRoom {
    return {
      pin: room.pin,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        score: p.score,
        state: p.state,
        connected: p.connected,
        mediaCount: p.mediaPool.length,
        publicKey: p.publicKey,
        hasRoomKey: p.hasRoomKey,
        seriesWins: p.seriesWins,
        seriesScore: p.seriesScore,
      })),
      settings: room.settings,
      gameState: room.gameState,
      gamesPlayed: room.gamesPlayed,
    };
  }

  /** Rooms with no activity for `thresholdMs`. */
  inactiveRooms(thresholdMs: number): Room[] {
    const cutoff = Date.now() - thresholdMs;
    return [...this.rooms.values()].filter((room) => room.lastActivityTime < cutoff);
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
