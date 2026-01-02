const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const GameManager = require("./GameManager");

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // In production, specify your frontend URL
        methods: ["GET", "POST"],
        credentials: true,
    },
});

// Configure CORS for Express
app.use(cors());
app.use(express.json());

// Initialize Game Manager
const gameManager = new GameManager();

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "PhotoRoulette Backend Server" });
});

// Socket.io connection handling
io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Create a new game room
    socket.on("create-game", (data) => {
        try {
            const { hostName, settings } = data;
            const room = gameManager.createRoom(socket.id, hostName, settings);

            // Join socket room
            socket.join(room.pin);

            socket.emit("game-created", {
                pin: room.pin,
                room: {
                    pin: room.pin,
                    players: room.players,
                    settings: room.settings,
                    gameState: room.gameState,
                },
            });

            console.log(`Game created: PIN ${room.pin} by ${hostName}`);
        } catch (error) {
            socket.emit("error", { message: "Failed to create game" });
            console.error("Error creating game:", error);
        }
    });

    // Join an existing game
    socket.on("join-game", (data) => {
        try {
            const { pin, playerName } = data;
            const result = gameManager.joinRoom(pin, socket.id, playerName);

            if (!result.success) {
                socket.emit("join-error", { message: result.error });
                return;
            }

            const room = result.room;

            // Join socket room
            socket.join(pin);

            // Notify the joining player
            socket.emit("joined-game", {
                pin: room.pin,
                room: {
                    pin: room.pin,
                    players: room.players,
                    settings: room.settings,
                    gameState: room.gameState,
                },
            });

            // Notify all other players in the room
            socket.to(pin).emit("player-joined", {
                player: {
                    socketId: socket.id,
                    name: playerName,
                    isHost: false,
                },
                players: room.players,
            });

            console.log(`${playerName} joined game ${pin}`);
        } catch (error) {
            socket.emit("error", { message: "Failed to join game" });
            console.error("Error joining game:", error);
        }
    });

    // Start the game
    socket.on("start-game", (data) => {
        try {
            const { pin } = data;
            const room = gameManager.getRoom(pin);

            if (!room) {
                socket.emit("error", { message: "Room not found" });
                return;
            }

            if (room.hostSocketId !== socket.id) {
                socket.emit("error", { message: "Only host can start the game" });
                return;
            }

            if (room.gameState !== "lobby") {
                socket.emit("error", { message: "Game already started" });
                return;
            }

            gameManager.updateGameState(pin, "playing");
            gameManager.setCurrentRound(pin, 1);

            // Notify all players
            io.to(pin).emit("game-started", {
                currentRound: 1,
                totalRounds: room.settings.rounds,
            });

            console.log(`Game ${pin} started`);
        } catch (error) {
            socket.emit("error", { message: "Failed to start game" });
            console.error("Error starting game:", error);
        }
    });

    // Set media pool
    socket.on("set-media-pool", (data) => {
        try {
            const { pin, mediaPool } = data;
            const room = gameManager.getRoom(pin);

            if (!room || room.hostSocketId !== socket.id) {
                socket.emit("error", { message: "Unauthorized" });
                return;
            }

            gameManager.setMediaPool(pin, mediaPool);
            socket.emit("media-pool-set", { success: true });
        } catch (error) {
            socket.emit("error", { message: "Failed to set media pool" });
            console.error("Error setting media pool:", error);
        }
    });

    // Player makes a guess
    socket.on("player-guess", (data) => {
        try {
            const { pin, guessedPlayerId, timeTaken } = data;
            const room = gameManager.getRoom(pin);

            if (!room) {
                socket.emit("error", { message: "Room not found" });
                return;
            }

            // Calculate score (this would use the scoring formula)
            // For now, we'll just store the guess
            socket.emit("guess-received", { success: true });

            // Notify other players (if needed)
            socket.to(pin).emit("player-guessed", {
                playerId: socket.id,
            });
        } catch (error) {
            socket.emit("error", { message: "Failed to process guess" });
            console.error("Error processing guess:", error);
        }
    });

    // Disconnect handling
    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
        const result = gameManager.removePlayer(socket.id);

        if (result) {
            if (result.roomDeleted) {
                // Notify all players in the room that it was deleted
                io.to(result.pin).emit("room-deleted", {
                    message: "Host left the game",
                });
            } else {
                // Notify remaining players
                io.to(result.pin).emit("player-left", {
                    socketId: socket.id,
                    players: result.room.players,
                });
            }
        }
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`🚀 PhotoRoulette Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for connections`);
});

