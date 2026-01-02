import { useState } from "react";
import { useRouter } from "expo-router";
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
      setCurrentRound(data.round);
      setTotalRounds(data.totalRounds);
      setCurrentMedia(data.mediaData);
      setTimerDuration(data.duration);
      setRoundStartTime(data.roundStartTime);
      setPlayers(data.options);
      setSelectedPlayer(null);
      setTimeExpired(false);
      setTimerActive(true);
      setGameState("reveal");
      setRoundResults(null);
      setIsShowingMediaAgain(false);
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
    onGameFinished: (data) => {
      setFinalLeaderboard(data.leaderboard);
      setGameState("podium");
      setIsShowingMediaAgain(false);
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
    const timestamp = Date.now();
    setSelectedPlayer(playerId);
    setTimerActive(false);
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
    setShowLeaderboard(false);
    if (currentRound < totalRounds) {
      setGameState("reveal");
    }
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

