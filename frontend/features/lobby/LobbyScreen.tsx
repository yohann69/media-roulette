import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
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
  const { username } = useUsername();
  const { settings } = useGameSettings();
  const { media } = useMediaFetcher(20, "mixed");
  const [gamePIN, setGamePIN] = useState("");
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    setGamePIN(generateGamePIN());
  }, []);

  const players: Player[] = [
    { id: "current", name: username || "You", isHost: true },
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
    <ScrollView
      style={{ flex: 1, backgroundColor: "#000000" }}
      contentContainerStyle={{ padding: 24 }}
    >
      <Text
        style={{
          color: "#ffffff",
          fontSize: 32,
          fontWeight: "bold",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Game Lobby
      </Text>

      <GamePIN pin={gamePIN} />

      <View style={{ marginBottom: 32 }}>
        <Text
          style={{
            color: "#ffffff",
            fontSize: 20,
            fontWeight: "600",
            marginBottom: 16,
          }}
        >
          Players ({players.length})
        </Text>
        <PlayerList players={players} currentUserId="current" />
      </View>

      <GameSettingsDisplay settings={settings} />

      <WarningBanner
        totalMedia={totalMedia}
        requiredRounds={settings.rounds}
      />

      <Button
        title="Start Game"
        onPress={handleStartGame}
        variant="primary"
      />

      <WarningModal
        visible={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onWait={() => setShowWarningModal(false)}
        onProceed={handleProceedAnyway}
        totalMedia={totalMedia}
        requiredRounds={settings.rounds}
      />
    </ScrollView>
  );
}

