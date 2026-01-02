import { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { CountdownTimer } from "../../components/molecules/CountdownTimer";
import { MediaDisplay } from "../../components/molecules/MediaDisplay";
import { PlayerSelection } from "../../components/molecules/PlayerSelection";
import { ResultDisplay } from "../../components/molecules/ResultDisplay";
import { Button } from "../../components/atoms/Button";
import { useGameSettings } from "../../hooks/useGameSettings";
import { useUsername } from "../../hooks/useUsername";

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

type GameState = "reveal" | "result";

// Mock media pool - in production this would come from the actual selected media
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

  // Mock players
  const players: Player[] = [
    { id: "current", name: username || "You" },
    { id: "bot1", name: "Bot Alice" },
    { id: "bot2", name: "Bot Bob" },
  ];

  // Generate mock media pool
  const mediaPool = useRef<MediaItem[]>(
    generateMockMedia(players, settings.rounds * players.length)
  ).current;

  // Get current media for this round
  const currentMedia = mediaPool[currentRound - 1];
  const correctPlayerId = currentMedia?.ownerId || players[0].id;

  useEffect(() => {
    // Reset state for new round
    setGameState("reveal");
    setSelectedPlayer(null);
    setTimeExpired(false);
    setTimerActive(true);
  }, [currentRound]);

  const handlePlayerSelect = (playerId: string) => {
    if (timeExpired || selectedPlayer) return;
    setSelectedPlayer(playerId);
    setTimerActive(false);

    // Transition to result after a brief delay
    setTimeout(() => {
      setGameState("result");
    }, 500);
  };

  const handleTimeExpired = () => {
    setTimeExpired(true);
    setTimerActive(false);

    // If no selection was made, transition to result
    if (!selectedPlayer) {
      setTimeout(() => {
        setGameState("result");
      }, 500);
    }
  };

  const handleNextRound = () => {
    if (currentRound < settings.rounds) {
      setCurrentRound(currentRound + 1);
    } else {
      // Game over - navigate back to lobby or show game over screen
      router.back();
    }
  };

  const isDisabled = timeExpired || selectedPlayer !== null;

  if (gameState === "reveal") {
    return (
      <View className="flex-1 bg-black">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <View className="items-center mb-6">
            <Text className="text-white text-2xl font-bold mb-1">
              Round {currentRound} of {settings.rounds}
            </Text>
            <Text className="text-gray-400 text-sm">Who took this photo?</Text>
          </View>

          <CountdownTimer
            duration={settings.timer}
            onComplete={handleTimeExpired}
            isActive={timerActive}
          />

          {currentMedia && <MediaDisplay media={currentMedia} />}

          <PlayerSelection
            players={players}
            selectedPlayer={selectedPlayer}
            onSelect={handlePlayerSelect}
            disabled={isDisabled}
          />
        </ScrollView>
      </View>
    );
  }

  // Result state
  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="items-center mb-6">
          <Text className="text-white text-2xl font-bold mb-1">
            Round {currentRound} of {settings.rounds}
          </Text>
          <Text className="text-gray-400 text-sm">Result</Text>
        </View>

        {currentMedia && <MediaDisplay media={currentMedia} />}

        <ResultDisplay
          selectedPlayer={selectedPlayer}
          correctPlayerId={correctPlayerId}
          players={players}
        />
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800 bg-black">
        <Button
          title={
            currentRound < settings.rounds ? "Next Round" : "Game Over"
          }
          onPress={handleNextRound}
          variant="primary"
        />
      </View>
    </View>
  );
}
