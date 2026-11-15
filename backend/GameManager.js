const crypto = require("crypto");
const mediaStore = require("./mediaStore");

class GameManager {
  constructor() {
    this.rooms = new Map();
    // Upload tokens authorize a player's media uploads/downloads for one room.
    // They are only ever sent to the player they belong to.
    this.uploadTokens = new Map(); // token -> { pin, socketId }
    this.tokenBySocket = new Map(); // socketId -> token
  }

  issueUploadToken(pin, socketId) {
    this.revokeUploadToken(socketId);
    const token = crypto.randomBytes(24).toString("base64url");
    this.uploadTokens.set(token, { pin, socketId });
    this.tokenBySocket.set(socketId, token);
    return token;
  }

  revokeUploadToken(socketId) {
    const token = this.tokenBySocket.get(socketId);
    if (token) this.uploadTokens.delete(token);
    this.tokenBySocket.delete(socketId);
  }

  /** Returns { pin, socketId, room } for a valid token whose player is still in the room. */
  resolveUploadToken(token) {
    if (typeof token !== "string") return null;
    const entry = this.uploadTokens.get(token);
    if (!entry) return null;
    const room = this.rooms.get(entry.pin);
    if (!room || !this.isMember(entry.pin, entry.socketId)) return null;
    return { ...entry, room };
  }

  isMember(pin, socketId) {
    const room = this.rooms.get(pin);
    return !!room && room.players.some((p) => p.socketId === socketId);
  }

  /** Remembers a file a player uploaded so it can be validated and cleaned up later. */
  recordUpload(pin, socketId, filename) {
    const room = this.rooms.get(pin);
    if (!room) return false;
    if (!room.uploadedFiles.has(socketId)) room.uploadedFiles.set(socketId, new Set());
    const files = room.uploadedFiles.get(socketId);
    if (files.size >= mediaStore.LIMITS.maxFilesPerPlayer) return false;
    files.add(filename);
    return true;
  }

  uploadCount(pin, socketId) {
    return this.rooms.get(pin)?.uploadedFiles.get(socketId)?.size ?? 0;
  }

  /**
   * The only view of a room that is ever sent to clients. Internal state such as
   * who owns which media, other players' files or round history stays on the server.
   */
  publicRoom(room) {
    if (!room) return null;
    return {
      pin: room.pin,
      players: room.players.map(({ socketId, name, isHost, score, state }) => ({ socketId, name, isHost, score, state })),
      settings: room.settings,
      gameState: room.gameState,
    };
  }

  /** Media list sent to players before a game: no owner information. */
  publicGameMedia(room) {
    return room.gameMedia.map(({ index, mediaType, filename }) => ({ index, mediaType, filename }));
  }

  generatePIN() {
    let pin;
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.rooms.has(pin));
    return pin;
  }

  createRoom(hostSocketId, hostName, settings) {
    const pin = this.generatePIN();
    const room = {
      pin,
      hostSocketId,
      players: [
        {
          socketId: hostSocketId,
          name: hostName,
          isHost: true,
          score: 0,
          state: "selecting", // Host also needs to select media first
        },
      ],
      settings: {
        rounds: settings.rounds || 25,
        timer: settings.timer || 5,
        mode: settings.mode || "Photo",
        playVideoWithSound: settings.playVideoWithSound !== undefined ? settings.playVideoWithSound : true,
        blindMode: settings.blindMode !== undefined ? settings.blindMode : false,
      },
      uploadedMedia: new Map(), // socketId -> Array<MediaItem>
      uploadedFiles: new Map(), // socketId -> Set<filename> (every file received, pooled or not)
      gameMedia: [], // Selected media for the game
      currentRound: 0,
      gameState: "lobby",
      scores: new Map(),
      roundGuesses: new Map(),
      usedMediaIndices: new Set(),
      readyPlayers: new Set(), // Players who have finished syncing
      allPlayersReadyEmitted: false, // Flag to prevent emitting all-players-ready multiple times
      roundResultsCalculated: false, // Flag to prevent duplicate round result calculations
      roundHistory: [], // Store round results for stats calculation
      streaks: new Map(), // socketId -> current streak count
      lastActivityTime: Date.now(), // Track last activity for inactivity detection
    };

    this.rooms.set(pin, room);
    return room;
  }

  joinRoom(pin, socketId, playerName) {
    const room = this.rooms.get(pin);
    if (!room) return { success: false, error: "Room not found" };
    if (room.gameState !== "lobby") return { success: false, error: "Game already started" };

    const existingPlayer = room.players.find((p) => p.socketId === socketId);
    if (existingPlayer) {
      room.lastActivityTime = Date.now(); // Update activity on rejoin
      return { success: true, room };
    }

    room.players.push({
      socketId,
      name: playerName,
      isHost: false,
      score: 0,
      state: "selecting", // New players start in selecting state
    });
    room.lastActivityTime = Date.now(); // Update activity on join

    return { success: true, room };
  }

  removePlayer(socketId) {
    for (const [pin, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex((p) => p.socketId === socketId);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        room.uploadedMedia.delete(socketId);
        room.readyPlayers.delete(socketId);
        this.revokeUploadToken(socketId);
        // A player who leaves takes their media with them.
        room.uploadedFiles.get(socketId)?.forEach((filename) => mediaStore.deleteFile(pin, filename));
        room.uploadedFiles.delete(socketId);

        if (player.isHost) {
          // Only tear the room down when nobody is left. If other players
          // are still here, promote a random one to host so the game / lobby
          // can keep going instead of being disbanded.
          if (room.players.length === 0) {
            this.deleteRoom(pin);
            return { pin, roomDeleted: true };
          }
          const randomIndex = Math.floor(Math.random() * room.players.length);
          this.setNewHost(pin, room.players[randomIndex].socketId);
          return { pin, room, hostChanged: true };
        }
        return { pin, room };
      }
    }
    return null;
  }

  cleanupRoomFiles(pin) {
    const room = this.rooms.get(pin);
    if (room) room.uploadedFiles.clear();
    mediaStore.deleteRoom(pin);
  }

  /** Fully removes a room: files, tokens and state. */
  deleteRoom(pin) {
    const room = this.rooms.get(pin);
    if (!room) return;
    this.cleanupRoomFiles(pin);
    room.players.forEach((p) => this.revokeUploadToken(p.socketId));
    this.rooms.delete(pin);
  }

  getRoom(pin) { return this.rooms.get(pin); }

  updateGameState(pin, newState) {
    const room = this.rooms.get(pin);
    if (room) {
      room.gameState = newState;
      room.lastActivityTime = Date.now(); // Update activity on state change
      if (newState === "finished") {
        this.cleanupRoomFiles(pin);
      }
      return true;
    }
    return false;
  }

  updateActivity(pin) {
    const room = this.rooms.get(pin);
    if (room) {
      room.lastActivityTime = Date.now();
    }
  }

  getInactiveRooms(inactivityThresholdMs = 15 * 60 * 1000) {
    const now = Date.now();
    const inactiveRooms = [];
    
    for (const [pin, room] of this.rooms.entries()) {
      const timeSinceActivity = now - room.lastActivityTime;
      if (timeSinceActivity >= inactivityThresholdMs) {
        inactiveRooms.push({ pin, room });
      }
    }
    
    return inactiveRooms;
  }

  resetGame(pin) {
    const room = this.rooms.get(pin);
    if (!room || room.gameState === "lobby") return false;

    // Cleanup old files before reset if needed, but we probably want to keep them if we play again?
    // User says "play again... validate another selection". So we should clear.
    this.cleanupRoomFiles(pin);

    room.gameState = "lobby";
    room.currentRound = 0;
    room.scores.clear();
    room.roundGuesses.clear();
    room.usedMediaIndices.clear();
    room.roundResultsCalculated = false;
    room.uploadedMedia.clear();
    room.gameMedia = [];
    room.readyPlayers.clear();
    room.roundHistory = [];
    room.streaks.clear();
    
    room.players.forEach((player) => { 
      player.score = 0;
      player.state = "selecting"; // Reset player states so they can select media again
    });
    return true;
  }

  setNewHost(pin, socketId) {
    const room = this.rooms.get(pin);
    if (!room) return false;
    room.players.forEach((player) => { player.isHost = false; });
    const newHost = room.players.find((p) => p.socketId === socketId);
    if (newHost) {
      newHost.isHost = true;
      room.hostSocketId = socketId;
      return true;
    }
    return false;
  }

  setPlayerMedia(pin, socketId, mediaPool) {
    const room = this.rooms.get(pin);
    if (!room || !Array.isArray(mediaPool)) return false;
    // Only accept files this player actually uploaded to this room.
    const ownFiles = room.uploadedFiles.get(socketId) || new Set();
    const pool = mediaPool
      .filter((item) => item && typeof item.filename === "string" && ownFiles.has(item.filename))
      .map((item) => ({
        id: String(item.id ?? item.filename),
        filename: item.filename,
        mediaType: item.mediaType === "video" ? "video" : "photo",
      }));
    room.uploadedMedia.set(socketId, pool);
    return true;
  }

  prepareGameMedia(pin) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    // A plain Fisher–Yates on the whole pool still clusters media by owner
    // too often (same player showing up 3-4 rounds in a row). Instead we
    // shuffle each owner's list, then draw from owners round-robin with a
    // randomized owner order each cycle. That guarantees no owner appears
    // twice within the same cycle while still feeling random across cycles.
    const perOwnerQueues = [];
    room.uploadedMedia.forEach((mediaList, ownerId) => {
        const withOwner = mediaList.map(m => ({ ...m, ownerId }));
        for (let i = withOwner.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [withOwner[i], withOwner[j]] = [withOwner[j], withOwner[i]];
        }
        if (withOwner.length > 0) perOwnerQueues.push(withOwner);
    });

    const interleaved = [];
    while (perOwnerQueues.some(q => q.length > 0)) {
        // Randomize owner order every cycle so the pattern never settles
        // into a predictable A-B-C-A-B-C rotation.
        const cycleOrder = perOwnerQueues
            .filter(q => q.length > 0)
            .map(q => ({ q, r: Math.random() }))
            .sort((a, b) => a.r - b.r)
            .map(x => x.q);
        for (const queue of cycleOrder) {
            const item = queue.shift();
            if (item) interleaved.push(item);
        }
    }

    // Select subset based on rounds
    // If not enough media, take all
    const count = Math.min(room.settings.rounds, interleaved.length);
    room.gameMedia = interleaved.slice(0, count).map((m, index) => ({ ...m, index }));

    return room.gameMedia;
  }

  setPlayerReady(pin, socketId) {
    const room = this.rooms.get(pin);
    if (room) {
        room.readyPlayers.add(socketId);
        return true;
    }
    return false;
  }

  areAllPlayersReady(pin) {
    const room = this.rooms.get(pin);
    if (!room) return false;
    return room.readyPlayers.size >= room.players.length;
  }

  setCurrentRound(pin, round) {
    const room = this.rooms.get(pin);
    if (room) {
      room.currentRound = round;
      room.roundGuesses.clear();
      room.roundResultsCalculated = false; // Reset flag for new round
      return true;
    }
    return false;
  }

  getMediaForRound(pin, roundIndex) {
      // Round index is 1-based in game, but array is 0-based
      // And we might loop if round > media length?
      // Spec says "select... corresponding to what has been set".
      // So gameMedia length should be >= rounds.
      // If rounds > media, we might need to loop or stop.
      // Logic: we reduced rounds if media was insufficient.
      
      const room = this.rooms.get(pin);
      if (!room || room.gameMedia.length === 0) return null;
      
      const index = (roundIndex - 1) % room.gameMedia.length;
      return room.gameMedia[index];
  }

  submitGuess(pin, socketId, guessedPlayerId, timestamp, roundStartTime) {
    const room = this.rooms.get(pin);
    if (!room) return false;
    const timeTaken = timestamp - roundStartTime;
    room.roundGuesses.set(socketId, { guessedPlayerId, timestamp, timeTaken });
    return true;
  }

  calculateRoundResults(pin, actualOwnerId, roundStartTime) {
    const room = this.rooms.get(pin);
    if (!room) return null;
    const { calculateScore } = require("./utils/scoring");
    
    const results = [];
    
    // Process ALL players (including the owner - they can also guess, just not themselves)
    room.players.forEach((player) => {
      const socketId = player.socketId;
      const guess = room.roundGuesses.get(socketId);
      
      // Initialize score data if it doesn't exist
      if (!room.scores.has(socketId)) {
        room.scores.set(socketId, { totalScore: 0, roundScore: 0, timeTaken: null });
      }
      if (!room.streaks.has(socketId)) {
        room.streaks.set(socketId, 0);
      }
      const scoreData = room.scores.get(socketId);
      let currentStreak = room.streaks.get(socketId) || 0;
      
      if (guess) {
        // Player submitted a guess
        const isCorrect = guess.guessedPlayerId === actualOwnerId;
        const roundScore = isCorrect ? calculateScore(guess.timeTaken) : 0;
        
        // Update streak: increment if correct, reset if incorrect
        if (isCorrect) {
          currentStreak += 1;
        } else {
          currentStreak = 0;
        }
        room.streaks.set(socketId, currentStreak);
        
        // Update score data
        const previousTotal = scoreData.totalScore;
        scoreData.roundScore = roundScore;
        scoreData.totalScore = previousTotal + roundScore; // Add to existing total
        scoreData.timeTaken = guess.timeTaken;
        player.score = scoreData.totalScore;

        console.log(`[Game ${pin}] Player ${player.name} (${socketId}): guessed ${guess.guessedPlayerId}, correct: ${isCorrect}, roundScore: ${roundScore}, totalScore: ${scoreData.totalScore}, streak: ${currentStreak}`);

        results.push({
          playerId: socketId,
          playerName: player.name,
          guessedPlayerId: guess.guessedPlayerId,
          isCorrect,
          roundScore,
          timeTaken: guess.timeTaken,
          totalScore: scoreData.totalScore,
          tooSlow: false,
          streak: currentStreak,
        });
      } else {
        // Player didn't submit a guess (too slow or didn't answer)
        // Reset streak for not answering
        currentStreak = 0;
        room.streaks.set(socketId, 0);
        
        scoreData.roundScore = 0;
        scoreData.timeTaken = null;
        // Don't modify totalScore (it stays the same)
        player.score = scoreData.totalScore;

        results.push({
          playerId: socketId,
          playerName: player.name,
          guessedPlayerId: null,
          isCorrect: false,
          roundScore: 0,
          timeTaken: null,
          totalScore: scoreData.totalScore,
          tooSlow: true,
          streak: 0,
        });
      }
    });

    const leaderboard = this.getPlayerScores(pin);
    
    // Store round results in history for stats calculation
    room.roundHistory.push({
      round: room.currentRound,
      actualOwnerId,
      results: results.map(r => ({
        playerId: r.playerId,
        playerName: r.playerName,
        isCorrect: r.isCorrect,
        timeTaken: r.timeTaken,
        streak: r.streak,
      })),
    });
    
    return { actualOwnerId, results, leaderboard };
  }

  calculateGameStats(pin) {
    const room = this.rooms.get(pin);
    if (!room) return null;
    
    // Safely initialize default stats
    const stats = {
      longestStreak: { playerName: null, streak: 0 },
      fastestAnswer: { playerName: null, time: null, round: null },
      averageTime: null,
      worstPlayer: { playerName: null, score: Infinity },
      hardestRound: { round: null, correctCount: Infinity },
    };
    
    try {
        // Calculate longest streak
        let maxStreak = 0;
        let maxStreakPlayer = null;
        if (room.streaks) {
            room.streaks.forEach((streak, socketId) => {
                if (streak > maxStreak) {
                    maxStreak = streak;
                    const player = room.players.find(p => p.socketId === socketId);
                    maxStreakPlayer = player?.name || null;
                }
            });
            stats.longestStreak = { playerName: maxStreakPlayer, streak: maxStreak };
        }
        
        // Calculate fastest answer and average time
        const allTimes = [];
        let fastestTime = Infinity;
        let fastestPlayer = null;
        let fastestRound = null;
        
        const history = room.roundHistory || [];
        history.forEach((roundData) => {
            if (!roundData || !roundData.results) return;
            roundData.results.forEach((result) => {
                if (result.isCorrect && result.timeTaken !== null && result.timeTaken !== undefined) {
                    allTimes.push(result.timeTaken);
                    if (result.timeTaken < fastestTime) {
                        fastestTime = result.timeTaken;
                        const player = room.players.find(p => p.socketId === result.playerId);
                        fastestPlayer = player?.name || null;
                        fastestRound = roundData.round;
                    }
                }
            });
        });
        
        if (fastestTime !== Infinity) {
            stats.fastestAnswer = { playerName: fastestPlayer, time: fastestTime, round: fastestRound };
        }
        
        if (allTimes.length > 0) {
            const sum = allTimes.reduce((a, b) => a + b, 0);
            stats.averageTime = Math.round(sum / allTimes.length);
        }
        
        // Calculate worst player (lowest score) with correct answers ratio
        let minScore = Infinity;
        let worstPlayer = null;
        let worstPlayerId = null;
        room.players.forEach((player) => {
            if (player.score < minScore) {
                minScore = player.score;
                worstPlayer = player.name;
                worstPlayerId = player.socketId;
            }
        });
        if (worstPlayer && worstPlayerId) {
            // Calculate correct answers ratio for worst player
            let correctCount = 0;
            let totalRounds = history.length;
            history.forEach((roundData) => {
                if (!roundData || !roundData.results) return;
                const playerResult = roundData.results.find(r => r.playerId === worstPlayerId);
                if (playerResult && playerResult.isCorrect) {
                    correctCount++;
                }
            });
            stats.worstPlayer = { 
                playerName: worstPlayer, 
                score: minScore,
                correctAnswers: correctCount,
                totalRounds: totalRounds
            };
        }
        
        // Calculate hardest round (fewest correct answers)
        let minCorrect = Infinity;
        let hardestRoundNum = null;
        if (history.length > 0) {
            history.forEach((roundData) => {
                if (!roundData || !roundData.results) return;
                const correctCount = roundData.results.filter(r => r.isCorrect).length;
                if (correctCount < minCorrect) {
                    minCorrect = correctCount;
                    hardestRoundNum = roundData.round;
                }
            });
            if (hardestRoundNum !== null) {
                stats.hardestRound = { round: hardestRoundNum, correctCount: minCorrect };
            }
        }
    } catch (e) {
        console.error("Error inside calculateGameStats:", e);
    }
    
    return stats;
  }

  getPlayerScores(pin) {
    const room = this.rooms.get(pin);
    if (!room) return [];
    return room.players.map((player) => {
      const scoreData = room.scores.get(player.socketId) || { totalScore: 0, roundScore: 0, timeTaken: null };
      return {
        playerId: player.socketId,
        playerName: player.name,
        totalScore: scoreData.totalScore,
        roundScore: scoreData.roundScore,
        timeTaken: scoreData.timeTaken,
      };
    });
  }
}

module.exports = GameManager;
