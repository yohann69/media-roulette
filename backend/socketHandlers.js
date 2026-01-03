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
            } catch (error) {
                socket.emit("error", { message: "Failed to join game" });
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

                gameManager.setPlayerReady(pin, socket.id);

                // Notify host (or everyone) about progress?
                io.to(pin).emit("player-ready", { 
                    socketId: socket.id,
                    readyCount: room.readyPlayers.size,
                    totalPlayers: room.players.length
                });

                // Check if everyone is ready
                if (gameManager.areAllPlayersReady(pin)) {
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

                const roundStartTime = roundStartTimes.get(pin);
                if (!roundStartTime) return;

                gameManager.submitGuess(pin, socket.id, targetUser, timestamp, roundStartTime);
                socket.emit("guess-received", { success: true });

                // Check if all players have submitted their guesses
                const actualOwnerId = room.currentMediaOwnerId || room.players[0].socketId;
                const playersWhoShouldGuess = room.players.filter(p => p.socketId !== actualOwnerId);
                const guessesReceived = room.roundGuesses.size;

                // Only calculate results if all players have guessed AND results haven't been calculated yet
                if (guessesReceived >= playersWhoShouldGuess.length && !room.roundResultsCalculated) {
                    calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
                }
            } catch (error) {
                socket.emit("error", { message: "Failed to submit guess" });
            }
        });

        socket.on("time-expired", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room || room.gameState !== "playing") return;
                
                // Only calculate results if they haven't been calculated yet
                // (in case all players guessed before timer expired)
                if (!room.roundResultsCalculated) {
                    calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
                }
            } catch (error) { }
        });

        socket.on("continue-game", (data) => {
            try {
                const { pin } = data;
                const room = gameManager.getRoom(pin);
                if (!room || room.hostSocketId !== socket.id) return;
                calculateAndEmitRoundResults(pin, io, gameManager, roundStartTimes);
            } catch (error) { }
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
                }
            }
        });
    });
}

module.exports = setupSocket;
