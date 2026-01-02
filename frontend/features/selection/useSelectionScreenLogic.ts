import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";
import { useSocket, SOCKET_URL } from "../../stores/useSocket";
import { compressMedia } from "../../utils/mediaCompression";

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
      // Upload files one by one
      const uploadedMedia = [];
      const total = media.length;

      for (let i = 0; i < total; i++) {
        const item = media[i];
        
        // Compress media before uploading (photos only, max 100kb)
        const compressedUri = await compressMedia(item.uri, item.mediaType);
        
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
        
        // Clean up compressed file if it's different from original
        if (compressedUri !== item.uri) {
          try {
            await FileSystem.deleteAsync(compressedUri, { idempotent: true });
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        if (uploadResult.status !== 200) {
          console.error("Failed to upload file", uploadResult);
          throw new Error("Upload failed");
        }

        const response = JSON.parse(uploadResult.body);
        uploadedMedia.push({
          id: item.id,
          mediaType: item.mediaType,
          filename: response.filename,
          // We don't need to send URI or Base64 to socket, just the backend filename reference
        });

        setUploadProgress((i + 1) / total);
      }

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
