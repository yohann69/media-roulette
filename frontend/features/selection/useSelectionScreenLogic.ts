import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";
import { useSocket, SOCKET_URL } from "../../stores/useSocket";
import { compressMediaBatch } from "../../utils/mediaCompression";
import { processInBatches } from "../../utils/parallelProcessing";

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

  // Auto-upload in blind mode when media is loaded
  useEffect(() => {
    if (blindMode && media.length > 0 && !loading && !isUploading && permissionGranted && !blindModeUploadTriggered.current) {
      console.log("Blind mode: Auto-uploading media without showing selection");
      blindModeUploadTriggered.current = true;
      // Use setTimeout to avoid calling handleReady during render
      const timer = setTimeout(() => {
        handleReady();
      }, 100);
      return () => clearTimeout(timer);
    }
    // Reset trigger if blind mode is disabled or media changes
    if (!blindMode || media.length === 0) {
      blindModeUploadTriggered.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blindMode, media.length, loading, isUploading, permissionGranted]);

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

        // Step 1: Compress all media in parallel (max 20 concurrent)
        // Get round duration from room settings for video trimming
        const roundDurationSeconds = room?.settings?.timer || 5;
        console.log(`-> Starting compression of ${mediaToUpload.length} media items...`);
        const compressedUris = await compressMediaBatch(
          mediaToUpload.map((item, index) => ({
            uri: item.uri,
            mediaType: item.mediaType,
            id: item.id,
            name: `media_${index + 1}_${item.id}`,
          })),
          (completed, total) => {
            setUploadProgress(completed / (total * 2)); // Compression is 50% of total progress
            setUploadStatus("compressing", completed / total);
          },
          roundDurationSeconds
        );

        // Step 2: Upload files in parallel (max 20 concurrent)
        console.log(`-> Starting parallel upload of ${mediaToUpload.length} media items...`);
        const total = mediaToUpload.length;
        const MAX_PARALLEL_UPLOAD = 20;
        let uploadCompleted = 0;
        setUploadStatus("uploading", 0);
        // Flip the shared player state from "compressing" to "uploading" so
        // the player list in every lobby reflects the current phase.
        await setPlayerState(pin, "uploading");

        // Use the same parallel processing utility for uploads
        const uploadResults = await processInBatches(
          mediaToUpload.map((item, index) => ({ item, compressedUri: compressedUris[index], index })),
          async (data, idx) => {
            const { item, compressedUri } = data;
            
            // Upload to backend
            // For videos, include maxDuration for server-side trimming fallback
            const uploadOptions: any = {
              fieldName: "media",
              httpMethod: "POST",
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            };
            
            // Add maxDuration parameter for videos (server-side trimming fallback)
            if (item.mediaType === "video" && room?.settings?.timer) {
              const maxDuration = (room.settings.timer + 1).toString();
              uploadOptions.parameters = { maxDuration };
            }
            
            const uploadResult = await FileSystem.uploadAsync(
              `${SOCKET_URL}/upload`,
              compressedUri,
              uploadOptions
            );

            if (uploadResult.status !== 200) {
              console.error(`Failed to upload file ${idx + 1}:`, uploadResult);
              throw new Error(`Upload failed for media ${idx + 1}`);
            }

            const response = JSON.parse(uploadResult.body);
            
            // Clean up compressed file if it's different from original
            if (compressedUri !== item.uri) {
              try {
                await FileSystem.deleteAsync(compressedUri, { idempotent: true });
              } catch (e) {
                // Ignore cleanup errors
              }
            }

            // Update progress (upload is 50-100% of total progress)
            uploadCompleted++;
            setUploadProgress(0.5 + (uploadCompleted / total) * 0.5);
            setUploadStatus("uploading", uploadCompleted / total);

            return {
              id: item.id,
              mediaType: item.mediaType,
              filename: response.filename,
            };
          },
          MAX_PARALLEL_UPLOAD
        );

        const uploadedMedia = uploadResults;

        console.log(`Uploaded ${uploadedMedia.length} files`);
        
        const success = await setMediaPool(pin, uploadedMedia, playAgain);
        if (!success) {
          console.error("Failed to set media pool");
          setIsUploading(false);
          setUploadStatus("idle", 0);
          // Optionally set state back to selecting on error
          await setPlayerState(pin, "selecting");
          return;
        }

        // Status will be updated to "ready" by setMediaPool in the backend
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
    requestPermission,
    blindMode,
    mediaCount,
  };
}
