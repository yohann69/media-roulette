import { useState, useEffect } from "react";
import { calculateScore } from "../utils/scoring";

interface Player {
  id: string;
  name: string;
}

interface PlayerScore {
  playerId: string;
  playerName: string;
  totalScore: number;
  roundScore: number;
  timeTaken: number | null;
}

export function useGameScores(players: Player[]) {
  const [scores, setScores] = useState<Map<string, PlayerScore>>(new Map());

  // Initialize scores
  useEffect(() => {
    const initialScores = new Map<string, PlayerScore>();
    players.forEach((player) => {
      initialScores.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        totalScore: 0,
        roundScore: 0,
        timeTaken: null,
      });
    });
    setScores(initialScores);
  }, []);

  const resetRoundScores = () => {
    setScores((prev) => {
      const newScores = new Map(prev);
      newScores.forEach((score) => {
        score.roundScore = 0;
        score.timeTaken = null;
      });
      return newScores;
    });
  };

  const updatePlayerScore = (
    playerId: string,
    timeTaken: number,
    isCorrect: boolean
  ) => {
    setScores((prev) => {
      const newScores = new Map(prev);
      const playerScore = newScores.get(playerId);
      if (playerScore) {
        const roundScore = isCorrect ? calculateScore(timeTaken) : 0;
        playerScore.roundScore = roundScore;
        playerScore.totalScore += roundScore;
        playerScore.timeTaken = isCorrect ? timeTaken : null;
      }
      return newScores;
    });
  };

  const simulateBotScores = (
    correctPlayerId: string,
    timerDuration: number,
    players: Player[]
  ) => {
    setScores((prev) => {
      const newScores = new Map(prev);
      const correctPlayer = newScores.get(correctPlayerId);

      // Simulate bot answers
      players.forEach((player) => {
        if (player.id !== "current" && player.id !== correctPlayerId) {
          const botScore = newScores.get(player.id);
          if (botScore) {
            // Random chance bot gets it right (60% chance)
            const isCorrect = Math.random() > 0.4;
            if (isCorrect) {
              // Random time between 500ms and timer duration
              const timeTaken = 500 + Math.random() * (timerDuration * 1000 - 500);
              const roundScore = calculateScore(timeTaken);
              botScore.roundScore = roundScore;
              botScore.totalScore += roundScore;
              botScore.timeTaken = timeTaken;
            } else {
              botScore.roundScore = 0;
              botScore.timeTaken = null;
            }
          }
        }
      });

      // Owner always gets 0 (they can't guess their own photo)
      if (correctPlayer && correctPlayer.playerId === "current") {
        correctPlayer.roundScore = 0;
        correctPlayer.timeTaken = null;
      }

      return newScores;
    });
  };

  const getPlayerScoresArray = (): PlayerScore[] => {
    return Array.from(scores.values());
  };

  return {
    scores,
    resetRoundScores,
    updatePlayerScore,
    simulateBotScores,
    getPlayerScoresArray,
  };
}

