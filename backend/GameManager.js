class GameManager {
  constructor() {
    this.rooms = new Map();
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
        },
      ],
      settings: {
        rounds: settings.rounds || 25,
        timer: settings.timer || 5,
        mode: settings.mode || "Photo",
      },
      mediaPool: [],
      currentRound: 0,
      gameState: "lobby",
      scores: new Map(),
      roundGuesses: new Map(), // socketId -> { guessedPlayerId, timestamp, timeTaken }
      usedMediaIndices: new Set(), // Track which media items have been used
    };

    this.rooms.set(pin, room);
    return room;
  }

  joinRoom(pin, socketId, playerName) {
    const room = this.rooms.get(pin);
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.gameState !== "lobby") {
      return { success: false, error: "Game already started" };
    }

    const existingPlayer = room.players.find((p) => p.socketId === socketId);
    if (existingPlayer) {
      return { success: true, room };
    }

    room.players.push({
      socketId,
      name: playerName,
      isHost: false,
      score: 0,
    });

    return { success: true, room };
  }

  removePlayer(socketId) {
    for (const [pin, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(
        (p) => p.socketId === socketId
      );
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        if (player.isHost) {
          this.rooms.delete(pin);
          return { pin, roomDeleted: true };
        }

        return { pin, room };
      }
    }
    return null;
  }

  getRoom(pin) {
    return this.rooms.get(pin);
  }

  getRoomBySocketId(socketId) {
    for (const [pin, room] of this.rooms.entries()) {
      if (room.players.some((p) => p.socketId === socketId)) {
        return { pin, room };
      }
    }
    return null;
  }

  updateGameState(pin, newState) {
    const room = this.rooms.get(pin);
    if (room) {
      room.gameState = newState;
      return true;
    }
    return false;
  }

  /**
   * Reset game for play again - reset scores, rounds, and game state
   * Only resets if game is finished, to avoid race conditions with multiple players
   */
  resetGame(pin) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    // Only reset if not already in lobby (avoid clearing media pool if someone else reset)
    if (room.gameState !== "lobby") {
        room.gameState = "lobby";
        room.currentRound = 0;
        room.scores.clear();
        room.roundGuesses.clear();
        room.usedMediaIndices.clear();
        room.mediaPool = [];
        
        // Reset all player scores
        room.players.forEach((player) => {
          player.score = 0;
        });
        return true;
    }
    
    return false;
  }

  /**
   * Make a player the new host (for play again - first to validate becomes host)
   */
  setNewHost(pin, socketId) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    // Remove host status from all players
    room.players.forEach((player) => {
      player.isHost = false;
    });

    // Set new host
    const newHost = room.players.find((p) => p.socketId === socketId);
    if (newHost) {
      newHost.isHost = true;
      room.hostSocketId = socketId;
      return true;
    }

    return false;
  }

  setMediaPool(pin, mediaPool) {
    const room = this.rooms.get(pin);
    if (room) {
      room.mediaPool = mediaPool;
      // Reset used indices when media pool is set
      room.usedMediaIndices = new Set();
      return true;
    }
    return false;
  }

  setCurrentRound(pin, round) {
    const room = this.rooms.get(pin);
    if (room) {
      room.currentRound = round;
      room.roundGuesses.clear(); // Clear guesses for new round
      return true;
    }
    return false;
  }

  /**
   * Get a random unused media item for the current round
   */
  getRandomMedia(pin) {
    const room = this.rooms.get(pin);
    if (!room || room.mediaPool.length === 0) {
      return null;
    }

    // If all media has been used, reset
    if (room.usedMediaIndices.size >= room.mediaPool.length) {
      room.usedMediaIndices.clear();
    }

    // Find unused media
    let availableIndices = [];
    for (let i = 0; i < room.mediaPool.length; i++) {
      if (!room.usedMediaIndices.has(i)) {
        availableIndices.push(i);
      }
    }

    if (availableIndices.length === 0) {
      return null;
    }

    // Pick random unused media
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    room.usedMediaIndices.add(randomIndex);
    
    const media = room.mediaPool[randomIndex];
    
    // Determine owner from media data (if stored) or assign randomly
    // For now, we'll use a simple approach: media should have ownerId
    return {
      ...media,
      index: randomIndex,
    };
  }

  /**
   * Submit a guess for the current round
   */
  submitGuess(pin, socketId, guessedPlayerId, timestamp, roundStartTime) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    const timeTaken = timestamp - roundStartTime;
    
    room.roundGuesses.set(socketId, {
      guessedPlayerId,
      timestamp,
      timeTaken,
    });

    return true;
  }

  /**
   * Calculate scores for the current round and return results
   */
  calculateRoundResults(pin, actualOwnerId, roundStartTime) {
    const room = this.rooms.get(pin);
    if (!room) return null;

    const { calculateScore } = require("./utils/scoring");
    const roundEndTime = Date.now();

    // Process all guesses
    const results = [];
    room.roundGuesses.forEach((guess, socketId) => {
      const player = room.players.find((p) => p.socketId === socketId);
      if (!player) return;

      const isCorrect = guess.guessedPlayerId === actualOwnerId;
      const roundScore = isCorrect ? calculateScore(guess.timeTaken) : 0;

      // Update scores
      if (!room.scores.has(socketId)) {
        room.scores.set(socketId, {
          totalScore: 0,
          roundScore: 0,
          timeTaken: null,
        });
      }

      const scoreData = room.scores.get(socketId);
      scoreData.roundScore = roundScore;
      scoreData.totalScore += roundScore;
      scoreData.timeTaken = isCorrect ? guess.timeTaken : null;
      player.score = scoreData.totalScore;

      results.push({
        playerId: socketId,
        playerName: player.name,
        guessedPlayerId: guess.guessedPlayerId,
        isCorrect,
        roundScore,
        timeTaken: guess.timeTaken,
        totalScore: scoreData.totalScore,
      });
    });

    // Get leaderboard
    const leaderboard = this.getPlayerScores(pin);

    return {
      actualOwnerId,
      results,
      leaderboard,
    };
  }

  /**
   * Check if all players have submitted guesses (or time expired)
   */
  allGuessesReceived(pin) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    // Count players who should guess (excluding the owner if it's their media)
    const activePlayers = room.players.filter((p) => {
      // Owner doesn't guess their own media, so we'd need to know the actual owner
      // For now, count all players
      return true;
    });

    return room.roundGuesses.size >= activePlayers.length;
  }

  resetRoundScores(pin) {
    const room = this.rooms.get(pin);
    if (room) {
      room.scores.forEach((scoreData) => {
        scoreData.roundScore = 0;
        scoreData.timeTaken = null;
      });
      return true;
    }
    return false;
  }

  getPlayerScores(pin) {
    const room = this.rooms.get(pin);
    if (!room) return [];

    return room.players.map((player) => {
      const scoreData = room.scores.get(player.socketId) || {
        totalScore: 0,
        roundScore: 0,
        timeTaken: null,
      };
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
