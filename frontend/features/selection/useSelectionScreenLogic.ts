import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";
import { useSocket, SOCKET_URL } from "../../stores/useSocket";
import { compressMediaBatch } from "../../utils/mediaCompression";
import { processInBatches } from "../../utils/parallelProcessing";

export function useSelectionScreenLogic(params: { isHost?: string; pin?: string; playAgain?: string }) {
  const router = useRouter();
  const { setMediaPool, room } = useSocket();
  
  const gameMode = room?.settings?.mode || "Photo";
  const mediaType = gameMode === "Photo" ? "photo" : gameMode === "Video" ? "video" : "mixed";
  const mediaCount = mediaType === "mixed" ? 40 : 20;
  
  const {
    media,
    loading,
    error,
    permissionGranted,
    requestPermission,
    fetchMedia,
  } = useMediaFetcher(mediaCount, mediaType);
  
  useEffect(() => {
    if (room?.settings?.mode && permissionGranted && !loading) {
      console.log("Room settings updated, media type:", mediaType);
    }
  }, [room?.settings?.mode, mediaType, permissionGranted, loading]);

  const isHost = params.isHost === "true";
  const pin = params.pin || "";
  const playAgain = params.playAgain === "true";
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const initializeMedia = async () => {
      if (!isHost && !room) return;
      if (permissionGranted && media.length === 0 && !loading) {
        await fetchMedia(mediaCount, mediaType);
      } else if (!permissionGranted && !loading) {
        const granted = await requestPermission();
        if (granted) await fetchMedia(mediaCount, mediaType);
      }
    };
    initializeMedia();
  }, [room, isHost, mediaType, mediaCount]);

  const handleReady = async () => {
    if (!pin) return;
    if (media.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Compress all media in parallel (max 20 concurrent)
      console.log(`-> Starting compression of ${media.length} media items...`);
      const compressedUris = await compressMediaBatch(
        media.map((item, index) => ({
          uri: item.uri,
          mediaType: item.mediaType,
          id: item.id,
          name: `media_${index + 1}_${item.id}`,
        })),
        (completed, total) => {
          setUploadProgress(completed / (total * 2)); // Compression is 50% of total progress
        }
      );

      // Step 2: Upload files in parallel (max 20 concurrent)
      console.log(`-> Starting parallel upload of ${media.length} media items...`);
      const total = media.length;
      const MAX_PARALLEL_UPLOAD = 20;
      let uploadCompleted = 0;

      // Use the same parallel processing utility for uploads
      const uploadResults = await processInBatches(
        media.map((item, index) => ({ item, compressedUri: compressedUris[index], index })),
        async (data, idx) => {
          const { item, compressedUri } = data;
          
          // Upload to backend
          const uploadResult = await FileSystem.uploadAsync(
            `${SOCKET_URL}/upload`,
            compressedUri,
            {
              fieldName: "media",
              httpMethod: "POST",
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            }
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
        return;
      }

      setIsUploading(false);
      const updatedIsHost = playAgain ? true : isHost;
      router.push({ 
        pathname: "/lobby", 
        params: { isHost: updatedIsHost ? "true" : "false", pin } 
      });
    } catch (error) {
      console.error("Error in handleReady:", error);
      setIsUploading(false);
    }
  };

  const handleReroll = async () => {
    await fetchMedia(mediaCount, mediaType);
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
  };
}
