import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { File, UploadType } from "expo-file-system";
import { processInBatches } from "../utils/parallelProcessing";
import { downloadAndDecrypt, encryptForUpload } from "../utils/gameMedia";
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

  // The host started the game and some of our media was chosen: encrypt and
  // upload just those items. The rest of our selection never leaves the phone.
  useSocketEvent<{ items: string[] }>("upload-request", async ({ items }) => {
    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatus(t("lobby.preparingGame"));

    const { roomKey, uploadToken, preparedMedia, myUploads } = useSocket.getState();
    const done: Array<{ id: string; filename: string }> = [];
    if (!roomKey || !uploadToken) {
      console.warn("Can't share media yet: missing room key");
      useSocket.getState().socket?.emit("uploads-complete", { pin, items: done });
      return;
    }

    let completed = 0;
    await processInBatches(
      items,
      async (id) => {
        const prepared = preparedMedia.get(id);
        if (!prepared) return;
        let encrypted: File | null = null;
        try {
          encrypted = await encryptForUpload(prepared.uri, roomKey, id);
          const result = await encrypted.upload(`${SOCKET_URL}/upload`, {
            httpMethod: "POST",
            uploadType: UploadType.MULTIPART,
            fieldName: "media",
            mimeType: "application/octet-stream",
            headers: { "x-upload-token": uploadToken },
          });
          if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
          const { filename } = JSON.parse(result.body) as { filename: string };
          myUploads.set(filename, id);
          done.push({ id, filename });
        } catch (error) {
          console.error("Failed to share media", id, error);
        } finally {
          encrypted?.delete();
          completed++;
          setSyncProgress(completed / items.length);
        }
      },
      3
    );
    useSocket.getState().socket?.emit("uploads-complete", { pin, items: done });
  });

  useSocketEvent<{ media: Array<{ index: number; filename: string; mediaType: "photo" | "video" }> }>(
    "sync-media",
    async ({ media }) => {
      if (syncInProgress.current) return;
      syncInProgress.current = true;
      setIsSyncing(true);
      setSyncProgress(0);
      setSyncStatus(t("lobby.syncingMedia"));

      try {
        const { uploadToken, roomKey, preparedMedia, myUploads } = useSocket.getState();
        const localMap = new Map(useSocket.getState().localMediaMap);
        let completed = 0;

        await processInBatches(
          media,
          async (item) => {
            if (!localMap.has(item.index)) {
              // Our own media: show the local copy, no download needed.
              const ownId = myUploads.get(item.filename);
              const own = ownId ? preparedMedia.get(ownId) : undefined;
              if (own) {
                localMap.set(item.index, own.uri);
              } else if (roomKey && uploadToken) {
                try {
                  localMap.set(
                    item.index,
                    await downloadAndDecrypt({
                      url: `${SOCKET_URL}/media/${pin}/${item.filename}`,
                      token: uploadToken,
                      roomKey,
                      pin,
                      index: item.index,
                      mediaType: item.mediaType,
                    })
                  );
                } catch (error) {
                  console.error("Failed to get media", item.filename, error);
                }
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
    }
  );

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
