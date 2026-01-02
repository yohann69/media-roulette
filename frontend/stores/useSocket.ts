import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { processMediaPool } from "../utils/mediaConverter";

interface Room {
  pin: string;
  players: Array<{
    socketId: string;
    name: string;
    isHost: boolean;
    score: number;
  }>;
  settings: {
    rounds: number;
    timer: number;
    mode: string;
  };
  gameState: "lobby" | "playing" | "finished";
}

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  room: Room | null;
  currentPlayerId: string | null;
  connect: () => void;
  disconnect: () => void;
  createGame: (hostName: string, settings: any) => Promise<string | null>;
  joinGame: (pin: string, playerName: string) => Promise<boolean>;
  setMediaPool: (pin: string, mediaPool: any[]) => Promise<boolean>;
  startGame: (pin: string) => Promise<boolean>;
  onPlayerJoined: (callback: (data: any) => void) => void;
  onPlayerLeft: (callback: (data: any) => void) => void;
  onGameStarted: (callback: (data: any) => void) => void;
  onRoomDeleted: (callback: (data: any) => void) => void;
  cleanup: () => void;
}

const SOCKET_URL = "http://localhost:6969";

function createSocketHandlers(set: any, get: any) {
  return {
    connect: () => {
      const { socket } = get();
      if (socket?.connected) return;

      const newSocket = io(SOCKET_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      newSocket.on("connect", () => {
        set({ socket: newSocket, isConnected: true, currentPlayerId: newSocket.id });
      });

      newSocket.on("disconnect", () => set({ isConnected: false }));
      newSocket.on("connect_error", () => set({ isConnected: false }));

      set({ socket: newSocket });
    },

    disconnect: () => {
      const { socket } = get();
      if (socket) {
        socket.disconnect();
        set({ socket: null, isConnected: false, room: null, currentPlayerId: null });
      }
    },
  };
}

function createGameHandlers(get: any, set: any) {
  return {
    createGame: async (hostName: string, settings: any): Promise<string | null> => {
      const { socket } = get();
      if (!socket?.connected) return null;

      return new Promise((resolve) => {
        socket.emit("create-game", { hostName, settings });
        socket.once("game-created", (data: { pin: string; room: Room }) => {
          set({ room: data.room });
          resolve(data.pin);
        });
        socket.once("error", () => resolve(null));
        setTimeout(() => resolve(null), 5000);
      });
    },

    joinGame: async (pin: string, playerName: string): Promise<boolean> => {
      const { socket } = get();
      if (!socket?.connected) return false;

      return new Promise((resolve) => {
        socket.emit("join-game", { pin, playerName });
        socket.once("joined-game", (data: { pin: string; room: Room }) => {
          set({ room: data.room });
          resolve(true);
        });
        socket.once("join-error", () => resolve(false));
        socket.once("error", () => resolve(false));
        setTimeout(() => resolve(false), 5000);
      });
    },

    setMediaPool: async (pin: string, mediaPool: any[]): Promise<boolean> => {
      const { socket } = get();
      if (!socket?.connected) return false;

      const processedMedia = await processMediaPool(mediaPool);

      return new Promise((resolve) => {
        socket.emit("set-media-pool", { pin, mediaPool: processedMedia });
        socket.once("media-pool-set", (data: { success: boolean }) => resolve(data.success));
        socket.once("error", () => resolve(false));
        setTimeout(() => resolve(false), 10000);
      });
    },

    startGame: async (pin: string): Promise<boolean> => {
      const { socket } = get();
      if (!socket?.connected) return false;

      return new Promise((resolve) => {
        socket.emit("start-game", { pin });
        socket.once("game-started", () => resolve(true));
        socket.once("error", () => resolve(false));
        setTimeout(() => resolve(false), 5000);
      });
    },
  };
}

function createEventHandlers(get: any, set: any) {
  return {
    onPlayerJoined: (callback: (data: any) => void) => {
      const { socket } = get();
      socket?.on("player-joined", (data) => {
        const { room } = get();
        if (room) set({ room: { ...room, players: data.players } });
        callback(data);
      });
    },

    onPlayerLeft: (callback: (data: any) => void) => {
      const { socket } = get();
      socket?.on("player-left", (data) => {
        const { room } = get();
        if (room) set({ room: { ...room, players: data.players } });
        callback(data);
      });
    },

    onGameStarted: (callback: (data: any) => void) => {
      get().socket?.on("game-started", callback);
    },

    onRoomDeleted: (callback: (data: any) => void) => {
      const { socket } = get();
      socket?.on("room-deleted", (data) => {
        set({ room: null });
        callback(data);
      });
    },

    cleanup: () => {
      get().socket?.removeAllListeners();
    },
  };
}

export const useSocket = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  room: null,
  currentPlayerId: null,
  ...createSocketHandlers(set, get),
  ...createGameHandlers(get, set),
  ...createEventHandlers(get, set),
}));
