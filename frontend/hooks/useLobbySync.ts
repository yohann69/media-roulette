import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { Directory, File, Paths } from "expo-file-system";
import { processInBatches } from "../utils/parallelProcessing";
import { useSocket, SOCKET_URL } from "../stores/useSocket";
import { useSocketEvent } from "./useSocketEvent";
import { useTranslation } from "./useTranslation";

interface UseLobbySyncParams {
  pin: string;
  isHost: boolean;
}

/**
 * Downloads the game's media when the host starts the game. The server starts
 * the first round by itself once every player has the media.
 */
export function useLobbySync({ pin, isHost }: UseLobbySyncParams) {
  const router = useRouter();
  const { t } = useTranslation();
  const notifySyncComplete = useSocket((s) => s.notifySyncComplete);
  const setLocalMediaMap = useSocket((s) => s.setLocalMediaMap);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");
  const [allReady, setAllReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const syncInProgress = useRef(false);

  useSocketEvent("game-started", () => {
    router.replace({ pathname: "/game", params: { pin, isHost: isHost ? "true" : "false" } });
  });

  useSocketEvent<{ media: Array<{ index: number; filename: string }> }>("sync-media", async ({ media }) => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatus(t("lobby.syncingMedia"));

    try {
      const gameDir = new Directory(Paths.cache, `game_${pin}`);
      if (!gameDir.exists) gameDir.create({ intermediates: true });

      const { uploadToken } = useSocket.getState();
      const localMap = new Map(useSocket.getState().localMediaMap);
      let completed = 0;

      await processInBatches(
        media,
        async (item) => {
          if (!localMap.has(item.index)) {
            try {
              const file = await File.downloadFileAsync(
                `${SOCKET_URL}/media/${pin}/${item.filename}`,
                new File(gameDir, item.filename),
                { headers: { "x-upload-token": uploadToken ?? "" }, idempotent: true }
              );
              localMap.set(item.index, file.uri);
            } catch (error) {
              console.error("Failed to download file:", item.filename, error);
            }
          }
          completed++;
          setSyncProgress(completed / media.length);
        },
        3
      );

      setLocalMediaMap(localMap);
      setSyncStatus(t("lobby.waitingForOthers"));
      await notifySyncComplete(pin);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus(t("common.error"));
    } finally {
      syncInProgress.current = false;
    }
  });

  useSocketEvent("all-players-ready", () => {
    setAllReady(true);
    setIsSyncing(false);
    setSyncStatus(t("lobby.allReady"));
  });

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
