import * as FileSystem from "expo-file-system";

/**
 * Convert image URI to Base64 (React Native compatible)
 */
export async function convertImageToBase64(uri: string): Promise<string> {
  try {
    // Use expo-file-system to read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });
    return base64;
  } catch (error) {
    console.error("Error converting image to Base64:", error);
    // Fallback: return the URI as-is (backend can handle it)
    return uri;
  }
}

/**
 * Process media pool for upload (convert photos to Base64)
 * For now, we'll send URIs for all media to avoid conversion issues
 * In production, you'd want to compress and convert images
 */
export async function processMediaPool(mediaPool: any[]) {
  // For MVP, we'll send URIs directly instead of Base64 to avoid conversion issues
  // The backend can handle URIs and convert them if needed, or we can do it client-side later
  return Promise.all(
    mediaPool.map(async (item) => {
      // For now, just send the URI - Base64 conversion can be done later if needed
      // Converting 20 images to Base64 can be slow and cause memory issues
      return {
        id: item.id,
        mediaType: item.mediaType,
        uri: item.uri,
        // Optionally convert photos to Base64 (commented out for performance)
        // base64: item.mediaType === "photo" ? await convertImageToBase64(item.uri) : undefined,
      };
    })
  );
}
