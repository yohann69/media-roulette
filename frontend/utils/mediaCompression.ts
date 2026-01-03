import * as FileSystem from "expo-file-system/legacy";
import { processInBatches as processBatches } from "./parallelProcessing";

const MAX_PHOTO_SIZE_KB = 100;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_KB * 1024;
const MAX_PARALLEL_COMPRESSION = 20;

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// Lazy load ImageManipulator to handle cases where native module isn't available
let manipulateAsyncFn: any = null;
let SaveFormatEnum: any = null;

async function loadImageManipulator() {
  if (manipulateAsyncFn && SaveFormatEnum) {
    return { manipulateAsync: manipulateAsyncFn, SaveFormat: SaveFormatEnum };
  }
  
  try {
    const module = await import("expo-image-manipulator");
    
    // Handle different export patterns
    manipulateAsyncFn = module.manipulateAsync || module.default?.manipulateAsync;
    SaveFormatEnum = module.SaveFormat;
    
    if (!SaveFormatEnum || !manipulateAsyncFn) {
      console.warn("ImageManipulator module structure unexpected");
      return null;
    }
    
    return { manipulateAsync: manipulateAsyncFn, SaveFormat: SaveFormatEnum };
  } catch (error) {
    console.warn("expo-image-manipulator not available, compression will be skipped:", error);
    return null;
  }
}


/**
 * Compress an image to be under 100KB
 * Strategy: Convert to JPEG format first (normalize), then compress
 * @param uri - Original image URI
 * @param mediaName - Name/ID of the media for logging
 * @returns Compressed image URI
 */
export async function compressImage(uri: string, mediaName?: string): Promise<string> {
  const displayName = mediaName || uri.split('/').pop() || 'unknown';
  
  try {
    const manipulatorModule = await loadImageManipulator();
    if (!manipulatorModule) {
      // If module not available, return original
      console.warn(`-> compressed media ${displayName}: compression not available, using original`);
      return uri;
    }

    const { manipulateAsync, SaveFormat } = manipulatorModule;

    // Get original file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const originalSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
    const originalSizeFormatted = formatFileSize(originalSize);

    // If already small enough, return original
    if (originalSize && originalSize <= MAX_PHOTO_SIZE_BYTES) {
      console.log(`-> compressed media ${displayName}: original size: ${originalSizeFormatted}, already under limit, no compression needed`);
      return uri;
    }

    // Step 1: Convert to JPEG format first (normalize the format)
    // This ensures we're working with a standard format before compression
    let normalizedUri = uri;
    let tempNormalizedUri: string | null = null;
    let normalizedSize = originalSize;
    
    try {
      // Convert to JPEG format (normalize)
      const normalizedResult = await manipulateAsync(
        uri,
        [], // No actions, just format conversion
        { format: SaveFormat.JPEG, compress: 0.9 } // High quality initial conversion
      );
      
      normalizedUri = normalizedResult.uri;
      if (normalizedUri !== uri) {
        tempNormalizedUri = normalizedUri; // Track for cleanup
        const normalizedInfo = await FileSystem.getInfoAsync(normalizedUri);
        if (normalizedInfo.exists && "size" in normalizedInfo) {
          normalizedSize = normalizedInfo.size || 0;
        }
      }
    } catch (error) {
      console.warn(`-> compressed media ${displayName}: failed to normalize format, using original:`, error);
      normalizedUri = uri;
    }

    // Step 2: Compress the normalized image
    let quality = 0.8;
    let width = 1920;
    let height = 1920;
    let compressedUri = normalizedUri;
    let tempCompressedUri: string | null = null;

    // Try compressing with decreasing quality until we're under the limit
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const manipResult = await manipulateAsync(
          normalizedUri,
          [{ resize: { width, height } }],
          { compress: quality, format: SaveFormat.JPEG }
        );

        const compressedInfo = await FileSystem.getInfoAsync(manipResult.uri);
        const compressedSize = compressedInfo.exists && "size" in compressedInfo ? compressedInfo.size : 0;
        
        if (compressedSize && compressedSize <= MAX_PHOTO_SIZE_BYTES) {
          // Success! Clean up intermediate files
          if (tempNormalizedUri && tempNormalizedUri !== manipResult.uri) {
            try {
              await FileSystem.deleteAsync(tempNormalizedUri, { idempotent: true });
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          if (tempCompressedUri && tempCompressedUri !== manipResult.uri) {
            try {
              await FileSystem.deleteAsync(tempCompressedUri, { idempotent: true });
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          
          const compressedSizeFormatted = formatFileSize(compressedSize);
          const reduction = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : '0';
          console.log(`-> compressed media ${displayName}: original size: ${originalSizeFormatted}, compressed size: ${compressedSizeFormatted} (${reduction}% reduction)`);
          
          return manipResult.uri;
        }

        // Clean up previous attempt if it exists
        if (tempCompressedUri && tempCompressedUri !== manipResult.uri) {
          try {
            await FileSystem.deleteAsync(tempCompressedUri, { idempotent: true });
          } catch (e) {
            // Ignore cleanup errors
          }
        }

        // If still too large, reduce quality and/or size
        quality = Math.max(0.3, quality - 0.15);
        width = Math.floor(width * 0.8);
        height = Math.floor(height * 0.8);
        compressedUri = manipResult.uri;
        tempCompressedUri = manipResult.uri;
      } catch (error) {
        console.error(`-> compressed media ${displayName}: compression attempt ${attempt + 1} failed:`, error);
        // Continue to next attempt
      }
    }

    // Get final compressed size for logging
    const finalInfo = await FileSystem.getInfoAsync(compressedUri);
    const finalSize = finalInfo.exists && "size" in finalInfo ? finalInfo.size : 0;
    const finalSizeFormatted = formatFileSize(finalSize);
    const reduction = originalSize > 0 ? ((1 - finalSize / originalSize) * 100).toFixed(1) : '0';
    console.log(`-> compressed media ${displayName}: original size: ${originalSizeFormatted}, compressed size: ${finalSizeFormatted} (${reduction}% reduction, best effort)`);

    // Clean up normalized file if we created one and it's not the final result
    if (tempNormalizedUri && tempNormalizedUri !== compressedUri) {
      try {
        await FileSystem.deleteAsync(tempNormalizedUri, { idempotent: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Return the best compression we achieved
    return compressedUri;
  } catch (error) {
    console.error(`-> compressed media ${displayName}: error compressing image:`, error);
    // Return original if compression fails
    return uri;
  }
}

/**
 * Compress media if it's a photo, otherwise return original
 * @param uri - Media URI
 * @param mediaType - "photo" or "video"
 * @param mediaName - Name/ID of the media for logging
 * @returns Compressed URI (for photos) or original URI (for videos)
 */
export async function compressMedia(
  uri: string,
  mediaType: "photo" | "video",
  mediaName?: string
): Promise<string> {
  if (mediaType === "photo") {
    return await compressImage(uri, mediaName);
  }
  // Videos are not compressed (too complex for on-device compression)
  const displayName = mediaName || uri.split('/').pop() || 'unknown';
  console.log(`-> compressed media ${displayName}: video, skipping compression`);
  return uri;
}

/**
 * Compress multiple media items in parallel (max 20 concurrent)
 * @param mediaItems - Array of media items with uri, mediaType, and optional name
 * @param onProgress - Optional callback for progress updates
 * @returns Array of compressed URIs in the same order
 */
export async function compressMediaBatch(
  mediaItems: Array<{ uri: string; mediaType: "photo" | "video"; id?: string; name?: string }>,
  onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
  console.log(`-> Starting parallel compression of ${mediaItems.length} media items (max ${MAX_PARALLEL_COMPRESSION} concurrent)`);
  
  let completed = 0;
  const results = await processBatches(
    mediaItems,
    async (item, index) => {
      const mediaName = item.name || item.id || `media_${index + 1}`;
      const compressedUri = await compressMedia(item.uri, item.mediaType, mediaName);
      
      completed++;
      if (onProgress) {
        onProgress(completed, mediaItems.length);
      }
      
      return compressedUri;
    },
    MAX_PARALLEL_COMPRESSION
  );

  console.log(`-> Completed parallel compression of ${mediaItems.length} media items`);
  return results;
}
