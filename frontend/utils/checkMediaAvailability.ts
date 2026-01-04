import * as MediaLibrary from "expo-media-library";
import { MediaType } from "./fetchRandomMedia";

interface MediaAvailabilityResult {
  hasEnough: boolean;
  photoCount: number;
  videoCount: number;
  requiredPhotos: number;
  requiredVideos: number;
}

/**
 * Checks if the user has enough media in their gallery for the selected game mode
 * @param mode - Game mode: 'Photo', 'Video', 'Mix', or 'Blind'
 * @returns Promise with availability result
 */
export async function checkMediaAvailability(mode: "Photo" | "Video" | "Mix" | "Blind"): Promise<MediaAvailabilityResult> {
  try {
    // Request permission if needed
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== "granted") {
      const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
      if (newStatus !== "granted") {
        return {
          hasEnough: false,
          photoCount: 0,
          videoCount: 0,
          requiredPhotos: mode === "Photo" || mode === "Blind" ? 10 : mode === "Mix" ? 10 : 0,
          requiredVideos: mode === "Video" ? 10 : mode === "Mix" ? 10 : 0,
        };
      }
    }

    let photoCount = 0;
    let videoCount = 0;

    if (mode === "Photo" || mode === "Blind" || mode === "Mix") {
      const photos = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: 1, // We only need the count
      });
      photoCount = photos.totalCount;
    }

    if (mode === "Video" || mode === "Mix") {
      const videos = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: 1, // We only need the count
      });
      videoCount = videos.totalCount;
    }

    const requiredPhotos = mode === "Photo" || mode === "Blind" ? 10 : mode === "Mix" ? 10 : 0;
    const requiredVideos = mode === "Video" ? 10 : mode === "Mix" ? 10 : 0;

    const hasEnough = photoCount >= requiredPhotos && videoCount >= requiredVideos;

    return {
      hasEnough,
      photoCount,
      videoCount,
      requiredPhotos,
      requiredVideos,
    };
  } catch (error) {
    console.error("Error checking media availability:", error);
    return {
      hasEnough: false,
      photoCount: 0,
      videoCount: 0,
      requiredPhotos: mode === "Photo" || mode === "Blind" ? 10 : mode === "Mix" ? 20 : 0,
      requiredVideos: mode === "Video" ? 10 : mode === "Mix" ? 20 : 0,
    };
  }
}

