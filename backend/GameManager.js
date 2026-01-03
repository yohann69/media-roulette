const fs = require("fs-extra");
const path = require("path");

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
          state: "selecting", // Host also needs to select media first
        },
      ],
      settings: {
        rounds: settings.rounds || 25,
        timer: settings.timer || 5,
        mode: settings.mode || "Photo",
      },
      uploadedMedia: new Map(), // socketId -> Array<MediaItem>
      gameMedia: [], // Selected media for the game
      currentRound: 0,
      gameState: "lobby",
      scores: new Map(),
      roundGuesses: new Map(),
      usedMediaIndices: new Set(),
      readyPlayers: new Set(), // Players who have finished syncing
      roundResultsCalculated: false, // Flag to prevent duplicate round result calculations
    };

    this.rooms.set(pin, room);
    return room;
  }

  joinRoom(pin, socketId, playerName) {
    const room = this.rooms.get(pin);
    if (!room) return { success: false, error: "Room not found" };
    if (room.gameState !== "lobby") return { success: false, error: "Game already started" };

    const existingPlayer = room.players.find((p) => p.socketId === socketId);
    if (existingPlayer) return { success: true, room };

    room.players.push({
      socketId,
      name: playerName,
      isHost: false,
      score: 0,
      state: "selecting", // New players start in selecting state
    });

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

        if (player.isHost) {
          this.cleanupRoomFiles(pin);
          this.rooms.delete(pin);
          return { pin, roomDeleted: true };
        }
        return { pin, room };
      }
    }
    return null;
  }

  cleanupRoomFiles(pin) {
    // We should delete files associated with this room
    // Since we store all in 'uploads/', and we don't have a DB, 
    // we rely on the filename map in the room object before deleting it.
    const room = this.rooms.get(pin);
    if (!room) return;

    // Collect all filenames from uploadedMedia
    const filesToDelete = [];
    
    // From uploaded pools
    room.uploadedMedia.forEach((mediaList) => {
        mediaList.forEach(m => {
            if (m.filename) filesToDelete.push(m.filename);
        });
    });

    // Delete files
    const UPLOADS_DIR = path.join(__dirname, "uploads");
    filesToDelete.forEach(filename => {
        try {
            fs.unlink(path.join(UPLOADS_DIR, filename), (err) => {
                // Ignore errors (file might not exist)
            });
        } catch (e) { }
    });
  }

  getRoom(pin) { return this.rooms.get(pin); }

  updateGameState(pin, newState) {
    const room = this.rooms.get(pin);
    if (room) {
      room.gameState = newState;
      if (newState === "finished") {
        this.cleanupRoomFiles(pin);
      }
      return true;
    }
    return false;
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
    
    room.players.forEach((player) => { player.score = 0; });
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
    if (room) {
      room.uploadedMedia.set(socketId, mediaPool);
      return true;
    }
    return false;
  }

  prepareGameMedia(pin) {
    const room = this.rooms.get(pin);
    if (!room) return false;

    // Aggregate all media
    let allMedia = [];
    room.uploadedMedia.forEach((mediaList, ownerId) => {
        const mediaWithOwner = mediaList.map(m => ({ ...m, ownerId }));
        allMedia = [...allMedia, ...mediaWithOwner];
    });

    // Shuffle
    for (let i = allMedia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allMedia[i], allMedia[j]] = [allMedia[j], allMedia[i]];
    }

    // Select subset based on rounds
    // If not enough media, take all
    const count = Math.min(room.settings.rounds, allMedia.length);
    room.gameMedia = allMedia.slice(0, count);
    
    // Assign indices for the game
    room.gameMedia = room.gameMedia.map((m, index) => ({ ...m, index }));
    
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
      const scoreData = room.scores.get(socketId);
      
      if (guess) {
        // Player submitted a guess
        const isCorrect = guess.guessedPlayerId === actualOwnerId;
        const roundScore = isCorrect ? calculateScore(guess.timeTaken) : 0;
        scoreData.roundScore = roundScore;
        scoreData.totalScore += roundScore;
        scoreData.timeTaken = guess.timeTaken;
        player.score = scoreData.totalScore;

        results.push({
          playerId: socketId,
          playerName: player.name,
          guessedPlayerId: guess.guessedPlayerId,
          isCorrect,
          roundScore,
          timeTaken: guess.timeTaken,
          totalScore: scoreData.totalScore,
          tooSlow: false,
        });
      } else {
        // Player didn't submit a guess (too slow or didn't answer)
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
        });
      }
    });

    const leaderboard = this.getPlayerScores(pin);
    return { actualOwnerId, results, leaderboard };
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
