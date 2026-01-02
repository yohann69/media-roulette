class GameManager {
  constructor() {
    // Rooms mapped by PIN (6-digit string)
    this.rooms = new Map();
  }

  /**
   * Generate a unique 6-digit PIN
   */
  generatePIN() {
    let pin;
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.rooms.has(pin));
    return pin;
  }

  /**
   * Create a new game room
   */
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
      mediaPool: [], // Will be populated when host selects media
      currentRound: 0,
      gameState: "lobby", // lobby, playing, finished
      scores: new Map(), // playerId -> { totalScore, roundScore, timeTaken }
    };

    this.rooms.set(pin, room);
    return room;
  }

  /**
   * Join an existing room
   */
  joinRoom(pin, socketId, playerName) {
    const room = this.rooms.get(pin);
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.gameState !== "lobby") {
      return { success: false, error: "Game already started" };
    }

    // Check if player already in room
    const existingPlayer = room.players.find((p) => p.socketId === socketId);
    if (existingPlayer) {
      return { success: true, room };
    }

    // Add new player
    room.players.push({
      socketId,
      name: playerName,
      isHost: false,
      score: 0,
    });

    return { success: true, room };
  }

  /**
   * Remove a player from a room
   */
  removePlayer(socketId) {
    for (const [pin, room] of this.rooms.entries()) {
      const playerIndex = room.players.findIndex(
        (p) => p.socketId === socketId
      );
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        // If host left, delete the room
        if (player.isHost) {
          this.rooms.delete(pin);
          return { pin, roomDeleted: true };
        }

        return { pin, room };
      }
    }
    return null;
  }

  /**
   * Get room by PIN
   */
  getRoom(pin) {
    return this.rooms.get(pin);
  }

  /**
   * Get room by socket ID
   */
  getRoomBySocketId(socketId) {
    for (const [pin, room] of this.rooms.entries()) {
      if (room.players.some((p) => p.socketId === socketId)) {
        return { pin, room };
      }
    }
    return null;
  }

  /**
   * Update game state
   */
  updateGameState(pin, newState) {
    const room = this.rooms.get(pin);
    if (room) {
      room.gameState = newState;
      return true;
    }
    return false;
  }

  /**
   * Set media pool for a room
   */
  setMediaPool(pin, mediaPool) {
    const room = this.rooms.get(pin);
    if (room) {
      room.mediaPool = mediaPool;
      return true;
    }
    return false;
  }

  /**
   * Update current round
   */
  setCurrentRound(pin, round) {
    const room = this.rooms.get(pin);
    if (room) {
      room.currentRound = round;
      return true;
    }
    return false;
  }

  /**
   * Update player score
   */
  updateScore(pin, socketId, roundScore, timeTaken, isCorrect) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return false;

    if (!room.scores.has(socketId)) {
      room.scores.set(socketId, {
        totalScore: 0,
        roundScore: 0,
        timeTaken: null,
      });
    }

    const scoreData = room.scores.get(socketId);
    scoreData.roundScore = isCorrect ? roundScore : 0;
    scoreData.totalScore += scoreData.roundScore;
    scoreData.timeTaken = isCorrect ? timeTaken : null;
    player.score = scoreData.totalScore;

    return true;
  }

  /**
   * Reset round scores
   */
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

  /**
   * Get all player scores for leaderboard
   */
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

