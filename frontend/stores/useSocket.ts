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
        state?: "selecting" | "ready";
    }>;
    settings: {
        rounds: number;
        timer: number;
        mode: string;
        playVideoWithSound?: boolean;
        blindMode?: boolean;
    };
    gameState: "lobby" | "syncing" | "playing" | "finished";
}

interface SocketState {
    socket: Socket | null;
    isConnected: boolean;
    connectionFailed: boolean;
    room: Room | null;
    currentPlayerId: string | null;
    localMediaMap: Map<number, string>; // index -> local file URI
    connect: () => void;
    disconnect: () => void;
    createGame: (hostName: string, settings: any) => Promise<string | null>;
    joinGame: (pin: string, playerName: string) => Promise<boolean>;
    leaveGame: (pin: string) => Promise<void>;
    setPlayerState: (pin: string, state: "selecting" | "uploading" | "ready") => Promise<void>;
    setMediaPool: (pin: string, mediaPool: any[], playAgain?: boolean) => Promise<boolean>;
    prepareGame: (pin: string, updatedSettings?: any) => Promise<void>;
    notifySyncComplete: (pin: string) => Promise<void>;
    startGame: (pin: string) => Promise<boolean>;
    setLocalMediaMap: (map: Map<number, string>) => void;
  submitGuess: (pin: string, targetUser: string, timestamp: number) => Promise<boolean>;
  continueGame: (pin: string) => Promise<boolean>;
  notifyTimeExpired: (pin: string) => Promise<void>;
  showMediaAgain: (pin: string) => void;
  hideMediaAgain: (pin: string) => void;
  onPlayerJoined: (callback: (data: any) => void) => void;
    onPlayerLeft: (callback: (data: any) => void) => void;
    onSyncMedia: (callback: (data: any) => void) => void;
    onPlayerReady: (callback: (data: any) => void) => void;
    onAllPlayersReady: (callback: (data: any) => void) => void;
    onGameStarted: (callback: (data: any) => void) => void;
           onNewRound: (callback: (data: any) => void) => void;
           onRoundResult: (callback: (data: any) => void) => void;
           onGameFinished: (callback: (data: any) => void) => void;
           onRoomDeleted: (callback: (data: any) => void) => void;
           onRoomUpdate: (callback: (data: any) => void) => void;
    onShowMediaAgain: (callback: (data: any) => void) => void;
    onHideMediaAgain: (callback: () => void) => void;
           cleanup: () => void;
}

export const SOCKET_URL = "https://backend-production-1f8a.up.railway.app";

function createSocketHandlers(set: any, get: any) {
    let connectionErrorCount = 0;
    const MAX_CONNECTION_ERRORS = 3;

    return {
        connect: () => {
            const { socket } = get();
            if (socket?.connected) return;

            // Reset connection failed state when attempting to connect
            set({ connectionFailed: false });

            const newSocket = io(SOCKET_URL, {
                transports: ["websocket"],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5,
            });

            newSocket.on("connect", () => {
                connectionErrorCount = 0; // Reset on successful connection
                set({ socket: newSocket, isConnected: true, connectionFailed: false, currentPlayerId: newSocket.id });
            });

            newSocket.on("disconnect", () => {
                set({ isConnected: false });
            });

            newSocket.on("connect_error", () => {
                connectionErrorCount++;
                set({ isConnected: false });
                
                // Only set connection failed after multiple failed attempts
                if (connectionErrorCount >= MAX_CONNECTION_ERRORS) {
                    set({ connectionFailed: true });
                }
            });

            // Listen for reconnection attempts
            newSocket.on("reconnect_attempt", () => {
                // Silently retrying, no UI feedback needed
            });

            set({ socket: newSocket });
        },

        disconnect: () => {
            const { socket } = get();
            if (socket) {
                socket.disconnect();
                set({ socket: null, isConnected: false, connectionFailed: false, room: null, currentPlayerId: null, localMediaMap: new Map() });
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

        leaveGame: async (pin: string): Promise<void> => {
            const { socket } = get();
            if (!socket?.connected) return;
            
            socket.emit("leave-game", { pin });
            // Clear room state when leaving
            set({ room: null });
        },

        setPlayerState: async (pin: string, state: "selecting" | "uploading" | "ready"): Promise<void> => {
            const { socket } = get();
            if (!socket?.connected) return;
            socket.emit("set-player-state", { pin, state });
        },

        setMediaPool: async (pin: string, mediaPool: any[], playAgain?: boolean): Promise<boolean> => {
            const { socket } = get();
            if (!socket?.connected) return false;

            return new Promise((resolve) => {
                socket.emit("set-media-pool", { pin, mediaPool, playAgain: !!playAgain });
                socket.once("media-pool-set", (data: { success: boolean }) => resolve(data.success));
                socket.once("error", () => resolve(false));
                setTimeout(() => resolve(false), 15000);
            });
        },

        prepareGame: async (pin: string, updatedSettings?: any): Promise<void> => {
            const { socket } = get();
            if (!socket?.connected) return;
            socket.emit("prepare-game", { pin, updatedSettings });
        },

        notifySyncComplete: async (pin: string): Promise<void> => {
             const { socket } = get();
            if (!socket?.connected) return;
            socket.emit("sync-complete", { pin });
        },

        startGame: async (pin: string): Promise<boolean> => {
            const { socket } = get();
            if (!socket?.connected) return false;

            return new Promise((resolve) => {
                socket.emit("start-game", { pin });
                socket.once("game-started", (data: any) => resolve(true));
                socket.once("error", () => resolve(false));
            });
        },
        
        setLocalMediaMap: (map: Map<number, string>) => {
            set({ localMediaMap: map });
        },

        submitGuess: async (pin: string, targetUser: string, timestamp: number): Promise<boolean> => {
            const { socket } = get();
            if (!socket?.connected) return false;

            return new Promise((resolve) => {
                socket.emit("submit-guess", { pin, targetUser, timestamp });
                socket.once("guess-received", (data: { success: boolean }) => resolve(data.success));
                socket.once("error", () => resolve(false));
                setTimeout(() => resolve(false), 5000);
            });
        },

        continueGame: async (pin: string): Promise<boolean> => {
            const { socket } = get();
            if (!socket?.connected) return false;

            return new Promise((resolve) => {
                socket.emit("continue-game", { pin });
                socket.once("error", () => resolve(false));
                setTimeout(() => resolve(true), 1000);
            });
        },

        notifyTimeExpired: async (pin: string): Promise<void> => {
            const { socket } = get();
            if (!socket?.connected) return;

            socket.emit("time-expired", { pin });
        },

        showMediaAgain: (pin: string) => {
            const { socket } = get();
            if (!socket?.connected) return;
            socket.emit("show-media-again", { pin });
        },

        hideMediaAgain: (pin: string) => {
            const { socket } = get();
            if (!socket?.connected) return;
            socket.emit("hide-media-again", { pin });
        },
    };
}

function createEventHandlers(get: any, set: any) {
    return {
        onPlayerJoined: (callback: (data: any) => void) => {
            get().socket?.on("player-joined", (data: any) => {
                const { room } = get();
                if (room) set({ room: { ...room, players: data.players } });
                callback(data);
            });
        },

        onPlayerLeft: (callback: (data: any) => void) => {
            get().socket?.on("player-left", (data: any) => {
                const { room } = get();
                if (room) set({ room: { ...room, players: data.players } });
                callback(data);
            });
        },
        
        onSyncMedia: (callback: (data: any) => void) => {
            get().socket?.on("sync-media", callback);
        },

        onPlayerReady: (callback: (data: any) => void) => {
            get().socket?.on("player-ready", callback);
        },

        onAllPlayersReady: (callback: (data: any) => void) => {
            get().socket?.on("all-players-ready", callback);
        },

        onGameStarted: (callback: (data: any) => void) => {
            get().socket?.on("game-started", callback);
        },

        onNewRound: (callback: (data: any) => void) => {
            get().socket?.on("new-round", callback);
        },

        onRoundResult: (callback: (data: any) => void) => {
            get().socket?.on("round-result", callback);
        },

        onGameFinished: (callback: (data: any) => void) => {
            get().socket?.on("game-finished", callback);
        },

        onRoomDeleted: (callback: (data: any) => void) => {
            get().socket?.on("room-deleted", (data: any) => {
                set({ room: null });
                callback(data);
            });
        },

        onRoomUpdate: (callback: (data: any) => void) => {
            get().socket?.on("room-update", (data: Room) => {
                set({ room: data });
                callback(data);
            });
        },

        onShowMediaAgain: (callback: (data: any) => void) => {
            get().socket?.on("show-media-again", callback);
        },

        onHideMediaAgain: (callback: () => void) => {
            get().socket?.on("hide-media-again", callback);
        },

        cleanup: () => {
            get().socket?.removeAllListeners();
        },
    };
}

export const useSocket = create<SocketState>((set, get) => ({
    socket: null,
    isConnected: false,
    connectionFailed: false,
    room: null,
    currentPlayerId: null,
    localMediaMap: new Map(),
    ...createSocketHandlers(set, get),
    ...createGameHandlers(get, set),
    ...createEventHandlers(get, set),
}));
