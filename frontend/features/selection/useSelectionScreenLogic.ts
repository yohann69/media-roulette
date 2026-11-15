import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";
import { useSocket } from "../../stores/useSocket";
import { compressMediaBatch } from "../../utils/mediaCompression";
import { storePrepared } from "../../utils/gameMedia";

/** How long players can swap items in blind mode before their media is confirmed. */
const TRUST_WINDOW_SECONDS = 10;

export function useSelectionScreenLogic(
  params: { isHost?: string; pin?: string; playAgain?: string },
  onClose?: () => void
) {
  const router = useRouter();
  const { setMediaPool, room, setUploadStatus } = useSocket();
  
  const gameMode = room?.settings?.mode || "Photo";
  const blindMode = room?.settings?.blindMode || false;
  const isMixMode = !blindMode && gameMode === "Mix";
  // Blind mode uses photos but with blind mode enabled
  const initialMediaType = blindMode
    ? "photo"
    : gameMode === "Photo"
    ? "photo"
    : gameMode === "Video"
    ? "video"
    : "photo"; // Mix will start with photos
  const initialMediaCount = 20;
  
  const {
    media,
    loading,
    error,
    permissionGranted,
    requestPermission,
    fetchMedia,
    replaceItem,
  } = useMediaFetcher(initialMediaCount, initialMediaType as any);

  const [phase, setPhase] = useState<"single" | "photos" | "videos">(
    isMixMode ? "photos" : "single"
  );
  const [collectedMedia, setCollectedMedia] = useState<typeof media>([]);
  const mediaCount = initialMediaCount;

  const getCurrentMediaType = () => {
    if (isMixMode) {
      return (phase === "videos" ? "video" : "photo") as any;
    }
    return initialMediaType as any;
  };
  
  const isHost = params.isHost === "true";
  const pin = params.pin || "";
  const playAgain = params.playAgain === "true";
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const blindModeUploadTriggered = useRef(false);

  useEffect(() => {
    const initializeMedia = async () => {
      if (!isHost && !room) return;
      if (permissionGranted && media.length === 0 && !loading) {
        await fetchMedia(initialMediaCount, getCurrentMediaType());
      } else if (!permissionGranted && !loading) {
        const granted = await requestPermission();
        if (granted) {
          await fetchMedia(initialMediaCount, getCurrentMediaType());
        }
      }
    };
    initializeMedia();
  }, [room, isHost, isMixMode, phase, initialMediaType]);

  // Blind ("trust") mode: the media is picked for you, but you get a short
  // window to swap anything you'd rather not share before it's confirmed.
  const [trustSecondsLeft, setTrustSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!blindMode || media.length === 0 || loading || isUploading || blindModeUploadTriggered.current) return;
    blindModeUploadTriggered.current = true;
    let seconds = TRUST_WINDOW_SECONDS;
    setTrustSecondsLeft(seconds);
    const interval = setInterval(() => {
      seconds -= 1;
      setTrustSecondsLeft(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        handleReadyRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blindMode, media.length, loading, isUploading]);

  const handleReady = async () => {
    if (!pin) return;
    if (media.length === 0) return;

    // Mix mode: first confirm photos, then videos
    if (isMixMode && phase === "photos") {
      setCollectedMedia(media);
      setPhase("videos");
      await fetchMedia(initialMediaCount, "video" as any);
      return;
    }

    const { setPlayerState } = useSocket.getState();

    // Announce local compression to the rest of the lobby right away, then
    // navigate. We switch to "uploading" once compression finishes below so
    // the other players' lobby reflects the real phase the current user is in.
    await setPlayerState(pin, "compressing");
    setIsUploading(true);
    
    const updatedIsHost = playAgain ? true : isHost;
    
    // Navigate immediately.
    // When `onClose` is provided the SelectionScreen is mounted as a modal from
    // within the lobby, so we just close the modal and stay on the lobby route.
    // Without `onClose` we are on the standalone /selection route and need to
    // push the lobby screen.
    if (onClose) {
      onClose();
    } else {
      router.push({ 
        pathname: "/lobby", 
        params: { isHost: updatedIsHost ? "true" : "false", pin } 
      });
    }

    // Prepare media to upload (combine photos + videos in mix mode)
    const mediaToUpload =
      isMixMode && phase === "videos" ? [...collectedMedia, ...media] : media;

    // Do compression and upload in background
    (async () => {
      try {
        setUploadProgress(0);
        setUploadStatus("compressing", 0);

        // Step 1: prepare every item locally (resize/re-encode photos, clip videos)
        const compressedUris = await compressMediaBatch(
          mediaToUpload.map((item, index) => ({
            uri: item.uri,
            mediaType: item.mediaType,
            id: item.id,
            name: `media_${index + 1}`,
            width: item.width,
            height: item.height,
            duration: item.duration,
          })),
          (completed, total) => {
            setUploadProgress(completed / (total * 2)); // Compression is 50% of total progress
            setUploadStatus("compressing", completed / total);
          },
          {
            roundDurationSeconds: room?.settings?.timer || 5,
            keepVideoAudio: room?.settings?.playVideoWithSound !== false,
          }
        );

        // Items that couldn't be prepared are dropped: originals are never shared.
        // The prepared copies stay on this phone: only the ones chosen for the game
        // are encrypted and uploaded when it starts.
        const prepared = new Map<string, { uri: string; mediaType: "photo" | "video" }>();
        mediaToUpload.forEach((item, index) => {
          const compressedUri = compressedUris[index];
          if (!compressedUri) return;
          const id = `m${index}`;
          prepared.set(id, { uri: storePrepared(compressedUri, id, item.mediaType), mediaType: item.mediaType });
        });
        if (prepared.size === 0) throw new Error("No media could be prepared");
        useSocket.getState().setPreparedMedia(prepared);

        // Time Machine: the year each item was taken, the only metadata ever shared.
        // The server keeps it to itself until the round's reveal.
        const timeMachine = !!room?.settings?.timeMachine;
        const yearById = new Map<string, number>();
        mediaToUpload.forEach((item, index) => {
          const year = item.creationTime ? new Date(item.creationTime).getFullYear() : NaN;
          if (timeMachine && Number.isInteger(year) && year >= 1900) yearById.set(`m${index}`, year);
        });
        const uploadedMedia = Array.from(prepared, ([id, { mediaType }]) => ({
          id,
          mediaType,
          ...(yearById.has(id) ? { year: yearById.get(id) } : {}),
        }));
        const success = await setMediaPool(pin, uploadedMedia, playAgain);
        if (!success) {
          console.error("Failed to set media pool");
          setIsUploading(false);
          setUploadStatus("idle", 0);
          await setPlayerState(pin, "selecting");
          return;
        }

        // The server marks us ready; nothing has left the phone yet.
        setIsUploading(false);
        setUploadStatus("idle", 1);
      } catch (error) {
        console.error("Error in background upload:", error);
        setIsUploading(false);
        setUploadStatus("idle", 0);
        // Set state back to selecting on error
        await setPlayerState(pin, "selecting");
      }
    })();
  };

  const handleReadyRef = useRef(handleReady);
  handleReadyRef.current = handleReady;

  const handleReroll = async () => {
    await fetchMedia(mediaCount, getCurrentMediaType());
  };

  return {
    media,
    loading,
    error,
    permissionGranted,
    isUploading,
    uploadProgress,
    handleReady,
    handleReroll,
    replaceItem,
    requestPermission,
    blindMode,
    trustSecondsLeft,
    mediaCount,
  };
}
