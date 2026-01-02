import { useState, useEffect, useRef } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { RevealView } from "../../components/organisms/RevealView";
import { ResultView } from "../../components/organisms/ResultView";
import { InterimLeaderboard } from "../../components/molecules/InterimLeaderboard";
import { Podium } from "../../components/molecules/Podium";
import { Button } from "../../components/atoms/Button";
import { useGameSettings } from "../../hooks/useGameSettings";
import { useUsername } from "../../hooks/useUsername";
import { useGameScores } from "../../hooks/useGameScores";

interface Player {
  id: string;
  name: string;
}

interface MediaItem {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
  ownerId: string;
}

type GameState = "reveal" | "result" | "leaderboard" | "podium";

function generateMockMedia(players: Player[], count: number): MediaItem[] {
  const media: MediaItem[] = [];
  for (let i = 0; i < count; i++) {
    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    media.push({
      id: `media-${i}`,
      uri: `https://picsum.photos/seed/${i}/800/600`,
      mediaType: "photo",
      ownerId: randomPlayer.id,
    });
  }
  return media;
}

export function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ isHost?: string }>();
  const { settings } = useGameSettings();
  const { username } = useUsername();
  const [gameState, setGameState] = useState<GameState>("reveal");
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [timerActive, setTimerActive] = useState(true);
  const [roundStartTime, setRoundStartTime] = useState<number>(Date.now());
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const players: Player[] = [
    { id: "current", name: username || "You" },
    { id: "bot1", name: "Bot Alice" },
    { id: "bot2", name: "Bot Bob" },
  ];

  const {
    resetRoundScores,
    updatePlayerScore,
    simulateBotScores,
    getPlayerScoresArray,
  } = useGameScores(players);

  const mediaPool = useRef<MediaItem[]>(
    generateMockMedia(players, settings.rounds * players.length)
  ).current;

  const currentMedia = mediaPool[currentRound - 1];
  const correctPlayerId = currentMedia?.ownerId || players[0].id;
  const isOwner = correctPlayerId === "current";

  useEffect(() => {
    setGameState("reveal");
    setSelectedPlayer(null);
    setTimeExpired(false);
    setTimerActive(true);
    setRoundStartTime(Date.now());
    setShowLeaderboard(false);
    resetRoundScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound]);

  const handlePlayerSelect = (playerId: string) => {
    if (timeExpired || selectedPlayer) return;

    const timeTaken = Date.now() - roundStartTime;
    const isCorrect = playerId === correctPlayerId;

    setSelectedPlayer(playerId);
    setTimerActive(false);
    updatePlayerScore("current", timeTaken, isCorrect);

    setTimeout(() => {
      setGameState("result");
    }, 500);
  };

  const handleTimeExpired = () => {
    setTimeExpired(true);
    setTimerActive(false);

    if (!selectedPlayer) {
      setTimeout(() => {
        setGameState("result");
      }, 500);
    }
  };

  const handleShowLeaderboard = () => {
    simulateBotScores(correctPlayerId, settings.timer, players);
    setShowLeaderboard(true);
    setGameState("leaderboard");
  };

  const handleContinueFromLeaderboard = () => {
    setShowLeaderboard(false);
    if (currentRound < settings.rounds) {
      setCurrentRound(currentRound + 1);
    } else {
      setGameState("podium");
    }
  };

  const handleShowAgain = () => {
    setGameState("reveal");
    setSelectedPlayer(null);
    setTimeExpired(false);
    setTimerActive(true);
    setRoundStartTime(Date.now());
  };

  const handlePlayAgain = () => {
    router.push("/lobby");
  };

  const playerScoresArray = getPlayerScoresArray();
  const isDisabled = timeExpired || selectedPlayer !== null;

  if (gameState === "podium") {
    return (
      <View className="flex-1 bg-black">
        <Podium players={playerScoresArray} />
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

  if (gameState === "leaderboard") {
    return (
      <View className="flex-1 bg-black">
        <InterimLeaderboard
          visible={showLeaderboard}
          players={playerScoresArray}
          onContinue={handleContinueFromLeaderboard}
        />
      </View>
    );
  }

  if (gameState === "reveal") {
    return (
      <RevealView
        currentRound={currentRound}
        totalRounds={settings.rounds}
        timerDuration={settings.timer}
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

  return (
    <ResultView
      currentRound={currentRound}
      totalRounds={settings.rounds}
      currentMedia={currentMedia}
      selectedPlayer={selectedPlayer}
      correctPlayerId={correctPlayerId}
      players={players}
      isOwner={isOwner}
      onShowAgain={handleShowAgain}
      onContinue={handleShowLeaderboard}
    />
  );
}
