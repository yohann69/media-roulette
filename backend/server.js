const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const GameManager = require("./GameManager");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager();

// Store round start times per room
const roundStartTimes = new Map();

app.get("/health", (req, res) => {
    res.json({ status: "ok", message: "PhotoRoulette Backend Server" });
});

io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("create-game", (data) => {
        try {
            const { hostName, settings } = data;
            const room = gameManager.createRoom(socket.id, hostName, settings);
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

    socket.on("join-game", (data) => {
        try {
            const { pin, playerName } = data;
            const result = gameManager.joinRoom(pin, socket.id, playerName);

            if (!result.success) {
                socket.emit("join-error", { message: result.error });
                return;
            }

            const room = result.room;
            socket.join(pin);

            socket.emit("joined-game", {
                pin: room.pin,
                room: {
                    pin: room.pin,
                    players: room.players,
                    settings: room.settings,
                    gameState: room.gameState,
                },
            });

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

            // Start first round
            startNewRound(pin, io, gameManager, roundStartTimes);

            console.log(`Game ${pin} started`);
        } catch (error) {
            socket.emit("error", { message: "Failed to start game" });
            console.error("Error starting game:", error);
        }
    });

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

    socket.on("submit-guess", (data) => {
        try {
            const { pin, targetUser, timestamp } = data;
            const room = gameManager.getRoom(pin);

            if (!room) {
                socket.emit("error", { message: "Room not found" });
                return;
            }

            if (room.gameState !== "playing") {
                socket.emit("error", { message: "Game not in progress" });
                return;
            }

            const roundStartTime = roundStartTimes.get(pin);
            if (!roundStartTime) {
                socket.emit("error", { message: "Round not started" });
                return;
            }

            // Submit guess
            gameManager.submitGuess(pin, socket.id, targetUser, timestamp, roundStartTime);

            socket.emit("guess-received", { success: true });

            // Check if all players have guessed (or we can wait for timer)
            // For now, we'll process when owner continues or timer expires
        } catch (error) {
            socket.emit("error", { message: "Failed to submit guess" });
            console.error("Error submitting guess:", error);
        }
    });

    socket.on("continue-game", (data) => {
        try {
            const { pin } = data;
            const room = gameManager.getRoom(pin);

            if (!room) {
                socket.emit("error", { message: "Room not found" });
                return;
            }

            if (room.hostSocketId !== socket.id) {
                socket.emit("error", { message: "Only host can continue" });
                return;
            }

            if (room.gameState !== "playing") {
                socket.emit("error", { message: "Game not in progress" });
                return;
            }

            // Get the actual owner from the stored current media
            const actualOwnerId = room.currentMediaOwnerId || room.players[0].socketId;

            const roundStartTime = roundStartTimes.get(pin) || Date.now();
            const roundResults = gameManager.calculateRoundResults(
                pin,
                actualOwnerId,
                roundStartTime
            );

            // Emit round result
            io.to(pin).emit("round-result", roundResults);

            // Check if game is finished
            if (room.currentRound >= room.settings.rounds) {
                gameManager.updateGameState(pin, "finished");
                io.to(pin).emit("game-finished", {
                    leaderboard: gameManager.getPlayerScores(pin),
                });
            } else {
                // Start next round after a delay
                setTimeout(() => {
                    gameManager.setCurrentRound(pin, room.currentRound + 1);
                    startNewRound(pin, io, gameManager, roundStartTimes);
                }, 3000); // 3 second delay between rounds
            }
        } catch (error) {
            socket.emit("error", { message: "Failed to continue game" });
            console.error("Error continuing game:", error);
        }
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
        const result = gameManager.removePlayer(socket.id);

        if (result) {
            if (result.roomDeleted) {
                roundStartTimes.delete(result.pin);
                io.to(result.pin).emit("room-deleted", {
                    message: "Host left the game",
                });
            } else {
                io.to(result.pin).emit("player-left", {
                    socketId: socket.id,
                    players: result.room.players,
                });
            }
        }
    });
});

/**
 * Start a new round - pick media and broadcast to all players
 */
function startNewRound(pin, io, gameManager, roundStartTimes) {
    const room = gameManager.getRoom(pin);
    if (!room) return;

    const media = gameManager.getRandomMedia(pin);
    if (!media) {
        io.to(pin).emit("error", { message: "No media available" });
        return;
    }

    const roundStartTime = Date.now();
    roundStartTimes.set(pin, roundStartTime);

    // Store current media owner for this round
    room.currentMediaIndex = media.index;
    room.currentMediaOwnerId = media.ownerId;

    // Get player options (all players)
    const options = room.players.map((p) => ({
        id: p.socketId,
        name: p.name,
    }));

    // Broadcast new round to all players
    io.to(pin).emit("new-round", {
        round: room.currentRound,
        totalRounds: room.settings.rounds,
        mediaData: {
            id: media.id,
            uri: media.uri || media.base64,
            base64: media.base64,
            mediaType: media.mediaType,
        },
        duration: room.settings.timer,
        options,
        roundStartTime,
    });

    console.log(`Round ${room.currentRound} started for game ${pin}`);
}

const PORT = process.env.PORT || 6969;

server.listen(PORT, () => {
    console.log(`🚀 PhotoRoulette Backend Server running on port ${PORT}`);
    console.log(`📡 Socket.io server ready for connections`);
});
