import { useState, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { GamePIN } from "../../components/molecules/GamePIN";
import { PlayerList } from "../../components/molecules/PlayerList";
import { GameSettingsDisplay } from "../../components/molecules/GameSettingsDisplay";
import { WarningBanner } from "../../components/molecules/WarningBanner";
import { WarningModal } from "../../components/molecules/WarningModal";
import { BackgroundSlideshow } from "../../components/molecules/BackgroundSlideshow";
import { Button } from "../../components/atoms/Button";
import { BackButton } from "../../components/atoms/BackButton";
import { useUsername } from "../../hooks/useUsername";
import { useSocket, SOCKET_URL } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  state?: "selecting" | "uploading" | "ready";
}

export function LobbyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { username } = useUsername();
  const { 
    room, 
    currentPlayerId,
    startGame, 
    prepareGame,
    notifySyncComplete,
    setLocalMediaMap,
    onPlayerJoined, 
    onPlayerLeft, 
    onGameStarted, 
    onRoomDeleted, 
    onRoomUpdate,
    onSyncMedia,
    onPlayerReady,
    onAllPlayersReady
  } = useSocket();

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [allReady, setAllReady] = useState(false);

  const isHost = params.isHost === "true";
  const pin = params.pin || room?.pin || "";

  useEffect(() => {
    // Auto-refresh player list via socket events
    onPlayerJoined((data) => {
      console.log("Player joined:", data);
      // Room state is automatically updated via socket handler
    });

    onPlayerLeft((data) => {
      console.log("Player left:", data);
      // Room state is automatically updated via socket handler
    });

    onRoomUpdate((data) => {
      console.log("Room updated:", data);
      // Room state is automatically updated via socket handler
    });

    onGameStarted((data) => {
      console.log("Game started:", data);
      router.push({ pathname: "/game", params: { pin, isHost: isHost ? "true" : "false" } });
    });

    onRoomDeleted((data) => {
      console.log("Room deleted:", data);
      router.push("/");
    });

    onSyncMedia(async (data) => {
        setIsSyncing(true);
        setSyncStatus(t("lobby.syncingMedia"));
        const { media, count } = data; 
        
        try {
            const cacheDir = FileSystem.cacheDirectory || "";
            const gameDir = `${cacheDir}game_${pin}/`;
            await FileSystem.makeDirectoryAsync(gameDir, { intermediates: true });
            
            const newLocalMap = new Map<number, string>();

            for (let i = 0; i < media.length; i++) {
                const item = media[i];
                const fileUrl = `${SOCKET_URL}/uploads/${item.filename}`;
                const fileUri = `${gameDir}${item.filename}`;
                
                const downloadRes = await FileSystem.downloadAsync(fileUrl, fileUri);
                if (downloadRes.status !== 200) {
                    console.error("Failed to download file:", item.filename);
                } else {
                    newLocalMap.set(item.index, fileUri);
                }
                
                setSyncProgress((i + 1) / media.length);
            }
            
            setLocalMediaMap(newLocalMap);
            setSyncStatus(t("lobby.waitingForOthers"));
            await notifySyncComplete(pin);
        } catch (error) {
            console.error("Sync error:", error);
            setSyncStatus(t("common.error"));
        }
    });

    onPlayerReady((data) => {
        console.log("Player ready:", data);
    });

    onAllPlayersReady(() => {
        setAllReady(true);
        setIsSyncing(false); // Reset syncing state when all players are ready
        setSyncStatus(t("lobby.allReady"));
        if (!isHost) {
             setSyncStatus(t("lobby.waitingForHostStart"));
        }
    });

  }, [onPlayerJoined, onPlayerLeft, onGameStarted, onRoomDeleted, onRoomUpdate, onSyncMedia, onPlayerReady, onAllPlayersReady, router, pin, isHost, notifySyncComplete, setLocalMediaMap, t]);

  const players: Player[] = room?.players.map((p) => ({
    id: p.socketId,
    name: p.name,
    isHost: p.isHost,
    state: p.state || "selecting", // Include player state
  })) || [];

  const settings = room?.settings || {
    rounds: 25,
    timer: 5,
    mode: "Photo",
  };

  const totalMedia = players.length * 20; 
  const canStartGame = totalMedia >= settings.rounds;
  
  // Check if all players are ready (not selecting or uploading)
  const allPlayersReady = players.length > 0 && players.every(p => p.state === "ready");
  // Need at least 2 players to start (host + at least one other player)
  const hasEnoughPlayers = players.length >= 2;
  // Can start if: enough media, all players ready, has enough players, and either not syncing OR all ready (syncing complete)
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

  return (
    <View className="flex-1 bg-black">
      <BackgroundSlideshow />
      <View className="flex-1" style={{ zIndex: 1 }}>
        <View className="pt-5 px-4">
          <BackButton onPress={() => router.push("/")} />
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
          />
        </View>

        {isHost && <GameSettingsDisplay settings={settings} />}

        {isHost && (
          <WarningBanner
            totalMedia={totalMedia}
            requiredRounds={settings.rounds}
          />
        )}
        
        {isSyncing && (
            <View className="mt-4 p-4 bg-gray-900 rounded-lg">
                <Text className="text-white text-center mb-2">{syncStatus}</Text>
                <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <View 
                        className="h-full bg-primary" 
                        style={{ width: `${syncProgress * 100}%` }} 
                    />
                </View>
                <Text className="text-gray-400 text-center mt-1">
                    {Math.round(syncProgress * 100)}%
                </Text>
            </View>
        )}

        </ScrollView>

        {isHost ? (
          <View className="px-6 py-3 pb-8 border-t border-gray-800 bg-black/80">
          {!isSyncing || allReady ? (
              <Button
                title={isStarting ? t("lobby.starting") : t("lobby.startGame")}
                onPress={allReady ? handleStartGame : handlePrepareGame}
                variant="primary"
                disabled={isStarting || !canStart}
              />
          ) : (
              <Button
                title={t("lobby.startGame")}
                onPress={handleStartGame}
                variant="primary"
                disabled={!allReady || !canStart} 
              />
          )}
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
      </View>
    </View>
  );
}
