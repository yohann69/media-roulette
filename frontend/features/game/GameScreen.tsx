import { useState } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { RevealView } from "../../components/organisms/RevealView";
import { ResultView } from "../../components/organisms/ResultView";
import { InterimLeaderboard } from "../../components/molecules/InterimLeaderboard";
import { Podium } from "../../components/molecules/Podium";
import { Button } from "../../components/atoms/Button";
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

export function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const {
    room,
    currentPlayerId,
    submitGuess,
    continueGame,
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

  const pin = params.pin || room?.pin || "";
  const isHost = params.isHost === "true" || room?.players.find((p) => p.socketId === currentPlayerId)?.isHost || false;

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
    },
    onRoundResult: (data) => {
      setActualOwnerId(data.actualOwnerId);
      setRoundResults(data);
      setTimerActive(false);
      setGameState("result");
    },
    onGameFinished: (data) => {
      setFinalLeaderboard(data.leaderboard);
      setGameState("podium");
    },
  });

  const handlePlayerSelect = async (playerId: string) => {
    if (timeExpired || selectedPlayer || !pin) return;

    const timestamp = Date.now();
    setSelectedPlayer(playerId);
    setTimerActive(false);
    await submitGuess(pin, playerId, timestamp);
  };

  const handleTimeExpired = () => {
    setTimeExpired(true);
    setTimerActive(false);
  };

  const handleContinue = async () => {
    if (!pin) return;
    await continueGame(pin);
  };

  const handleShowAgain = () => {
    setGameState("reveal");
    setSelectedPlayer(null);
    setTimeExpired(false);
    setTimerActive(true);
  };

  const handleShowLeaderboard = () => {
    setShowLeaderboard(true);
    setGameState("leaderboard");
  };

  const handleContinueFromLeaderboard = () => {
    setShowLeaderboard(false);
  };

  const handlePlayAgain = () => {
    router.push("/lobby");
  };

  const isDisabled = timeExpired || selectedPlayer !== null;
  const correctPlayerId = actualOwnerId || players[0]?.id;
  const isOwner = actualOwnerId === currentPlayerId;

  if (gameState === "podium") {
    return (
      <View className="flex-1 bg-black">
        <Podium players={finalLeaderboard} />
        <View className="px-6 py-4 border-t border-gray-800 bg-black">
          <Button
            title="Play Again"
            onPress={handlePlayAgain}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  if (gameState === "leaderboard" && roundResults) {
    return (
      <View className="flex-1 bg-black">
        <InterimLeaderboard
          visible={showLeaderboard}
          players={roundResults.leaderboard}
          onContinue={handleContinueFromLeaderboard}
        />
      </View>
    );
  }

  if (gameState === "reveal" && currentMedia) {
    return (
      <RevealView
        currentRound={currentRound}
        totalRounds={totalRounds}
        timerDuration={timerDuration}
        timerActive={timerActive}
        currentMedia={currentMedia}
        players={players}
        selectedPlayer={selectedPlayer}
        disabled={isDisabled}
        onPlayerSelect={handlePlayerSelect}
        onTimeExpired={handleTimeExpired}
      />
    );
  }

  if (gameState === "result" && currentMedia && roundResults) {
    const userResult = roundResults.results.find(
      (r: any) => r.playerId === currentPlayerId
    );

    return (
      <ResultView
        currentRound={currentRound}
        totalRounds={totalRounds}
        currentMedia={currentMedia}
        selectedPlayer={userResult?.guessedPlayerId || null}
        correctPlayerId={actualOwnerId || ""}
        players={players}
        isOwner={isOwner}
        onShowAgain={handleShowAgain}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Button
        title="Waiting for round to start..."
        onPress={() => {}}
        variant="secondary"
        disabled
      />
    </View>
  );
}
