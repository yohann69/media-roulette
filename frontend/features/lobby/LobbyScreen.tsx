import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GamePIN } from "../../components/molecules/GamePIN";
import { PlayerList } from "../../components/molecules/PlayerList";
import { GameSettingsDisplay } from "../../components/molecules/GameSettingsDisplay";
import { WarningBanner } from "../../components/molecules/WarningBanner";
import { WarningModal } from "../../components/molecules/WarningModal";
import { Button } from "../../components/atoms/Button";
import { useUsername } from "../../hooks/useUsername";
import { useGameSettings } from "../../hooks/useGameSettings";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
}

function generateGamePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function LobbyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { username } = useUsername();
  const { settings } = useGameSettings();
  const { media } = useMediaFetcher(20, "mixed");
  const [gamePIN, setGamePIN] = useState("");
  const [showWarningModal, setShowWarningModal] = useState(false);

  const isHost = params.isHost === "true";
  const joinedPin = params.pin || "";

  useEffect(() => {
    if (isHost) {
      // Host generates a new PIN
      setGamePIN(generateGamePIN());
    } else if (joinedPin) {
      // Joiner uses the PIN they entered
      setGamePIN(joinedPin);
    }
  }, [isHost, joinedPin]);

  const players: Player[] = [
    { id: "current", name: username || "You", isHost: isHost },
    { id: "bot1", name: "Bot Alice" },
    { id: "bot2", name: "Bot Bob" },
  ];

  const totalMedia = players.length * 20;
  const canStartGame = totalMedia >= settings.rounds;

  const handleStartGame = () => {
    if (!canStartGame) {
      setShowWarningModal(true);
    } else {
      // Navigate to game screen (placeholder for now)
      router.push("/lobby");
    }
  };

  const handleProceedAnyway = () => {
    setShowWarningModal(false);
    // Navigate to game with reduced rounds
    router.push("/lobby");
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Text className="text-white text-4xl font-bold mb-2 text-center">
          Game Lobby
        </Text>

        {isHost && <GamePIN pin={gamePIN} />}

        <View className="mb-8">
          <Text className="text-white text-xl font-semibold mb-4">
            Players ({players.length})
          </Text>
          <PlayerList players={players} currentUserId="current" />
        </View>

        <GameSettingsDisplay settings={settings} />

        <WarningBanner
          totalMedia={totalMedia}
          requiredRounds={settings.rounds}
        />
      </ScrollView>

      {isHost && (
        <View className="px-6 py-4 border-t border-gray-800 bg-black">
          <Button
            title="Start Game"
            onPress={handleStartGame}
            variant="primary"
          />
        </View>
      )}

      <WarningModal
        visible={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onWait={() => setShowWarningModal(false)}
        onProceed={handleProceedAnyway}
        totalMedia={totalMedia}
        requiredRounds={settings.rounds}
      />
    </View>
  );
}
