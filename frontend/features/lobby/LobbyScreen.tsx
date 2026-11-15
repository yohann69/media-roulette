import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GamePIN } from "../../components/molecules/GamePIN";
import { PlayerList } from "../../components/molecules/PlayerList";
import { GameSettingsDisplay } from "../../components/molecules/GameSettingsDisplay";
import { WarningBanner } from "../../components/molecules/WarningBanner";
import { WarningModal } from "../../components/molecules/WarningModal";
import { BackgroundSlideshow } from "../../components/molecules/BackgroundSlideshow";
import { CustomModal } from "../../components/molecules/Modal";
import { UploadProgress } from "../../components/molecules/UploadProgress";
import { BackButton } from "../../components/atoms/BackButton";
import { SelectionScreen } from "../selection/SelectionScreen";
import { ExitConfirmModal } from "../../components/molecules/ExitConfirmModal";
import { LobbyFooter } from "./LobbyFooter";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";
import { useLobbySync } from "../../hooks/useLobbySync";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  state?: "selecting" | "compressing" | "uploading" | "ready";
  connected?: boolean;
  seriesWins?: number;
}

export function LobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { room, currentPlayerId, prepareGame, leaveGame, kickPlayer, updateExtras, uploadStage, uploadProgress } = useSocket();

  // Derive host status from the room when available (e.g. after play-again, the
  // new host never re-navigates with an updated `isHost` param).
  const isHost =
    (room && currentPlayerId
      ? !!room.players.find((p) => p.id === currentPlayerId)?.isHost
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
  const [selectionCount, setSelectionCount] = useState(20);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const currentPlayer = room?.players.find((p) => p.id === currentPlayerId);
  const currentPlayerState = currentPlayer?.state || "selecting";
  const blindMode = room?.settings?.blindMode || false;

  // Open selection modal while the local player picks media (blind mode skips it; upload runs silently).
  useEffect(() => {
    if (!room) return;
    // Blind mode shows the selection too, for a short "swap what you don't want" window.
    if (currentPlayerState === "selecting") {
      setShowSelectionModal(true);
    } else {
      setShowSelectionModal(false);
    }
  }, [room, currentPlayerState, blindMode]);

  const players: Player[] = room?.players.map((p) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    state: p.state || "selecting",
    connected: p.connected,
    seriesWins: p.seriesWins,
  })) || [];

  const settings = room?.settings || { rounds: 10, timer: 5, mode: "Photo" };
  // Media actually confirmed by each player (players with small libraries may have fewer).
  const totalMedia = room?.players.reduce((sum, p) => sum + (p.mediaCount ?? 0), 0) ?? 0;
  const allPlayersReady = players.length > 0 && players.every((p) => p.state === "ready");
  const hasEnoughPlayers = players.length >= 2;
  // Everyone needs the room key to decrypt the game's media (shared automatically on join).
  const everyoneHasKey = room?.players.every((p) => p.hasRoomKey) ?? false;
  const canStart = allPlayersReady && hasEnoughPlayers && everyoneHasKey && !isSyncing && !allReady;
  const hostPlayer = players.find((p) => p.isHost);
  const hostName = hostPlayer?.name || t("lobby.host");

  const handlePrepareGame = async () => {
    // Fewer media than rounds: offer to play one round per media instead.
    if (totalMedia < settings.rounds) {
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

  const handleProceedAnyway = async () => {
    setShowWarningModal(false);
    if (!pin) return;
    initiateGameStart({ rounds: totalMedia });
  };

  const handleKick = (player: Player) => {
    Alert.alert(t("lobby.removePlayerTitle", { name: player.name }), t("lobby.removePlayerMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("lobby.remove"), style: "destructive", onPress: () => pin && kickPlayer(pin, player.id) },
    ]);
  };

  const handleExitLobby = async () => {
    if (pin && room?.pin === pin) await leaveGame(pin);
    router.replace("/");
  };

  const handleConfirmExit = async () => {
    setShowExitConfirm(false);
    await handleExitLobby();
  };

  const handleCloseSelectionModal = async () => {
    // Closing the selection modal without having picked media = leave the game.
    await handleExitLobby();
  };

  return (
    <View className="flex-1 bg-black">
      <BackgroundSlideshow />
      <View className="flex-1" style={{ zIndex: 1 }}>
        <View className="px-4" style={{ paddingTop: insets.top }}>
          <BackButton onPress={() => setShowExitConfirm(true)} />
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
            <PlayerList
              players={players}
              currentUserId={currentPlayerId || undefined}
              onKick={isHost && !isSyncing && !isStarting ? handleKick : undefined}
            />
          </View>

          {/* Everyone sees what they're signing up for. */}
          <GameSettingsDisplay
            settings={settings}
            onToggleExtra={isHost && !isSyncing && !isStarting ? (key, value) => pin && updateExtras(pin, { [key]: value }) : undefined}
          />

          {isHost && allPlayersReady && <WarningBanner totalMedia={totalMedia} requiredRounds={settings.rounds} />}

          {uploadStage !== "idle" && currentPlayerState !== "ready" && (
            <UploadProgress stage={uploadStage} progress={uploadProgress} />
          )}

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

        <LobbyFooter
          isHost={isHost}
          isStarting={isStarting}
          canStart={canStart}
          allReady={allReady}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          hostName={hostName}
          onPrepareGame={handlePrepareGame}
        />

        <WarningModal
          visible={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          onWait={() => setShowWarningModal(false)}
          onProceed={handleProceedAnyway}
          totalMedia={totalMedia}
          requiredRounds={settings.rounds}
        />

        <ExitConfirmModal
          visible={showExitConfirm}
          isHost={isHost}
          onCancel={() => setShowExitConfirm(false)}
          onConfirm={handleConfirmExit}
        />

        <CustomModal
          visible={showSelectionModal}
          onClose={handleCloseSelectionModal}
          title={t("selection.title")}
          subtitle={t("selection.description", { count: selectionCount })}
          showCloseButton={true}
        >
          <SelectionScreen
            isHost={isHost ? "true" : "false"}
            pin={pin}
            onClose={() => setShowSelectionModal(false)}
            onMediaCountChange={setSelectionCount}
          />
        </CustomModal>


      </View>
    </View>
  );
}
