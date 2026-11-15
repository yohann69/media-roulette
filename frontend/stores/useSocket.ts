import { create } from "zustand";
import { AppState } from "react-native";
import { io, Socket } from "socket.io-client";
import { fromBase64, generateKeyPair, generateRoomKey, openRoomKey, sealRoomKey, toBase64, type KeyPair } from "../utils/e2e";
import { clearGameMedia, clearPrepared } from "../utils/gameMedia";

export type PlayerState = "selecting" | "compressing" | "uploading" | "ready";

export interface RoomPlayer {
  /** Stable player id (survives reconnects). */
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  state: PlayerState;
  /** False while the player is temporarily offline. */
  connected: boolean;
  /** Number of media items the player has confirmed. */
  mediaCount: number;
  /** X25519 public key (base64) used to receive the room key. */
  publicKey: string | null;
  /** Whether the player can decrypt this game's media yet. */
  hasRoomKey: boolean;
  /** Games won and points scored across rematches in this room. */
  seriesWins?: number;
  seriesScore?: number;
}

export interface Room {
  pin: string;
  players: RoomPlayer[];
  settings: {
    rounds: number;
    timer: number;
    mode: string;
    playVideoWithSound?: boolean;
    blindMode?: boolean;
    timeMachine?: boolean;
    slowReveal?: boolean;
    /** Party extras, every few rounds. */
    captionThis?: boolean;
    storyTime?: boolean;
  };
  gameState: "lobby" | "syncing" | "playing" | "finished";
  /** Games finished in this room (rematches keep the room). */
  gamesPlayed?: number;
}



/** What the server needs to let us back into a game after a disconnect. */
interface Session {
  pin: string;
  playerId: string;
  resumeToken: string;
  uploadToken: string;
}

interface JoinPayload extends Session {
  room: Room;
}

export type UploadStage = "idle" | "compressing" | "uploading";

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connectionFailed: boolean;
  room: Room | null;
  /** Our stable player id in the current room. */
  currentPlayerId: string | null;
  session: Session | null;
  /** Authorizes our media uploads/downloads for the current room. */
  uploadToken: string | null;
  /** Key that encrypts this room's media end to end. Never sent to the server in clear. */
  roomKey: Uint8Array | null;
  /** Our own compressed media, by local id, waiting to be shared if chosen for the game. */
  preparedMedia: Map<string, { uri: string; mediaType: "photo" | "video" }>;
  /** Files we uploaded this game (server filename → local id), so we never download our own. */
  myUploads: Map<string, string>;
  localMediaMap: Map<number, string>; // media index -> local file URI
  /**
   * Latest "new-round" payload. The first round can arrive before the game screen
   * has mounted (and a resumed session replays it), so screens read it on mount.
   */
  lastNewRound: any | null;
  uploadStage: UploadStage;
  uploadProgress: number; // 0..1
  /** True when we lost our seat in a game (resume failed or the room is gone). */
  wasKicked: boolean;
  /** True when the host removed us from the lobby. */
  removedByHost: boolean;

  connect: () => void;
  disconnect: () => void;
  /** Listens to a server event. Returns a function that removes the listener. */
  subscribe: (event: string, handler: (...args: any[]) => void) => () => void;
  setUploadStatus: (stage: UploadStage, progress: number) => void;
  setLocalMediaMap: (map: Map<number, string>) => void;
  setPreparedMedia: (media: Map<string, { uri: string; mediaType: "photo" | "video" }>) => void;
  clearKicked: () => void;

  createGame: (hostName: string, settings: any) => Promise<string | null>;
  joinGame: (pin: string, playerName: string) => Promise<boolean>;
  leaveGame: (pin: string) => Promise<void>;
  setPlayerState: (pin: string, state: PlayerState) => Promise<void>;
  setMediaPool: (pin: string, mediaPool: any[], playAgain?: boolean) => Promise<boolean>;
  prepareGame: (pin: string, updatedSettings?: any) => Promise<void>;
  notifySyncComplete: (pin: string) => Promise<void>;
  submitGuess: (pin: string, targetUser: string, displayDelayMs?: number) => Promise<boolean>;
  /** Time Machine: our guess of the year the media was taken. */
  submitYear: (pin: string, year: number, displayDelayMs?: number) => void;
  /** Host only: removes a player from the lobby. */
  kickPlayer: (pin: string, playerId: string) => void;
  /** Host, in the lobby: turns the party extras on or off. */
  updateExtras: (pin: string, extras: { captionThis?: boolean; storyTime?: boolean }) => void;
  submitCaption: (pin: string, text: string) => Promise<boolean>;
  voteCaption: (pin: string, captionId: string) => void;
  applaud: (pin: string) => void;
  endStory: (pin: string) => void;
  continueGame: (pin: string) => Promise<boolean>;
  showMediaAgain: (pin: string) => void;
  /** Hides our own media during its round (the round is dropped). */
  skipMedia: (pin: string) => void;
  hideMediaAgain: (pin: string) => void;
  playAgain: (pin: string) => Promise<boolean>;
}

// Override with EXPO_PUBLIC_SERVER_URL (e.g. in .env.local) to use a self-hosted or local server.
export const SOCKET_URL = process.env.EXPO_PUBLIC_SERVER_URL || "https://backend-production-1f8a.up.railway.app";

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Emits `event` and resolves with the first of `success` / `failure` events.
 * Every listener and the timeout are always cleaned up.
 */
function request<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  success: string,
  failures: string[] = ["error"],
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<{ ok: true; data: T } | { ok: false }> {
  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(success, onSuccess);
      failures.forEach((f) => socket.off(f, onFailure));
    };
    const onSuccess = (data: T) => {
      cleanup();
      resolve({ ok: true, data });
    };
    const onFailure = () => {
      cleanup();
      resolve({ ok: false });
    };
    const timer = setTimeout(onFailure, timeoutMs);
    socket.once(success, onSuccess);
    failures.forEach((f) => socket.once(f, onFailure));
    socket.emit(event, payload);
  });
}

// One key pair per app session: its public half lets other players seal the room key for us.
let keyPair: KeyPair | null = null;
const myKeyPair = () => (keyPair ??= generateKeyPair());

const EMPTY_GAME_STATE = {
  room: null,
  currentPlayerId: null,
  session: null,
  uploadToken: null,
  roomKey: null,
  preparedMedia: new Map<string, { uri: string; mediaType: "photo" | "video" }>(),
  myUploads: new Map<string, string>(),
  localMediaMap: new Map<number, string>(),
  lastNewRound: null,
  uploadStage: "idle" as UploadStage,
  uploadProgress: 0,
};

export const useSocket = create<SocketState>((set, get) => {
  /** Stores what the server sent when we created, joined or resumed a game. */
  const enterRoom = (data: JoinPayload) => {
    const session: Session = {
      pin: data.pin,
      playerId: data.playerId,
      resumeToken: data.resumeToken,
      uploadToken: data.uploadToken,
    };
    set({ room: data.room, session, currentPlayerId: data.playerId, uploadToken: data.uploadToken });
  };

  /** Leaves the game's state behind, deleting media files left on the phone. */
  const resetGame = (extra: Partial<SocketState> = {}) => {
    const pin = get().room?.pin;
    if (pin) clearGameMedia(pin);
    clearPrepared();
    set({ ...EMPTY_GAME_STATE, localMediaMap: new Map(), preparedMedia: new Map(), myUploads: new Map(), ...extra });
  };

  const loseRoom = () => resetGame({ wasKicked: true });

  return {
    socket: null,
    isConnected: false,
    connectionFailed: false,
    wasKicked: false,
    removedByHost: false,
    ...EMPTY_GAME_STATE,

    connect: () => {
      const existing = get().socket;
      if (existing) {
        if (!existing.connected) existing.connect();
        return;
      }

      set({ connectionFailed: false });
      let connectionErrorCount = 0;

      const socket = io(SOCKET_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity,
      });

      socket.on("connect", () => {
        connectionErrorCount = 0;
        set({ isConnected: true, connectionFailed: false });
        // Back after a drop (network change, app in background...): take our seat back.
        const { session } = get();
        if (session) socket.emit("resume-session", session);
      });

      socket.on("disconnect", () => set({ isConnected: false }));

      socket.on("connect_error", () => {
        connectionErrorCount++;
        set({ isConnected: false });
        if (connectionErrorCount >= 3) set({ connectionFailed: true });
      });

      // Lets the server measure our network delay, for fair answer times.
      socket.on("latency-ping", (ack?: () => void) => ack?.());

      // Room state is kept current here, whatever screen is showing.
      socket.on("room-update", (room: Room) => {
        if (get().room?.pin === room.pin) set({ room });
      });
      socket.on("session-resumed", (data: JoinPayload) => enterRoom(data));
      socket.on("resume-failed", loseRoom);
      socket.on("game-abandoned", loseRoom);
      socket.on("kicked", () => resetGame({ wasKicked: true, removedByHost: true }));
      // Remember when the round arrived: time spent before it's on screen (e.g. while
      // switching to the game screen) is reported to the server.
      socket.on("new-round", (data: any) => set({ lastNewRound: { ...data, receivedAt: Date.now() } }));
      socket.on("game-finished", () => {
        // Our own prepared copies aren't needed any more either.
        clearPrepared();
        set({ lastNewRound: null, preparedMedia: new Map(), myUploads: new Map() });
      });

      // Someone joined without the room key: if we have it, seal it for them.
      socket.on("key-request", ({ playerId, publicKey }: { playerId: string; publicKey: string }) => {
        const { roomKey, session } = get();
        if (!roomKey || !session) return;
        const sealed = sealRoomKey(roomKey, fromBase64(publicKey), myKeyPair().secretKey);
        socket.emit("share-room-key", { pin: session.pin, to: playerId, sealed });
      });

      // The room key, sealed for us by another player.
      socket.on("room-key", ({ from, sealed }: { from: string; sealed: string }) => {
        const sender = get().room?.players.find((p) => p.id === from);
        if (!sender?.publicKey || get().roomKey) return;
        try {
          set({ roomKey: openRoomKey(sealed, fromBase64(sender.publicKey), myKeyPair().secretKey) });
        } catch (error) {
          console.warn("Could not open the room key:", error);
        }
      });

      // Coming back to the foreground: a connection that died while the phone was
      // locked may still look open. Check it right away instead of waiting for the
      // heartbeat, and reconnect (then resume) if it doesn't answer.
      AppState.addEventListener("change", (state) => {
        if (state !== "active") return;
        if (!socket.connected) {
          socket.connect();
          return;
        }
        socket.timeout(2000).emit("client-ping", (err: Error | null) => {
          if (err) {
            socket.disconnect();
            socket.connect();
          }
        });
      });

      set({ socket });
    },

    disconnect: () => {
      get().socket?.disconnect();
      resetGame({ socket: null, isConnected: false, connectionFailed: false, wasKicked: false });
    },

    subscribe: (event, handler) => {
      const socket = get().socket;
      if (!socket) return () => {};
      socket.on(event, handler);
      return () => {
        socket.off(event, handler);
      };
    },

    setUploadStatus: (stage, progress) => {
      set({ uploadStage: stage, uploadProgress: Math.max(0, Math.min(1, progress)) });
    },

    setLocalMediaMap: (map) => set({ localMediaMap: map }),

    setPreparedMedia: (media) => set({ preparedMedia: media, myUploads: new Map() }),

    clearKicked: () => set({ wasKicked: false, removedByHost: false }),

    createGame: async (hostName, settings) => {
      const { socket } = get();
      if (!socket?.connected) return null;
      const publicKey = toBase64(myKeyPair().publicKey);
      const res = await request<JoinPayload>(socket, "create-game", { hostName, settings, publicKey }, "game-created");
      if (!res.ok) return null;
      enterRoom(res.data);
      // As host, our phone creates the key that encrypts this game's media.
      set({ roomKey: generateRoomKey() });
      return res.data.pin;
    },

    joinGame: async (pin, playerName) => {
      const { socket } = get();
      if (!socket?.connected) return false;
      const publicKey = toBase64(myKeyPair().publicKey);
      const res = await request<JoinPayload>(socket, "join-game", { pin, playerName, publicKey }, "joined-game", ["join-error", "error"]);
      if (!res.ok) return false;
      enterRoom(res.data);
      return true;
    },

    leaveGame: async (pin) => {
      get().socket?.emit("leave-game", { pin });
      resetGame();
    },

    setPlayerState: async (pin, state) => {
      get().socket?.emit("set-player-state", { pin, state });
    },

    setMediaPool: async (pin, mediaPool, playAgain) => {
      const { socket } = get();
      if (!socket?.connected) return false;
      const res = await request<{ success: boolean }>(
        socket,
        "set-media-pool",
        { pin, mediaPool, playAgain: !!playAgain },
        "media-pool-set",
        ["error"],
        15000
      );
      return res.ok && res.data.success;
    },

    prepareGame: async (pin, updatedSettings) => {
      get().socket?.emit("prepare-game", { pin, updatedSettings });
    },

    notifySyncComplete: async (pin) => {
      get().socket?.emit("sync-complete", { pin });
    },

    submitGuess: async (pin, targetUser, displayDelayMs) => {
      const { socket } = get();
      if (!socket?.connected) return false;
      const res = await request<{ success: boolean }>(
        socket,
        "submit-guess",
        { pin, targetUser, displayDelayMs },
        "guess-received"
      );
      return res.ok && res.data.success;
    },

    submitYear: (pin, year, displayDelayMs) => {
      get().socket?.emit("submit-guess", { pin, year, displayDelayMs });
    },

    kickPlayer: (pin, playerId) => {
      get().socket?.emit("kick-player", { pin, playerId });
    },

    updateExtras: (pin, extras) => {
      get().socket?.emit("update-extras", { pin, ...extras });
    },

    submitCaption: async (pin, text) => {
      const { socket } = get();
      if (!socket?.connected) return false;
      const res = await request(socket, "submit-caption", { pin, text }, "caption-received");
      return res.ok;
    },

    voteCaption: (pin, captionId) => {
      get().socket?.emit("vote-caption", { pin, captionId });
    },

    applaud: (pin) => {
      get().socket?.emit("applaud", { pin });
    },

    endStory: (pin) => {
      get().socket?.emit("end-story", { pin });
    },

    continueGame: async (pin) => {
      const { socket } = get();
      if (!socket?.connected) return false;
      socket.emit("continue-game", { pin });
      return true;
    },

    skipMedia: (pin) => {
      get().socket?.emit("skip-media", { pin });
    },

    showMediaAgain: (pin) => {
      get().socket?.emit("show-media-again", { pin });
    },

    hideMediaAgain: (pin) => {
      get().socket?.emit("hide-media-again", { pin });
    },

    playAgain: async (pin) => {
      const { socket } = get();
      if (!socket?.connected) return false;
      const res = await request(socket, "play-again", { pin }, "play-again-initiated");
      return res.ok;
    },
  };
});
