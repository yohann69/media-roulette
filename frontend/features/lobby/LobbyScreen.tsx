import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { GamePIN } from "../../components/molecules/GamePIN";
import { PlayerList } from "../../components/molecules/PlayerList";
import { GameSettingsDisplay } from "../../components/molecules/GameSettingsDisplay";
import { WarningBanner } from "../../components/molecules/WarningBanner";
import { WarningModal } from "../../components/molecules/WarningModal";
import { BackgroundSlideshow } from "../../components/molecules/BackgroundSlideshow";
import { CustomModal } from "../../components/molecules/Modal";
import { UploadProgress } from "../../components/molecules/UploadProgress";
import { Button } from "../../components/atoms/Button";
import { BackButton } from "../../components/atoms/BackButton";
import { SelectionScreen } from "../selection/SelectionScreen";
import { BlindModeAutoUploader } from "../../components/molecules/BlindModeAutoUploader";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";
import { useLobbySync } from "../../hooks/useLobbySync";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  state?: "selecting" | "compressing" | "uploading" | "ready";
}

export function LobbyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { room, currentPlayerId, startGame, prepareGame, leaveGame, uploadStage, uploadProgress } = useSocket();

  // Derive host status from the room when available (e.g. after play-again, the
  // new host never re-navigates with an updated `isHost` param).
  const isHost =
    (room && currentPlayerId
      ? !!room.players.find((p) => p.socketId === currentPlayerId)?.isHost
      : false) || params.isHost === "true";
  const pin = params.pin || room?.pin || "";

  const {
    isSyncing,
    syncProgress,
    syncStatus,
    allReady,
    isStarting,
    setIsStarting,
    setSyncStatus,
  } = useLobbySync({ pin, isHost });

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);

  const currentPlayer = room?.players.find((p) => p.socketId === currentPlayerId);
  const currentPlayerState = currentPlayer?.state || "selecting";
  const blindMode = room?.settings?.blindMode || false;

  // Auto-open the selection modal as long as the local player still has to pick media.
  // Blind mode skips the modal entirely — upload happens silently via BlindModeAutoUploader.
  useEffect(() => {
    if (!room) return;
    if (currentPlayerState === "selecting" && !blindMode) {
      setShowSelectionModal(true);
    } else {
      setShowSelectionModal(false);
    }
  }, [room, currentPlayerState, blindMode]);

  const players: Player[] = room?.players.map((p) => ({
    id: p.socketId,
    name: p.name,
    isHost: p.isHost,
    state: p.state || "selecting",
  })) || [];

  const settings = room?.settings || { rounds: 25, timer: 5, mode: "Photo" };
  const totalMedia = players.length * 20;
  const canStartGame = totalMedia >= settings.rounds;
  const allPlayersReady = players.length > 0 && players.every((p) => p.state === "ready");
  const hasEnoughPlayers = players.length >= 2;
  const canStart = canStartGame && allPlayersReady && hasEnoughPlayers && (!isSyncing || allReady);
  const hostPlayer = players.find((p) => p.isHost);
  const hostName = hostPlayer?.name || t("lobby.host");

  const handlePrepareGame = async () => {
    if (!canStartGame) {
      setShowWarningModal(true);
      return;
    }
    initiateGameStart();
  };

  const initiateGameStart = async (updatedSettings?: any) => {
    if (!pin) return;
    setIsStarting(true);
    setSyncStatus(t("lobby.preparingGame"));
    await prepareGame(pin, updatedSettings);
  };

  const handleStartGame = async () => {
    if (!pin) return;
    setIsStarting(true);
    await startGame(pin);
  };

  const handleProceedAnyway = async () => {
    setShowWarningModal(false);
    if (!pin) return;
    initiateGameStart({ ...settings, rounds: totalMedia });
  };

  const handleExitLobby = async () => {
    if (pin && room?.pin === pin) await leaveGame(pin);
    router.push("/");
  };

  const handleCloseSelectionModal = async () => {
    // Closing the selection modal without having picked media = leave the game.
    await handleExitLobby();
  };

  return (
    <View className="flex-1 bg-black">
      <BackgroundSlideshow />
      <View className="flex-1" style={{ zIndex: 1 }}>
        <View className="pt-5 px-4">
          <BackButton onPress={handleExitLobby} />
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 8 }}>
          <Text className="text-white text-4xl font-bold mb-2 text-center">
            {t("lobby.title")}
          </Text>

          {pin && <GamePIN pin={pin} />}

          <View className="mb-8">
            <Text className="text-white text-xl font-semibold mb-4">
              {t("lobby.players")} ({players.length})
            </Text>
            <PlayerList players={players} currentUserId={currentPlayerId || undefined} />
          </View>

          {isHost && <GameSettingsDisplay settings={settings} />}

          {isHost && <WarningBanner totalMedia={totalMedia} requiredRounds={settings.rounds} />}

          {/* Progress for the current user while compressing/uploading their own media. */}
          {uploadStage !== "idle" && currentPlayerState !== "ready" && (
            <UploadProgress stage={uploadStage} progress={uploadProgress} />
          )}

          {/* Progress for the sync phase after the host presses Start. */}
          {isSyncing && (
            <View className="mt-4 p-4 bg-gray-900 rounded-lg">
              <Text className="text-white text-center mb-2">{syncStatus}</Text>
              <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <View className="h-full bg-primary" style={{ width: `${syncProgress * 100}%` }} />
              </View>
              <Text className="text-gray-400 text-center mt-1">
                {Math.round(syncProgress * 100)}%
              </Text>
            </View>
          )}
        </ScrollView>

        {isHost ? (
          <View className="px-6 py-3 pb-8 border-t border-gray-800 bg-black/80">
            <Button
              title={isStarting ? t("lobby.starting") : t("lobby.startGame")}
              onPress={allReady ? handleStartGame : handlePrepareGame}
              variant="primary"
              disabled={isStarting || !canStart}
            />
          </View>
        ) : (
          <View className="px-6 py-3 pb-8 border-t border-gray-800 bg-black/80">
            <Button
              title={isSyncing ? syncStatus : t("lobby.waitingForHost", { hostName })}
              onPress={() => {}}
              variant="secondary"
              disabled
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

        {/* Media selection modal — opens automatically whenever the local player still has to pick. */}
        <CustomModal
          visible={showSelectionModal}
          onClose={handleCloseSelectionModal}
          title={t("selection.title")}
          subtitle={t("selection.description", { count: 20 })}
          showCloseButton={true}
        >
          <SelectionScreen
            isHost={isHost ? "true" : "false"}
            pin={pin}
            onClose={() => setShowSelectionModal(false)}
          />
        </CustomModal>

        {/* Blind mode: run fetch+compress+upload invisibly so no selection UI ever appears. */}
        {blindMode && currentPlayerState === "selecting" && pin && (
          <BlindModeAutoUploader pin={pin} isHost={isHost} />
        )}
      </View>
    </View>
  );
}
