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

                // Emit room-update to all clients (including the new joiner) for auto-refresh
                io.to(pin).emit("room-update", room);
            } catch (error) {
                socket.emit("error", { message: "Failed to join game" });
            }
        });

        // Set player state (uploading/ready)
        socket.on("set-player-state", (data) => {
            try {
                const { pin, state } = data;
                const room = gameManager.getRoom(pin);

                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                const player = room.players.find(p => p.socketId === socket.id);
                if (player) {
                    player.state = state;
                    io.to(pin).emit("room-update", room);
                }
            } catch (error) {
                socket.emit("error", { message: "Failed to set player state" });
                console.error("Error setting player state:", error);
            }
        });

        // Set media pool (after upload)
        socket.on("set-media-pool", (data) => {
            try {
                const { pin, mediaPool, playAgain } = data;
                const room = gameManager.getRoom(pin);

                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                if (playAgain && (room.gameState === "finished" || room.gameState === "lobby")) {
                    gameManager.resetGame(pin);
                    gameManager.setNewHost(pin, socket.id);
                }

                // Store uploaded media info for this player
                gameManager.setPlayerMedia(pin, socket.id, mediaPool);

                // Update player state to ready
                const player = room.players.find(p => p.socketId === socket.id);
                if (player) {
                    player.state = "ready";
                }

                io.to(pin).emit("room-update", room);
                socket.emit("media-pool-set", { success: true });
            } catch (error) {
                socket.emit("error", { message: "Failed to set media pool" });
                console.error("Error setting media pool:", error);
            }
        });

        // Host initiates sync (formerly start-game, now step 1 of start)
        socket.on("prepare-game", (data) => {
            try {
                const { pin, updatedSettings } = data;
                const room = gameManager.getRoom(pin);

                if (!room) return;

                // Only host
                const isHost = room.hostSocketId === socket.id || room.players.some(p => p.socketId === socket.id && p.isHost);
                if (!isHost) return;

                if (updatedSettings) {
                    room.settings = { ...room.settings, ...updatedSettings };
                }

                // Select media for the game
                const gameMedia = gameManager.prepareGameMedia(pin);

                // Reset the all-players-ready flag when preparing game
                if (room) {
                    room.allPlayersReadyEmitted = false;
                }

                // Send media list to all players to download
                io.to(pin).emit("sync-media", {
                    media: gameMedia,
                    count: gameMedia.length
                });

                gameManager.updateGameState(pin, "syncing");
            } catch (error) {
                console.error("Error preparing game:", error);
                socket.emit("error", { message: "Failed to prepare game" });
            }
        });

        // Client finished downloading files
        socket.on("sync-complete", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room) return;

                // Don't process if game already started
                if (room.gameState === "playing") {
                    return;
                }

                gameManager.setPlayerReady(pin, socket.id);

                // Notify host (or everyone) about progress?
                io.to(pin).emit("player-ready", {
                    socketId: socket.id,
                    readyCount: room.readyPlayers.size,
                    totalPlayers: room.players.length
                });

                // Emit room-update when player becomes ready
                io.to(pin).emit("room-update", room);

                // Check if everyone is ready and game is still in syncing state
                // Only emit once to prevent multiple game starts
                if (gameManager.areAllPlayersReady(pin) && room.gameState === "syncing" && !room.allPlayersReadyEmitted) {
                    room.allPlayersReadyEmitted = true;
                    io.to(pin).emit("all-players-ready");
                }
            } catch (error) {
                console.error("Error in sync-complete:", error);
            }
        });

        // Actually start the game (after sync)
        socket.on("start-game", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);

                if (!room) return;

                if (!gameManager.areAllPlayersReady(pin)) {
                    socket.emit("error", { message: "Not all players are ready" });
                    return;
                }

                console.log(`Starting game ${pin}`);
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

        socket.on("submit-guess", (data) => {
            try {
                const { pin, targetUser, timestamp } = data;
                const room = gameManager.getRoom(pin);

                if (!room || room.gameState !== "playing") return;

                // Don't process guesses if results have already been calculated
                if (room.roundResultsCalculated) {
                    socket.emit("guess-received", { success: false, message: "Round already ended" });
                    return;
                }

                // All players can guess anyone, including themselves
                // No restrictions on who can guess whom

                const roundStartTime = roundStartTimes.get(pin);
                if (!roundStartTime) return;

                gameManager.submitGuess(pin, socket.id, targetUser, timestamp, roundStartTime);
                socket.emit("guess-received", { success: true });

                // Check if ALL players have submitted their guesses (including the owner if they want to guess)
                const guessesReceived = room.roundGuesses.size;
                const totalPlayers = room.players.length;

                console.log(`[Game ${pin}] Player ${socket.id} submitted guess. Guesses received: ${guessesReceived}/${totalPlayers}`);

                // Only calculate results if ALL players have guessed AND results haven't been calculated yet
                if (guessesReceived >= totalPlayers && !room.roundResultsCalculated) {
                    console.log(`[Game ${pin}] All players have guessed. Calculating results...`);
                    calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
                }
            } catch (error) {
                console.error("Error in submit-guess:", error);
                socket.emit("error", { message: "Failed to submit guess" });
            }
        });

        socket.on("time-expired", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room || room.gameState !== "playing") return;

                console.log(`[Game ${pin}] Timer expired. Calculating results...`);

                // Only calculate results if they haven't been calculated yet
                // (in case all players guessed before timer expired)
                if (!room.roundResultsCalculated) {
                    calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
                }
            } catch (error) {
                console.error("Error in time-expired:", error);
            }
        });

        socket.on("continue-game", (data) => {
            try {
                const { pin } = data;
                console.log(`[Game ${pin}] Player ${socket.id} requested continue-game`);

                const room = gameManager.getRoom(pin);
                if (!room) {
                    console.error(`[Game ${pin}] Room not found`);
                    return;
                }

                // Only the media owner can continue to the next round
                const actualOwnerId = room.currentMediaOwnerId || room.players[0].socketId;
                if (socket.id !== actualOwnerId) {
                    console.warn(`[Game ${pin}] Player ${socket.id} tried to continue but is not owner (${actualOwnerId})`);
                    socket.emit("error", { message: "Only the media owner can continue" });
                    return;
                }

                // Check if game is finished
                // Rounds are 1-based. After finishing round N, currentRound is still N.
                // If currentRound >= rounds, we've completed all rounds
                console.log(`[Game ${pin}] Current round: ${room.currentRound}, Total rounds: ${room.settings.rounds}`);

                if (room.currentRound >= room.settings.rounds) {
                    console.log(`[Game ${pin}] Game finished after round ${room.currentRound}/${room.settings.rounds}`);

                    try {
                        const stats = gameManager.calculateGameStats(pin);
                        // Update game state only AFTER calculating stats to ensure all data is available
                        gameManager.updateGameState(pin, "finished");

                        console.log(`[Game ${pin}] Sending game-finished event`);
                        io.to(pin).emit("game-finished", {
                            leaderboard: gameManager.getPlayerScores(pin),
                            stats: stats,
                        });
                    } catch (statError) {
                        console.error(`[Game ${pin}] Error calculating stats:`, statError);
                        // Fallback: End game without stats if calculation fails
                        gameManager.updateGameState(pin, "finished");
                        io.to(pin).emit("game-finished", {
                            leaderboard: gameManager.getPlayerScores(pin),
                            stats: null,
                        });
                    }
                } else {
                    // Start next round
                    const nextRound = room.currentRound + 1;
                    console.log(`[Game ${pin}] Continuing to round ${nextRound}/${room.settings.rounds}`);
                    gameManager.setCurrentRound(pin, nextRound);
                    startNewRound(pin, io, gameManager, roundStartTimes);
                }
            } catch (error) {
                console.error("Error in continue-game:", error);
            }
        });

        socket.on("show-media-again", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room || room.currentMediaOwnerId !== socket.id) return;
                // Emit media ID so clients can look it up locally
                io.to(pin).emit("show-media-again", { mediaId: room.currentMediaIndex });
            } catch (error) { }
        });

        socket.on("hide-media-again", (data) => {
            try {
                const { pin } = data;
                io.to(pin).emit("hide-media-again");
            } catch (error) { }
        });

        socket.on("disconnect", () => {
            const result = gameManager.removePlayer(socket.id);
            if (result) {
                if (result.roomDeleted) {
                    roundStartTimes.delete(result.pin);
                    io.to(result.pin).emit("room-deleted", { message: "Host left the game" });
                } else {
                    io.to(result.pin).emit("player-left", { socketId: socket.id, players: result.room.players });
                    // Emit room-update to all clients for auto-refresh
                    io.to(result.pin).emit("room-update", result.room);
                }
            }
        });
    });
}

module.exports = setupSocket;
