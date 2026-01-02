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
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
}

export function LobbyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { username } = useUsername();
  const { settings } = useGameSettings();
  const { room, startGame, onPlayerJoined, onPlayerLeft, onGameStarted, onRoomDeleted } = useSocket();
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isHost = params.isHost === "true";
  const pin = params.pin || room?.pin || "";

  useEffect(() => {
    onPlayerJoined((data) => {
      console.log("Player joined:", data);
    });

    onPlayerLeft((data) => {
      console.log("Player left:", data);
    });

    onGameStarted((data) => {
      console.log("Game started:", data);
      router.push({ pathname: "/game", params: { pin, isHost: isHost ? "true" : "false" } });
    });

    onRoomDeleted((data) => {
      console.log("Room deleted:", data);
      router.push("/");
    });
  }, [onPlayerJoined, onPlayerLeft, onGameStarted, onRoomDeleted, router, pin, isHost]);

  const players: Player[] = room?.players.map((p) => ({
    id: p.socketId,
    name: p.name,
    isHost: p.isHost,
  })) || [];

  const totalMedia = players.length * 20;
  const canStartGame = totalMedia >= settings.rounds;

  const handleStartGame = async () => {
    if (!canStartGame) {
      setShowWarningModal(true);
      return;
    }

    if (!pin) {
      console.error("No PIN available");
      return;
    }

    console.log(`Attempting to start game with PIN ${pin}`);
    setIsStarting(true);
    
    try {
      const success = await startGame(pin);
      setIsStarting(false);

      if (!success) {
        console.error("Failed to start game - promise returned false");
      } else {
        console.log("Game started successfully");
      }
    } catch (error) {
      console.error("Error in handleStartGame:", error);
      setIsStarting(false);
    }
  };

  const handleProceedAnyway = async () => {
    setShowWarningModal(false);
    if (!pin) return;

    setIsStarting(true);
    const success = await startGame(pin);
    setIsStarting(false);

    if (!success) {
      console.error("Failed to start game");
    }
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Text className="text-white text-4xl font-bold mb-2 text-center">
          {t("lobby.title")}
        </Text>

        {isHost && pin && <GamePIN pin={pin} />}

        <View className="mb-8">
          <Text className="text-white text-xl font-semibold mb-4">
            {t("lobby.players")} ({players.length})
          </Text>
          <PlayerList 
            players={players} 
            currentUserId={room?.players.find(p => p.name === username)?.socketId || ""} 
          />
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
            title={isStarting ? t("lobby.starting") : t("lobby.startGame")}
            onPress={handleStartGame}
            variant="primary"
            disabled={isStarting}
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
