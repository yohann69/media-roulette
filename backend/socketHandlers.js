const { calculateAndEmitRoundResults, startNewRound } = require("./gameUtils");

function setupSocket(io, gameManager, roundStartTimes) {
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
                const { pin, updatedSettings } = data;
                const room = gameManager.getRoom(pin);

                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                const isHost = room.hostSocketId === socket.id ||
                    room.players.some(p => p.socketId === socket.id && p.isHost);

                if (!isHost) {
                    socket.emit("error", { message: "Only host can start the game" });
                    return;
                }

                if (room.gameState !== "lobby") {
                    socket.emit("error", { message: "Game already started" });
                    return;
                }

                if (updatedSettings) {
                    room.settings = { ...room.settings, ...updatedSettings };
                }

                console.log(`Starting game ${pin} for host ${socket.id}`);
                gameManager.updateGameState(pin, "playing");
                gameManager.setCurrentRound(pin, 1);

                io.to(pin).emit("game-started", {
                    currentRound: 1,
                    totalRounds: room.settings.rounds,
                });

                startNewRound(pin, io, gameManager, roundStartTimes);
            } catch (error) {
                socket.emit("error", { message: "Failed to start game" });
                console.error("Error starting game:", error);
            }
        });

        socket.on("set-media-pool", (data) => {
            try {
                const { pin, mediaPool, playAgain } = data;
                const room = gameManager.getRoom(pin);

                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                if (playAgain) {
                    if (room.gameState === "finished" || room.gameState === "lobby") {
                        gameManager.resetGame(pin);
                        gameManager.setNewHost(pin, socket.id);
                    }
                } else {
                    const isHost = room.hostSocketId === socket.id ||
                        room.players.some(p => p.socketId === socket.id && p.isHost);

                    if (!isHost) {
                        socket.emit("error", { message: "Unauthorized" });
                        return;
                    }
                }

                gameManager.setMediaPool(pin, mediaPool);
                io.to(pin).emit("room-update", room);
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

                if (!room || room.gameState !== "playing") {
                    socket.emit("error", { message: "Game not in progress" });
                    return;
                }

                const roundStartTime = roundStartTimes.get(pin);
                if (!roundStartTime) {
                    socket.emit("error", { message: "Round not started" });
                    return;
                }

                gameManager.submitGuess(pin, socket.id, targetUser, timestamp, roundStartTime);
                socket.emit("guess-received", { success: true });

                const actualOwnerId = room.currentMediaOwnerId || room.players[0].socketId;
                const playersWhoShouldGuess = room.players.filter(p => p.socketId !== actualOwnerId);
                const guessesReceived = room.roundGuesses.size;

                if (guessesReceived >= playersWhoShouldGuess.length) {
                    calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
                }
            } catch (error) {
                socket.emit("error", { message: "Failed to submit guess" });
                console.error("Error submitting guess:", error);
            }
        });

        socket.on("time-expired", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room || room.gameState !== "playing") return;
                calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
            } catch (error) {
                console.error("Error handling time expiration:", error);
            }
        });

        socket.on("continue-game", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);

                if (!room || room.hostSocketId !== socket.id || room.gameState !== "playing") {
                    socket.emit("error", { message: "Invalid request" });
                    return;
                }

                calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
            } catch (error) {
                socket.emit("error", { message: "Failed to continue game" });
                console.error("Error continuing game:", error);
            }
        });

        socket.on("show-media-again", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room || room.currentMediaOwnerId !== socket.id) return;
                io.to(pin).emit("show-media-again", { mediaData: { id: room.currentMediaIndex } });
            } catch (error) {
                console.error("Error in show-media-again:", error);
            }
        });

        socket.on("hide-media-again", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room || room.currentMediaOwnerId !== socket.id) return;
                io.to(pin).emit("hide-media-again");
            } catch (error) {
                console.error("Error in hide-media-again:", error);
            }
        });

        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`);
            const result = gameManager.removePlayer(socket.id);
            if (result) {
                if (result.roomDeleted) {
                    roundStartTimes.delete(result.pin);
                    io.to(result.pin).emit("room-deleted", { message: "Host left the game" });
                } else {
                    io.to(result.pin).emit("player-left", { socketId: socket.id, players: result.room.players });
                }
            }
        });
    });
}

module.exports = setupSocket;

