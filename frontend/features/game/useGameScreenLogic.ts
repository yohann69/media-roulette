import { useState } from "react";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { useSocket } from "../../stores/useSocket";
import { useGameEvents } from "../../hooks/useGameEvents";

interface Player {
  id: string;
  name: string;
}

interface MediaItem {
  id: string;
  uri?: string;
  base64?: string;
  mediaType: "photo" | "video";
}

type GameState = "reveal" | "result" | "leaderboard" | "podium";

export function useGameScreenLogic(pin: string, isHost: boolean) {
  const router = useRouter();
  const {
    room,
    currentPlayerId,
    submitGuess,
    continueGame,
    notifyTimeExpired,
    showMediaAgain,
    hideMediaAgain,
    localMediaMap,
    setLocalMediaMap
  } = useSocket();

  const [gameState, setGameState] = useState<GameState>("reveal");
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [roundStartTime, setRoundStartTime] = useState<number>(0);
  const [timerDuration, setTimerDuration] = useState(5);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<any[]>([]);
  const [actualOwnerId, setActualOwnerId] = useState<string | null>(null);
  const [isShowingMediaAgain, setIsShowingMediaAgain] = useState(false);

  useGameEvents({
    onNewRound: (data) => {
      // Resolve local file URI
      let uri = data.mediaData.uri;
      if (data.mediaData.index !== undefined && localMediaMap.has(data.mediaData.index)) {
          uri = localMediaMap.get(data.mediaData.index);
      }

      setCurrentRound(data.round);
      setTotalRounds(data.totalRounds);
      setCurrentMedia({
          ...data.mediaData,
          uri,
      });
      setTimerDuration(data.duration);
      setRoundStartTime(data.roundStartTime);
      setPlayers(data.options);
      setSelectedPlayer(null);
      setTimeExpired(false);
      setTimerActive(true);
      setGameState("reveal");
      setRoundResults(null);
      setIsShowingMediaAgain(false);
      // Set the owner ID from the new-round event so we can disable selection for the owner
      if (data.actualOwnerId) {
        setActualOwnerId(data.actualOwnerId);
      }
    },
    onRoundResult: (data) => {
      setActualOwnerId(data.actualOwnerId);
      setRoundResults(data);
      setTimerActive(false);
      setTimeExpired(false);
      setShowLeaderboard(true);
      setGameState("leaderboard");
      setIsShowingMediaAgain(false);
    },
    onGameFinished: async (data) => {
      setFinalLeaderboard(data.leaderboard);
      setGameState("podium");
      setIsShowingMediaAgain(false);
      
      // Cleanup local files
      try {
          const cacheDir = FileSystem.cacheDirectory || "";
          const gameDir = `${cacheDir}game_${pin}/`;
          await FileSystem.deleteAsync(gameDir, { idempotent: true });
          setLocalMediaMap(new Map()); // Clear map
      } catch (e) {
          console.error("Cleanup error:", e);
      }
    },
    onShowMediaAgain: () => {
      setIsShowingMediaAgain(true);
    },
    onHideMediaAgain: () => {
      setIsShowingMediaAgain(false);
    },
  });

  const handlePlayerSelect = async (playerId: string) => {
    if (timeExpired || selectedPlayer || !pin) return;
    
    // All players can select anyone, including themselves
    const timestamp = Date.now();
    setSelectedPlayer(playerId);
    setTimerActive(false); // Stop local timer for this player
    await submitGuess(pin, playerId, timestamp);
  };

  const handleTimeExpired = async () => {
    setTimeExpired(true);
    setTimerActive(false);
    if (pin) await notifyTimeExpired(pin);
  };

  const handleContinue = async () => {
    if (!pin) return;
    await continueGame(pin);
  };

  const handleShowAgainStart = () => {
    if (!pin) return;
    showMediaAgain(pin);
  };

  const handleShowAgainEnd = () => {
    if (!pin) return;
    hideMediaAgain(pin);
  };

  const handleContinueFromLeaderboard = async () => {
    // This is no longer used - continue is handled directly
    await handleContinue();
  };

  const handlePlayAgain = () => {
    router.push({
      pathname: "/selection",
      params: { isHost: "false", pin, playAgain: "true" }
    });
  };

  return {
    gameState,
    currentRound,
    totalRounds,
    currentMedia,
    selectedPlayer,
    timerDuration,
    timerActive,
    players,
    showLeaderboard,
    roundResults,
    finalLeaderboard,
    actualOwnerId,
    isShowingMediaAgain,
    currentPlayerId,
    handlePlayerSelect,
    handleTimeExpired,
    handleContinue,
    handleShowAgainStart,
    handleShowAgainEnd,
    handleContinueFromLeaderboard,
    handlePlayAgain,
    setShowLeaderboard,
    setGameState,
  };
}
