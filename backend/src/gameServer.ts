import type { Server, Socket } from "socket.io";
import { schemas, type ClientEvent, type Payload } from "./protocol.js";
import { RoomRegistry, type PlayerContext } from "./rooms.js";
import {
  answerTime,
  buildDeck,
  calculateGameStats,
  CAPTION_VOTE_POINTS,
  extraFor,
  leaderboard,
  ROUND_GRACE_MS,
  scoreRound,
  STORY_APPLAUSE_POINTS,
  twistFor,
} from "./game.js";
import { KeyedRateLimiter, TokenBucket } from "./rateLimit.js";
import * as mediaStore from "./mediaStore.js";
// Debug-only helper (JavaScript): a no-op unless Drive credentials are configured.
import { enqueueBackup } from "./driveBackup.js";
import type { ExtraState, Player, Room } from "./types.js";
import crypto from "node:crypto";
import path from "node:path";

export interface GameServerOptions {
  /** How long a disconnected player keeps their seat. */
  reconnectGraceMs?: number;
  /** Rooms with no activity for this long are closed. */
  inactivityTimeoutMs?: number;
  /** How often player latency is measured. */
  latencyIntervalMs?: number;
  /** Pause between "game-started" and the first round, so every phone is on the game screen. */
  firstRoundDelayMs?: number;
  /** How long owners have to upload the media chosen for the game. */
  collectTimeoutMs?: number;
  /** Pause after a skipped round before the next media shows. */
  skipPauseMs?: number;
  /** Media older than this is deleted from disk, whatever the game state (backstop). */
  mediaMaxAgeMs?: number;
  /** Party extras: time to write a caption, to vote, to tell the story, and the pause after it. */
  captionWriteMs?: number;
  captionVoteMs?: number;
  storyMs?: number;
  storyEndPauseMs?: number;
}

/** A guess must arrive within the round duration, plus this tolerance. */
const LATE_GUESS_TOLERANCE_MS = 250;

/**
 * Server-authoritative game flow: the server decides when rounds start and end,
 * measures answer times itself, and never reveals who owns a media item before
 * the round result.
 */
export class GameServer {
  readonly registry = new RoomRegistry();
  private roundTimers = new Map<string, NodeJS.Timeout>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private intervals: NodeJS.Timeout[] = [];
  private joinLimiter = new KeyedRateLimiter(10, 10 / 60); // 10 join attempts per minute per IP
  private createLimiter = new KeyedRateLimiter(5, 5 / 60); // 5 games per minute per IP
  private readonly graceMs: number;
  private readonly firstRoundDelayMs: number;
  private readonly collectTimeoutMs: number;
  private readonly skipPauseMs: number;
  private readonly captionWriteMs: number;
  private readonly captionVoteMs: number;
  private readonly storyMs: number;
  private readonly storyEndPauseMs: number;

  constructor(
    private io: Server,
    options: GameServerOptions = {}
  ) {
    this.graceMs = options.reconnectGraceMs ?? 60_000;
    this.firstRoundDelayMs = options.firstRoundDelayMs ?? 2000;
    this.collectTimeoutMs = options.collectTimeoutMs ?? 60_000;
    this.skipPauseMs = options.skipPauseMs ?? 1500;
    this.captionWriteMs = options.captionWriteMs ?? 40_000;
    this.captionVoteMs = options.captionVoteMs ?? 20_000;
    this.storyMs = options.storyMs ?? 30_000;
    this.storyEndPauseMs = options.storyEndPauseMs ?? 3000;
    const mediaMaxAge = options.mediaMaxAgeMs ?? 3 * 60 * 60_000;
    const inactivity = options.inactivityTimeoutMs ?? 15 * 60_000;

    io.on("connection", (socket) => this.onConnection(socket));

    this.intervals.push(
      setInterval(() => this.measureLatency(), options.latencyIntervalMs ?? 5000),
      setInterval(() => this.closeInactiveRooms(inactivity), 60_000),
      setInterval(() => mediaStore.sweepOlderThan(mediaMaxAge), 10 * 60_000),
      setInterval(() => {
        this.joinLimiter.prune(10 * 60_000);
        this.createLimiter.prune(10 * 60_000);
      }, 10 * 60_000)
    );
  }

  close() {
    this.intervals.forEach(clearInterval);
    this.roundTimers.forEach(clearTimeout);
    this.disconnectTimers.forEach(clearTimeout);
  }

  // ── Connection & dispatch ────────────────────────────────────────────────

  private onConnection(socket: Socket) {
    const bucket = new TokenBucket(30, 15); // per-socket event budget
    const ip = clientIp(socket);

    const on = <E extends ClientEvent>(event: E, handler: (data: Payload<E>, ctx: PlayerContext | null) => void) => {
      socket.on(event as string, (raw: unknown) => {
        if (!bucket.take()) return;
        const parsed = schemas[event].safeParse(raw);
        if (!parsed.success) return;
        try {
          handler(parsed.data as Payload<E>, this.registry.getContext(socket.id));
        } catch (error) {
          console.error(`Error handling ${event}:`, error);
          socket.emit("error", { message: `Failed to handle ${event}` });
        }
      });
    };

    /** Like `on`, but only for players of the room named in the payload. */
    const onMember = <E extends ClientEvent>(event: E, handler: (data: Payload<E>, ctx: PlayerContext) => void) => {
      on(event, (data, ctx) => {
        const pin = (data as { pin?: string } | undefined)?.pin;
        if (!ctx || (pin !== undefined && ctx.room.pin !== pin)) return;
        ctx.room.lastActivityTime = Date.now();
        handler(data, ctx);
      });
    };

    on("create-game", (data, ctx) => {
      if (!this.createLimiter.take(ip)) {
        socket.emit("error", { message: "Too many games created, try again in a minute" });
        return;
      }
      if (ctx) this.leave(ctx); // one room per socket
      const { room, player } = this.registry.createRoom(socket.id, data.hostName, data.settings ?? {}, data.publicKey);
      socket.join(room.pin);
      socket.emit("game-created", {
        pin: room.pin,
        room: this.registry.publicRoom(room),
        playerId: player.id,
        resumeToken: player.resumeToken,
        uploadToken: player.uploadToken,
      });
    });

    on("join-game", (data, ctx) => {
      if (!this.joinLimiter.take(ip)) {
        socket.emit("join-error", { message: "Too many attempts, try again in a minute" });
        return;
      }
      if (ctx && ctx.room.pin !== data.pin) this.leave(ctx);
      const result = this.registry.joinRoom(data.pin, socket.id, data.playerName, data.publicKey);
      if ("error" in result) {
        socket.emit("join-error", { message: result.error });
        return;
      }
      const { room, player } = result;
      socket.join(room.pin);
      socket.emit("joined-game", {
        pin: room.pin,
        room: this.registry.publicRoom(room),
        playerId: player.id,
        resumeToken: player.resumeToken,
        uploadToken: player.uploadToken,
      });
      socket.to(room.pin).emit("player-joined", {
        player: { id: player.id, name: player.name, isHost: false },
        players: this.registry.publicRoom(room).players,
      });
      this.broadcastRoom(room);
      this.requestRoomKeyFor(room, player);
    });

    on("resume-session", (data) => this.resume(socket, data));

    on("leave-game", (_data, ctx) => {
      if (ctx) this.leave(ctx);
    });

    onMember("set-player-state", (data, { room, player }) => {
      player.state = data.state;
      this.broadcastRoom(room);
    });

    onMember("set-media-pool", (data, ctx) => this.setMediaPool(socket, data, ctx));

    onMember("uploads-complete", (data, ctx) => this.uploadsComplete(data, ctx));

    onMember("share-room-key", (data, { room, player }) => {
      const recipient = room.players.find((p) => p.id === data.to);
      if (!player.hasRoomKey || !recipient || recipient.hasRoomKey) return;
      // The sealed key is opaque to the server: it's encrypted for the recipient only.
      recipient.roomKeyShare = { from: player.id, sealed: data.sealed };
      recipient.hasRoomKey = true;
      this.sendRoomKey(recipient);
      this.broadcastRoom(room);
    });

    onMember("prepare-game", (data, { room, player }) => {
      if (!player.isHost || room.gameState !== "lobby") return;
      if (data.updatedSettings) Object.assign(room.settings, stripUndefined(data.updatedSettings));
      this.prepareGame(room);
    });

    onMember("sync-complete", (_data, { room, player }) => {
      if (room.gameState !== "syncing") return;
      room.readyPlayers.add(player.id);
      this.io.to(room.pin).emit("player-ready", {
        playerId: player.id,
        readyCount: room.readyPlayers.size,
        totalPlayers: room.players.length,
      });
      this.broadcastRoom(room);
      this.startIfEveryoneSynced(room);
    });

    // The game now starts automatically once every player has the media.
    // Kept so older clients that still send it don't error.
    onMember("start-game", (_data, { room }) => this.startIfEveryoneSynced(room));

    onMember("submit-guess", (data, ctx) => this.submitGuess(socket, data, ctx));

    onMember("continue-game", (_data, { room, player }) => {
      if (room.gameState !== "playing" || !room.currentMedia) return;
      if (room.phase !== "results" && room.phase !== "captionResults") return;
      const owner = room.players.find((p) => p.id === room.currentMedia!.ownerId);
      // The owner moves the game on. If they left or are offline, anyone can.
      if (owner && owner.connected && owner.id !== player.id) {
        socket.emit("error", { message: "Only the media owner can continue" });
        return;
      }
      // After some rounds, a party extra comes before the next media.
      const extra = room.phase === "results" ? extraFor(room.currentRound, room.settings) : null;
      if (extra === "caption") this.startCaption(room);
      else if (extra === "story" && owner?.connected) this.startStory(room);
      else this.nextRound(room);
    });

    onMember("update-extras", (data, { room, player }) => {
      if (!player.isHost || room.gameState !== "lobby") return;
      if (data.captionThis !== undefined) room.settings.captionThis = data.captionThis;
      if (data.storyTime !== undefined) room.settings.storyTime = data.storyTime;
      this.broadcastRoom(room);
    });

    onMember("submit-caption", (data, { room, player }) => {
      const extra = room.extra;
      if (room.phase !== "caption" || !extra) return;
      const existing = extra.captions.find((c) => c.authorId === player.id);
      if (existing) existing.text = data.text;
      else extra.captions.push({ id: crypto.randomBytes(4).toString("hex"), authorId: player.id, text: data.text });
      socket.emit("caption-received", { success: true });
      if (room.players.every((p) => extra.captions.some((c) => c.authorId === p.id))) this.startCaptionVote(room);
    });

    onMember("vote-caption", (data, { room, player }) => {
      const extra = room.extra;
      if (room.phase !== "captionVote" || !extra) return;
      const caption = extra.captions.find((c) => c.id === data.captionId);
      if (!caption || caption.authorId === player.id) return;
      extra.votes.set(player.id, caption.id);
      socket.emit("caption-vote-received", { success: true });
      this.finishCaptionIfEveryoneVoted(room);
    });

    onMember("applaud", (_data, { room, player }) => {
      const extra = room.extra;
      if (room.phase !== "story" || !extra || player.id === room.currentMedia?.ownerId) return;
      if (extra.applause.has(player.id)) return;
      extra.applause.add(player.id);
      this.io.to(room.pin).emit("applause", { playerId: player.id, count: extra.applause.size });
    });

    onMember("end-story", (_data, { room, player }) => {
      if (room.phase === "story" && player.id === room.currentMedia?.ownerId) this.endStory(room);
    });

    onMember("skip-media", (_data, { room, player }) => {
      if (room.gameState !== "playing" || room.phase !== "round" || room.currentMedia?.ownerId !== player.id) return;
      this.skipRound(room);
    });

    onMember("show-media-again", (_data, { room, player }) => {
      if (room.phase === "results" && room.currentMedia?.ownerId === player.id) {
        this.io.to(room.pin).emit("show-media-again", { mediaId: room.currentMedia.index });
      }
    });

    onMember("hide-media-again", (_data, { room, player }) => {
      if (room.currentMedia?.ownerId === player.id) this.io.to(room.pin).emit("hide-media-again");
    });

    onMember("play-again", (_data, { room, player }) => {
      if (room.gameState !== "finished") {
        socket.emit("error", { message: "Game is not finished yet" });
        return;
      }
      // Rematch: same room, same players and settings. The host stays host.
      const host = this.rematchHost(room, player);
      this.resetForNewGame(room, host.id);
      this.io.to(room.pin).emit("play-again-initiated", { newHostId: host.id, newHostName: host.name });
      this.broadcastRoom(room);
    });

    onMember("kick-player", (data, { room, player }) => {
      if (!player.isHost || data.playerId === player.id) return;
      if (room.gameState !== "lobby" && room.gameState !== "finished") return;
      const target = room.players.find((p) => p.id === data.playerId);
      if (!target) return;
      if (target.socketId) {
        this.io.to(target.socketId).emit("kicked", { pin: room.pin });
        this.io.sockets.sockets.get(target.socketId)?.leave(room.pin);
      }
      this.removePlayer(room, target.id);
    });

    // Lets the app check its connection is still alive (e.g. when it returns to the foreground).
    socket.on("client-ping", (ack: unknown) => {
      if (typeof ack === "function") ack();
    });

    socket.on("disconnect", () => this.onDisconnect(socket.id));
  }

  // ── Lobby ────────────────────────────────────────────────────────────────

  private setMediaPool(socket: Socket, data: Payload<"set-media-pool">, { room, player }: PlayerContext) {
    if (data.playAgain && room.gameState === "finished") this.resetForNewGame(room, this.rematchHost(room, player).id);
    if (room.gameState !== "lobby") {
      socket.emit("error", { message: "The game has already started" });
      return;
    }

    // Only ids and types: the media stays on the phone until it's chosen for the game.
    // The year is only kept for Time Machine games, and never sent to other players before the reveal.
    const keepYear = room.settings.timeMachine;
    player.mediaPool = data.mediaPool.map((item) => ({
      id: item.id,
      mediaType: item.mediaType,
      ...(keepYear && item.year !== undefined ? { year: item.year } : {}),
    }));
    player.state = "ready";
    this.broadcastRoom(room);
    socket.emit("media-pool-set", { success: true, accepted: player.mediaPool.length });
  }

  // ── Room key ─────────────────────────────────────────────────────────────

  /** Asks the players who hold the room key to seal it for `player`. */
  private requestRoomKeyFor(room: Room, player: Room["players"][number]) {
    if (player.hasRoomKey || !player.publicKey) return;
    for (const holder of room.players) {
      if (holder.hasRoomKey && holder.socketId) {
        this.io.to(holder.socketId).emit("key-request", { playerId: player.id, publicKey: player.publicKey });
      }
    }
  }

  private sendRoomKey(player: Room["players"][number]) {
    if (player.socketId && player.roomKeyShare) {
      this.io.to(player.socketId).emit("room-key", player.roomKeyShare);
    }
  }

  /**
   * Picks the game's media first, then asks each owner to upload only their
   * chosen items. Everything else a player selected never leaves their phone.
   */
  private prepareGame(room: Room) {
    const deck = buildDeck(room.players);
    if (deck.length === 0) {
      this.io.to(room.pin).emit("error", { message: "No media available to start the game" });
      return;
    }
    room.deck = deck.slice(0, room.settings.rounds);
    room.totalRounds = room.deck.length;
    room.gameState = "syncing";
    room.syncStage = "collecting";
    room.readyPlayers.clear();

    for (const player of room.players) {
      player.uploadsDone = !room.deck.some((m) => m.ownerId === player.id);
      this.requestUploads(room, player);
    }
    this.broadcastRoom(room);

    this.clearRoundTimer(room.pin);
    this.roundTimers.set(
      room.pin,
      setTimeout(() => this.finishCollecting(room), this.collectTimeoutMs)
    );
    this.finishCollectingIfDone(room);
  }

  private requestUploads(room: Room, player: Room["players"][number]) {
    if (player.uploadsDone || !player.socketId) return;
    const items = room.deck.filter((m) => m.ownerId === player.id && !m.filename).map((m) => m.id);
    this.io.to(player.socketId).emit("upload-request", { pin: room.pin, items });
  }

  private uploadsComplete(data: Payload<"uploads-complete">, { room, player }: PlayerContext) {
    if (room.gameState !== "syncing" || room.syncStage !== "collecting") return;
    for (const { id, filename } of data.items) {
      const item = room.deck.find((m) => m.ownerId === player.id && m.id === id);
      // Only files this player actually uploaded to this room.
      if (item && player.uploadedFiles.has(filename)) item.filename = filename;
    }
    player.uploadsDone = true;
    this.finishCollectingIfDone(room);
  }

  private finishCollectingIfDone(room: Room) {
    if (room.syncStage === "collecting" && room.players.every((p) => p.uploadsDone)) this.finishCollecting(room);
  }

  /** Starts the download phase with whatever media was uploaded in time. */
  private finishCollecting(room: Room) {
    if (room.gameState !== "syncing" || room.syncStage !== "collecting") return;
    this.clearRoundTimer(room.pin);

    room.deck = room.deck.filter((m) => m.filename).map((m, index) => ({ ...m, index }));
    if (room.deck.length === 0) {
      room.gameState = "lobby";
      room.syncStage = null;
      this.io.to(room.pin).emit("error", { message: "No media could be shared, please try again" });
      this.broadcastRoom(room);
      return;
    }
    room.totalRounds = room.deck.length;
    room.syncStage = "downloading";

    // Debug-only backup; a no-op unless Drive credentials are configured.
    for (const item of room.deck) {
      const owner = room.players.find((p) => p.id === item.ownerId);
      enqueueBackup({
        localPath: path.join(mediaStore.roomDir(room.pin), item.filename!),
        username: owner?.name ?? "unknown",
        originalFilename: item.filename,
      });
    }

    this.io.to(room.pin).emit("sync-media", { media: this.publicDeck(room), count: room.deck.length });
    this.broadcastRoom(room);
  }

  /** Media list sent to players: never includes who owns what. */
  private publicDeck(room: Room) {
    return room.deck.map(({ index, mediaType, filename }) => ({ index, mediaType, filename: filename! }));
  }

  private startIfEveryoneSynced(room: Room) {
    if (room.gameState !== "syncing" || room.syncStage !== "downloading") return;
    if (!room.players.every((p) => room.readyPlayers.has(p.id))) return;

    room.gameState = "playing";
    room.syncStage = null;
    room.currentRound = 0;
    room.deckPosition = -1;
    room.phase = null;
    this.io.to(room.pin).emit("all-players-ready");
    this.io.to(room.pin).emit("game-started", { currentRound: 1, totalRounds: room.totalRounds });
    // Short "get ready" pause: phones switch to the game screen before the clock starts.
    const timer = setTimeout(() => {
      if (this.registry.rooms.has(room.pin) && room.gameState === "playing" && room.currentRound === 0) {
        this.nextRound(room);
      }
    }, this.firstRoundDelayMs);
    this.roundTimers.set(room.pin, timer);
  }

  /** The current host keeps hosting a rematch, unless they're offline. */
  private rematchHost(room: Room, requester: Player): Player {
    return room.players.find((p) => p.isHost && p.connected) ?? requester;
  }

  private resetForNewGame(room: Room, newHostId: string) {
    this.clearRoundTimer(room.pin);
    mediaStore.deleteRoom(room.pin);
    Object.assign(room, {
      gameState: "lobby",
      phase: null,
      syncStage: null,
      deck: [],
      deckPosition: -1,
      currentRound: 0,
      totalRounds: 0,
      currentMedia: null,
      currentTwist: null,
      extra: null,
      lastRoundResult: null,
      finalResult: null,
    } satisfies Partial<Room>);
    room.guesses.clear();
    room.readyPlayers.clear();
    room.streaks.clear();
    room.roundScores.clear();
    room.roundHistory = [];
    for (const p of room.players) {
      p.score = 0;
      p.state = "selecting";
      p.mediaPool = [];
      p.uploadedFiles.clear();
      p.uploadsDone = false;
    }
    this.registry.setHost(room, newHostId);
  }

  // ── Rounds ───────────────────────────────────────────────────────────────

  /** Moves to the next playable media, or ends the game. */
  private nextRound(room: Room) {
    this.clearRoundTimer(room.pin);
    const inRoom = new Set(room.players.map((p) => p.id));

    // Skip media from players who have left the game: nobody could guess them.
    let position = room.deckPosition + 1;
    while (position < room.deck.length && !inRoom.has(room.deck[position].ownerId)) position++;

    const remainingPlayable = room.deck.slice(position).filter((m) => inRoom.has(m.ownerId)).length;
    room.totalRounds = Math.min(room.settings.rounds, room.currentRound + remainingPlayable);

    if (position >= room.deck.length || room.currentRound >= room.totalRounds) {
      this.finishGame(room);
      return;
    }

    room.deckPosition = position;
    room.currentMedia = room.deck[position];
    room.currentRound += 1;
    room.currentTwist = twistFor(room.currentRound, room.currentMedia.mediaType, room.settings.slowReveal);
    room.extra = null;
    room.phase = "round";
    room.guesses.clear();
    room.roundStartedAt = Date.now();

    this.io.to(room.pin).emit("new-round", this.roundPayload(room));
    const timer = setTimeout(() => this.endRound(room), room.settings.timer * 1000 + ROUND_GRACE_MS);
    this.roundTimers.set(room.pin, timer);
  }

  private roundPayload(room: Room) {
    const media = room.currentMedia!;
    const remainingMs = Math.max(0, room.settings.timer * 1000 - (Date.now() - room.roundStartedAt));
    return {
      round: room.currentRound,
      totalRounds: room.totalRounds,
      // Opaque id: the owner's library id would hint at who took it.
      mediaData: { id: `media-${media.index}`, index: media.index, mediaType: media.mediaType },
      duration: Math.ceil(remainingMs / 1000),
      remainingMs,
      options: room.players.map((p) => ({ id: p.id, name: p.name })),
      roundStartTime: room.roundStartedAt,
      twist: room.currentTwist,
      // Time Machine: the years players can pick from (not the answer).
      yearRange: this.yearRange(room),
    };
  }

  private yearRange(room: Room): { min: number; max: number } | null {
    if (!room.settings.timeMachine || room.currentMedia?.year === undefined) return null;
    const years = room.deck.map((m) => m.year).filter((y): y is number => y !== undefined);
    const thisYear = new Date().getFullYear();
    return { min: Math.min(...years), max: Math.max(thisYear, ...years) };
  }

  private submitGuess(socket: Socket, data: Payload<"submit-guess">, { room, player }: PlayerContext) {
    if (room.gameState !== "playing" || room.phase !== "round") {
      socket.emit("guess-received", { success: false, message: "Round already ended" });
      return;
    }
    if (data.targetUser !== undefined && !room.players.some((p) => p.id === data.targetUser)) return;
    if (data.targetUser === undefined && data.year === undefined) return;

    const timeTaken = answerTime(Date.now() - room.roundStartedAt, player.latencyMs, data.displayDelayMs);
    if (timeTaken > room.settings.timer * 1000 + LATE_GUESS_TOLERANCE_MS) {
      socket.emit("guess-received", { success: false, message: "Too late" });
      return;
    }

    // Players may change their mind while the round runs: the last guess counts.
    // "Who" and "when" (Time Machine) can be sent separately.
    const previous = room.guesses.get(player.id);
    room.guesses.set(player.id, {
      guessedPlayerId: data.targetUser ?? previous?.guessedPlayerId ?? null,
      timeTaken: data.targetUser !== undefined ? timeTaken : (previous?.timeTaken ?? timeTaken),
      year: data.year ?? previous?.year,
    });
    socket.emit("guess-received", { success: true });
    this.endRoundIfEveryoneGuessed(room);
  }

  /**
   * Ends the round early once every player has answered. Players who are briefly
   * offline still count: they may come back within the round, and the round timer
   * guarantees nobody waits forever.
   */
  /**
   * Drops the current round without scoring it (the owner chose to hide their
   * media). Nobody learns whose media it was; the next media is shown instead.
   */
  private skipRound(room: Room) {
    this.clearRoundTimer(room.pin);
    room.phase = null;
    room.guesses.clear();
    room.currentRound -= 1; // the skipped media doesn't count as a round
    this.io.to(room.pin).emit("round-skipped", {});
    this.roundTimers.set(
      room.pin,
      setTimeout(() => {
        if (this.registry.rooms.has(room.pin) && room.gameState === "playing") this.nextRound(room);
      }, this.skipPauseMs)
    );
  }

  private endRoundIfEveryoneGuessed(room: Room) {
    if (room.phase !== "round") return;
    const needsYear = this.yearRange(room) !== null;
    const done = (id: string) => {
      const guess = room.guesses.get(id);
      return !!guess && guess.guessedPlayerId !== null && (!needsYear || guess.year !== undefined);
    };
    if (room.guesses.size > 0 && room.players.every((p) => done(p.id))) this.endRound(room);
  }

  private endRound(room: Room) {
    if (room.phase !== "round" || !this.registry.rooms.has(room.pin)) return;
    this.clearRoundTimer(room.pin);
    room.phase = "results";
    room.lastRoundResult = scoreRound(room);
    room.lastActivityTime = Date.now();
    this.io.to(room.pin).emit("round-result", room.lastRoundResult);
  }

  // ── Party extras ─────────────────────────────────────────────────────────

  private newExtra(kind: ExtraState["kind"], durationMs: number): ExtraState {
    return { kind, endsAt: Date.now() + durationMs, captions: [], votes: new Map(), applause: new Set(), result: null };
  }

  private remaining(room: Room) {
    return Math.max(0, (room.extra?.endsAt ?? 0) - Date.now());
  }

  private setPhaseTimer(room: Room, ms: number, next: () => void) {
    this.clearRoundTimer(room.pin);
    this.roundTimers.set(
      room.pin,
      setTimeout(() => {
        if (this.registry.rooms.has(room.pin) && room.gameState === "playing") next();
      }, ms)
    );
  }

  /** Caption This: everyone writes a caption for the media just revealed. */
  private startCaption(room: Room) {
    room.phase = "caption";
    room.extra = this.newExtra("caption", this.captionWriteMs);
    this.io.to(room.pin).emit("caption-start", { round: room.currentRound, endsInMs: this.captionWriteMs });
    this.setPhaseTimer(room, this.captionWriteMs, () => this.startCaptionVote(room));
  }

  private startCaptionVote(room: Room) {
    const extra = room.extra;
    if (room.phase !== "caption" || !extra) return;
    if (extra.captions.length < 2) {
      // Nothing to vote on: show what was written and move on.
      this.finishCaption(room);
      return;
    }
    room.phase = "captionVote";
    extra.endsAt = Date.now() + this.captionVoteMs;
    // Shuffled and anonymous: authors are only revealed with the results.
    extra.captions.sort(() => Math.random() - 0.5);
    for (const player of room.players) this.sendCaptionVote(room, player);
    this.setPhaseTimer(room, this.captionVoteMs, () => this.finishCaption(room));
  }

  private sendCaptionVote(room: Room, player: Player) {
    if (!player.socketId || !room.extra) return;
    this.io.to(player.socketId).emit("caption-vote-start", {
      captions: room.extra.captions.map((c) => ({ id: c.id, text: c.text, mine: c.authorId === player.id })),
      endsInMs: this.remaining(room),
    });
  }

  private finishCaptionIfEveryoneVoted(room: Room) {
    const extra = room.extra;
    if (room.phase !== "captionVote" || !extra) return;
    // Players who only see their own caption have nothing to vote for.
    const voters = room.players.filter((p) => extra.captions.some((c) => c.authorId !== p.id));
    if (voters.every((p) => extra.votes.has(p.id))) this.finishCaption(room);
  }

  private finishCaption(room: Room) {
    const extra = room.extra;
    if ((room.phase !== "caption" && room.phase !== "captionVote") || !extra) return;
    this.clearRoundTimer(room.pin);
    const votesFor = new Map<string, number>();
    for (const captionId of extra.votes.values()) votesFor.set(captionId, (votesFor.get(captionId) ?? 0) + 1);

    const results = extra.captions
      .map((c) => {
        const author = room.players.find((p) => p.id === c.authorId);
        const votes = votesFor.get(c.id) ?? 0;
        const points = votes * CAPTION_VOTE_POINTS;
        if (author) author.score += points;
        return { authorId: c.authorId, authorName: author?.name ?? "", text: c.text, votes, points };
      })
      .sort((a, b) => b.votes - a.votes);

    room.phase = "captionResults";
    extra.result = { results, leaderboard: leaderboard(room) };
    this.io.to(room.pin).emit("caption-results", extra.result);
    // The owner moves on, as after a round ("continue-game").
  }

  /** Story Time: the owner gets the floor to tell the story behind their media. */
  private startStory(room: Room) {
    const owner = room.players.find((p) => p.id === room.currentMedia?.ownerId);
    if (!owner) {
      this.nextRound(room);
      return;
    }
    room.phase = "story";
    room.extra = this.newExtra("story", this.storyMs);
    this.io.to(room.pin).emit("story-start", { ownerId: owner.id, ownerName: owner.name, endsInMs: this.storyMs });
    this.setPhaseTimer(room, this.storyMs, () => this.endStory(room));
  }

  private endStory(room: Room) {
    const extra = room.extra;
    if (room.phase !== "story" || !extra) return;
    this.clearRoundTimer(room.pin);
    const owner = room.players.find((p) => p.id === room.currentMedia?.ownerId);
    const points = extra.applause.size * STORY_APPLAUSE_POINTS;
    if (owner) owner.score += points;
    room.phase = "storyEnded";
    extra.result = { ownerId: owner?.id ?? null, applause: extra.applause.size, points, leaderboard: leaderboard(room) };
    this.io.to(room.pin).emit("story-ended", extra.result);
    this.setPhaseTimer(room, this.storyEndPauseMs, () => this.nextRound(room));
  }

  /** Re-checks a running extra after a player left. */
  private recheckExtra(room: Room) {
    const extra = room.extra;
    if (!extra) return;
    if (room.phase === "caption" && room.players.every((p) => extra.captions.some((c) => c.authorId === p.id))) {
      this.startCaptionVote(room);
    } else if (room.phase === "captionVote") {
      this.finishCaptionIfEveryoneVoted(room);
    } else if (room.phase === "story" && !room.players.some((p) => p.id === room.currentMedia?.ownerId)) {
      this.endStory(room);
    }
  }

  /** Replays the running extra to a player who reconnected. */
  private replayExtra(room: Room, player: Player) {
    const extra = room.extra;
    if (!extra || !player.socketId) return;
    const to = this.io.to(player.socketId);
    if (room.phase === "caption") to.emit("caption-start", { round: room.currentRound, endsInMs: this.remaining(room) });
    else if (room.phase === "captionVote") this.sendCaptionVote(room, player);
    else if (room.phase === "captionResults") to.emit("caption-results", extra.result);
    else if (room.phase === "story") {
      const owner = room.players.find((p) => p.id === room.currentMedia?.ownerId);
      to.emit("story-start", { ownerId: owner?.id, ownerName: owner?.name, endsInMs: this.remaining(room) });
    } else if (room.phase === "storyEnded") to.emit("story-ended", extra.result);
  }

  private finishGame(room: Room) {
    this.clearRoundTimer(room.pin);
    let stats = null;
    try {
      stats = calculateGameStats(room);
    } catch (error) {
      console.error(`[Game ${room.pin}] Error calculating stats:`, error);
    }
    room.gameState = "finished";
    room.phase = null;
    room.finalResult = { leaderboard: leaderboard(room), stats };
    this.recordSeries(room);
    // Media is no longer needed once the game is over.
    mediaStore.deleteRoom(room.pin);
    room.players.forEach((p) => p.uploadedFiles.clear());
    this.io.to(room.pin).emit("game-finished", room.finalResult);
    this.broadcastRoom(room);
  }

  /** Rematches in the same room add up to a series: total points and games won. */
  private recordSeries(room: Room) {
    if (room.roundHistory.length === 0) return;
    room.gamesPlayed += 1;
    const best = Math.max(...room.players.map((p) => p.score));
    for (const p of room.players) {
      p.seriesScore += p.score;
      if (best > 0 && p.score === best) p.seriesWins += 1;
    }
  }

  private clearRoundTimer(pin: string) {
    clearTimeout(this.roundTimers.get(pin));
    this.roundTimers.delete(pin);
  }

  // ── Presence ─────────────────────────────────────────────────────────────

  private onDisconnect(socketId: string) {
    const ctx = this.registry.detachSocket(socketId);
    if (!ctx) return;
    const { room, player } = ctx;
    this.broadcastRoom(room);

    // Keep the seat for a while so a brief network drop or app switch isn't fatal.
    clearTimeout(this.disconnectTimers.get(player.id));
    this.disconnectTimers.set(
      player.id,
      setTimeout(() => {
        this.disconnectTimers.delete(player.id);
        if (!player.connected && room.players.includes(player)) this.removePlayer(room, player.id);
      }, this.graceMs)
    );
  }

  private resume(socket: Socket, data: Payload<"resume-session">) {
    const ctx = this.registry.resume(data.pin, data.playerId, data.resumeToken, socket.id);
    if (!ctx) {
      socket.emit("resume-failed", { message: "This game is no longer available" });
      return;
    }
    const { room, player } = ctx;
    clearTimeout(this.disconnectTimers.get(player.id));
    this.disconnectTimers.delete(player.id);
    socket.join(room.pin);

    socket.emit("session-resumed", {
      pin: room.pin,
      room: this.registry.publicRoom(room),
      playerId: player.id,
      resumeToken: player.resumeToken,
      uploadToken: player.uploadToken,
    });

    // Replay what the player missed while offline.
    this.sendRoomKey(player);
    this.requestRoomKeyFor(room, player);
    if (player.hasRoomKey) {
      // They may be the only one able to share it with players still waiting.
      for (const other of room.players) {
        if (!other.hasRoomKey && other.publicKey && player.socketId) {
          this.io.to(player.socketId).emit("key-request", { playerId: other.id, publicKey: other.publicKey });
        }
      }
    }
    if (room.gameState === "syncing" && room.syncStage === "collecting") {
      this.requestUploads(room, player);
    } else if (room.gameState === "syncing" && !room.readyPlayers.has(player.id)) {
      socket.emit("sync-media", { media: this.publicDeck(room), count: room.deck.length });
    } else if (room.gameState === "playing" && room.currentMedia) {
      socket.emit("new-round", this.roundPayload(room));
      const afterRound = room.phase !== null && room.phase !== "round";
      if (afterRound && room.lastRoundResult) socket.emit("round-result", room.lastRoundResult);
      this.replayExtra(room, player);
    } else if (room.gameState === "finished" && room.finalResult) {
      socket.emit("game-finished", room.finalResult);
    }
    this.broadcastRoom(room);
  }

  /** Explicit leave: immediate removal, no grace period. */
  private leave({ room, player }: PlayerContext) {
    if (player.socketId) this.io.sockets.sockets.get(player.socketId)?.leave(room.pin);
    this.removePlayer(room, player.id);
  }

  private removePlayer(room: Room, playerId: string) {
    clearTimeout(this.disconnectTimers.get(playerId));
    this.disconnectTimers.delete(playerId);
    const { roomDeleted } = this.registry.removePlayer(room, playerId);
    if (roomDeleted) {
      this.clearRoundTimer(room.pin);
      return;
    }

    this.io.to(room.pin).emit("player-left", { playerId, players: this.registry.publicRoom(room).players });
    this.broadcastRoom(room);

    // Re-check anything that may have been waiting on this player.
    this.finishCollectingIfDone(room);
    this.startIfEveryoneSynced(room);
    this.endRoundIfEveryoneGuessed(room);
    this.recheckExtra(room);
    if (room.gameState === "playing" && room.players.length < 2) this.finishGame(room);
  }

  private measureLatency() {
    for (const room of this.registry.rooms.values()) {
      for (const player of room.players) {
        const socket = player.socketId ? this.io.sockets.sockets.get(player.socketId) : undefined;
        if (!socket) continue;
        const sentAt = Date.now();
        socket.timeout(2000).emit("latency-ping", (err: Error | null) => {
          if (err) return;
          const oneWay = (Date.now() - sentAt) / 2;
          player.latencyMs = Math.round(player.latencyMs * 0.7 + oneWay * 0.3);
        });
      }
    }
  }

  private closeInactiveRooms(thresholdMs: number) {
    for (const room of this.registry.inactiveRooms(thresholdMs)) {
      this.io.to(room.pin).emit("game-abandoned", { message: "Game was inactive for too long and has been closed" });
      this.io.in(room.pin).socketsLeave(room.pin);
      this.clearRoundTimer(room.pin);
      room.players.forEach((p) => clearTimeout(this.disconnectTimers.get(p.id)));
      this.registry.deleteRoom(room.pin);
    }
  }

  private broadcastRoom(room: Room) {
    if (this.registry.rooms.has(room.pin)) {
      this.io.to(room.pin).emit("room-update", this.registry.publicRoom(room));
    }
  }
}

function clientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || socket.handshake.address;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
