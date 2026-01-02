import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";

const MAX_PHOTO_SIZE_KB = 100;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_KB * 1024;

/**
 * Compress an image to be under 100KB
 * @param uri - Original image URI
 * @returns Compressed image URI
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    // Get original file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    // If already small enough, return original
    if (fileInfo.exists && "size" in fileInfo && fileInfo.size && fileInfo.size <= MAX_PHOTO_SIZE_BYTES) {
      return uri;
    }

    // Start with a reasonable quality and size
    let quality = 0.8;
    let width = 1920;
    let height = 1920;
    let compressedUri = uri;

    // Try compressing with decreasing quality until we're under the limit
    for (let attempt = 0; attempt < 5; attempt++) {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width, height } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );

      const compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
      
      if (compressedInfo.exists && "size" in compressedInfo && compressedInfo.size && compressedInfo.size <= MAX_PHOTO_SIZE_BYTES) {
        // If this is not the original, delete the previous compressed version
        if (compressedUri !== uri && compressedUri !== manipResult.uri) {
          try {
            await FileSystem.deleteAsync(compressedUri, { idempotent: true });
          } catch (e) {
            // Ignore deletion errors
          }
        }
        return manipResult.uri;
      }

      // If still too large, reduce quality and/or size
      quality = Math.max(0.3, quality - 0.15);
      width = Math.floor(width * 0.8);
      height = Math.floor(height * 0.8);
      compressedUri = manipResult.uri;
    }

    // If we still couldn't get it small enough, return the last attempt
    // (it will be as small as we can make it)
    return compressedUri;
  } catch (error) {
    console.error("Error compressing image:", error);
    // Return original if compression fails
    return uri;
  }
}

/**
 * Compress media if it's a photo, otherwise return original
 * @param uri - Media URI
 * @param mediaType - "photo" or "video"
 * @returns Compressed URI (for photos) or original URI (for videos)
 */
export async function compressMedia(
  uri: string,
  mediaType: "photo" | "video"
): Promise<string> {
  if (mediaType === "photo") {
    return await compressImage(uri);
  }
  // Videos are not compressed (too complex for on-device compression)
  return uri;
}

