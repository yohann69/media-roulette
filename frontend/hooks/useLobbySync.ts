import { useEffect, useState, useRef } from "react";
import { useRouter } from "expo-router";
import { Directory, File, Paths } from "expo-file-system";
import { processInBatches } from "../utils/parallelProcessing";
import { useSocket, SOCKET_URL } from "../stores/useSocket";
import { useTranslation } from "./useTranslation";

interface UseLobbySyncParams {
  pin: string;
  isHost: boolean;
}

export function useLobbySync({ pin, isHost }: UseLobbySyncParams) {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    startGame,
    notifySyncComplete,
    setLocalMediaMap,
    onPlayerJoined,
    onPlayerLeft,
    onGameStarted,
    onRoomDeleted,
    onRoomUpdate,
    onSyncMedia,
    onPlayerReady,
    onAllPlayersReady,
  } = useSocket();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [allReady, setAllReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    onPlayerJoined((data) => {
      console.log("Player joined:", data);
    });

    onPlayerLeft((data) => {
      console.log("Player left:", data);
    });

    onRoomUpdate((data) => {
      console.log("Room updated:", data);
    });

    onGameStarted((data) => {
      console.log("Game started:", data);
      hasAutoStartedRef.current = false;
      router.push({ pathname: "/game", params: { pin, isHost: isHost ? "true" : "false" } });
    });

    onRoomDeleted((data) => {
      console.log("Room deleted:", data);
      router.push("/");
    });

    onSyncMedia(async (data) => {
      setIsSyncing(true);
      setSyncStatus(t("lobby.syncingMedia"));
      const { media } = data;

      try {
        const gameDir = new Directory(Paths.cache, `game_${pin}`);
        if (!gameDir.exists) gameDir.create({ intermediates: true });

        const { uploadToken } = useSocket.getState();
        const newLocalMap = new Map<number, string>();
        let completed = 0;

        await processInBatches(
          media as Array<{ index: number; filename: string }>,
          async (item) => {
            try {
              const file = await File.downloadFileAsync(
                `${SOCKET_URL}/media/${pin}/${item.filename}`,
                new File(gameDir, item.filename),
                { headers: { "x-upload-token": uploadToken ?? "" }, idempotent: true }
              );
              newLocalMap.set(item.index, file.uri);
            } catch (error) {
              console.error("Failed to download file:", item.filename, error);
            }
            completed++;
            setSyncProgress(completed / media.length);
          },
          3
        );

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

    onAllPlayersReady(async () => {
      if (hasAutoStartedRef.current) return;

      setAllReady(true);
      setIsSyncing(false);
      setSyncStatus(t("lobby.allReady"));

      const currentRoom = useSocket.getState().room;
      if (isHost && currentRoom?.gameState === "syncing" && !hasAutoStartedRef.current) {
        hasAutoStartedRef.current = true;
        setIsStarting(true);
        setTimeout(async () => {
          const roomState = useSocket.getState().room;
          if (pin && roomState?.gameState === "syncing") {
            await startGame(pin);
          } else {
            hasAutoStartedRef.current = false;
            setIsStarting(false);
          }
        }, 500);
      } else if (!isHost) {
        setSyncStatus(t("lobby.waitingForHostStart"));
      }
    });
  }, [onPlayerJoined, onPlayerLeft, onGameStarted, onRoomDeleted, onRoomUpdate, onSyncMedia, onPlayerReady, onAllPlayersReady, router, pin, isHost, notifySyncComplete, setLocalMediaMap, startGame, t]);

  return {
    isSyncing,
    syncProgress,
    syncStatus,
    allReady,
    isStarting,
    setIsStarting,
    setSyncStatus,
  };
}
