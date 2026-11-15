import { getPermissionsAsync, requestPermissionsAsync } from "expo-media-library";
import { queryCandidates } from "./fetchRandomMedia";

interface MediaAvailabilityResult {
  hasEnough: boolean;
  photoCount: number;
  videoCount: number;
  requiredPhotos: number;
  requiredVideos: number;
  /** True when the user only granted access to a subset of their library (iOS / Android 14+). */
  limitedAccess: boolean;
}

type Mode = "Photo" | "Video" | "Mix" | "Blind";

function requirements(mode: Mode) {
  // Mix needs a full selection grid in each phase (20 photos then 20 videos).
  return {
    requiredPhotos: mode === "Photo" || mode === "Blind" ? 10 : mode === "Mix" ? 20 : 0,
    requiredVideos: mode === "Video" ? 10 : mode === "Mix" ? 20 : 0,
  };
}

/**
 * Checks that the user has enough usable media for the selected game mode,
 * asking for library access if it hasn't been granted yet.
 */
export async function checkMediaAvailability(mode: Mode): Promise<MediaAvailabilityResult> {
  const { requiredPhotos, requiredVideos } = requirements(mode);
  const empty = { hasEnough: false, photoCount: 0, videoCount: 0, requiredPhotos, requiredVideos, limitedAccess: false };

  try {
    let permission = await getPermissionsAsync();
    if (permission.status !== "granted") {
      permission = await requestPermissionsAsync();
      if (permission.status !== "granted") return empty;
    }

    // We don't need the library's full size, just enough usable items once
    // screenshots are filtered out.
    const CHECK_LIMIT = 500;
    const [photos, videos] = await Promise.all([
      requiredPhotos > 0 ? queryCandidates("photo", CHECK_LIMIT) : Promise.resolve([]),
      requiredVideos > 0 ? queryCandidates("video", CHECK_LIMIT) : Promise.resolve([]),
    ]);

    return {
      hasEnough: photos.length >= requiredPhotos && videos.length >= requiredVideos,
      photoCount: photos.length,
      videoCount: videos.length,
      requiredPhotos,
      requiredVideos,
      limitedAccess: permission.accessPrivileges === "limited",
    };
  } catch (error) {
    console.error("Error checking media availability:", error);
    return empty;
  }
}
