import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";
import { useSocket } from "../../stores/useSocket";

export function useSelectionScreenLogic(params: { isHost?: string; pin?: string; playAgain?: string }) {
  const router = useRouter();
  const { setMediaPool, room } = useSocket();
  
  // Get game mode from room settings
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
  
  // Refetch media when room settings change
  useEffect(() => {
    if (room?.settings?.mode && permissionGranted && !loading) {
      console.log("Room settings updated, media type:", mediaType);
    }
  }, [room?.settings?.mode, mediaType, permissionGranted, loading]);

  const isHost = params.isHost === "true";
  const pin = params.pin || "";
  const playAgain = params.playAgain === "true";
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const initializeMedia = async () => {
      if (!isHost && !room) {
        return;
      }
      
      if (permissionGranted && media.length === 0 && !loading) {
        await fetchMedia(mediaCount, mediaType);
      } else if (!permissionGranted && !loading) {
        const granted = await requestPermission();
        if (granted) {
          await fetchMedia(mediaCount, mediaType);
        }
      }
    };

    initializeMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, isHost, mediaType, mediaCount]);

  const handleReady = async () => {
    if (!pin) {
      console.error("No PIN available");
      return;
    }

    if (media.length === 0) {
      console.error("No media to upload");
      return;
    }

    setIsUploading(true);

    try {
      if (isHost || playAgain) {
        console.log(`Uploading ${media.length} media items for PIN ${pin}${playAgain ? " (play again)" : ""}`);
        const success = await setMediaPool(pin, media, playAgain);
        if (!success) {
          console.error("Failed to upload media pool");
          setIsUploading(false);
          return;
        }
        console.log("Media pool uploaded successfully");
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
    handleReady,
    handleReroll,
    requestPermission,
  };
}

