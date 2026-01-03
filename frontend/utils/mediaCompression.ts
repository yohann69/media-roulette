import * as FileSystem from "expo-file-system/legacy";
import { processInBatches as processBatches } from "./parallelProcessing";

const MAX_PHOTO_SIZE_KB = 100;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_KB * 1024;
const MAX_VIDEO_SIZE_MB = 5;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
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
 * Get video duration - not critical, we always trim to maxDurationSeconds anyway
 * Returns 0 to skip duration check
 */
async function getVideoDuration(uri: string): Promise<number> {
  // Skip duration check - we'll always trim to maxDurationSeconds
  // Getting duration requires native modules which may not be available
  return 0;
}

/**
 * Compress and trim a video client-side using react-native-compressor
 * @param uri - Original video URI
 * @param maxDurationSeconds - Maximum duration in seconds (round duration + 1)
 * @param mediaName - Name/ID of the media for logging
 * @returns Compressed/trimmed video URI
 */
async function compressVideo(uri: string, maxDurationSeconds: number, mediaName?: string): Promise<string> {
  const displayName = mediaName || uri.split('/').pop() || 'unknown';
  
  try {
    // Get original file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error("File does not exist");
    }

    const originalSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
    const originalSizeFormatted = formatFileSize(originalSize);

    // Always attempt compression and trimming
    const needsCompression = originalSize > MAX_VIDEO_SIZE_BYTES;

    // If video is already small enough, we still compress/trim to ensure correct duration and format
    if (!needsCompression && originalSize <= MAX_VIDEO_SIZE_BYTES) {
      // Still compress to ensure format consistency and trim duration
      console.log(`-> compressed media ${displayName}: compressing for format consistency and trimming (${originalSizeFormatted})`);
    }

    // Try to use react-native-compressor for video processing
    let Video: any = null;
    try {
      const compressorModule = await import("react-native-compressor");
      // react-native-compressor exports Video directly
      Video = compressorModule.Video || (compressorModule as any).default?.Video || (compressorModule as any).default;
    } catch (e) {
      console.warn("react-native-compressor not available:", e);
    }

    if (Video && Video.compress) {
      // Client-side processing with react-native-compressor
      console.log(`-> compressed media ${displayName}: processing video (compress to ${MAX_VIDEO_SIZE_MB}MB, trim to ${maxDurationSeconds}s)`);
      
      try {
        // Calculate target bitrate based on max file size and duration
        // bitrate (bits/sec) = (target_size_bytes * 8) / duration_seconds
        const targetBitrate = Math.floor((MAX_VIDEO_SIZE_BYTES * 8) / maxDurationSeconds);
        
        // First attempt: auto compression
        let compressionOptions: any = {
          compressionMethod: 'auto',
        };
        
        // If file is large, use manual compression with calculated bitrate
        if (needsCompression) {
          compressionOptions = {
            compressionMethod: 'manual',
            bitrate: Math.max(300000, targetBitrate), // Minimum 300kbps, or calculated bitrate
          };
        }
        
        console.log(`-> compressed media ${displayName}: compressing with bitrate target: ${compressionOptions.bitrate || 'auto'} bps`);
        
        let compressedUri = await Video.compress(uri, compressionOptions);
        
        // Check if compression was successful
        const compressedInfo = await FileSystem.getInfoAsync(compressedUri);
        if (!compressedInfo.exists) {
          throw new Error("Compressed file does not exist");
        }
        
        const compressedSize = compressedInfo.exists && "size" in compressedInfo ? compressedInfo.size : 0;
        const compressedSizeFormatted = formatFileSize(compressedSize);
        
        // If still too large, try more aggressive compression
        if (compressedSize > MAX_VIDEO_SIZE_BYTES) {
          console.log(`-> compressed media ${displayName}: still too large (${compressedSizeFormatted}), trying more aggressive compression...`);
          
          // More aggressive: lower bitrate
          const aggressiveBitrate = Math.max(200000, Math.floor((MAX_VIDEO_SIZE_BYTES * 8) / maxDurationSeconds) * 0.7);
          const aggressiveOptions = {
            compressionMethod: 'manual' as const,
            bitrate: aggressiveBitrate,
          };
          
          compressedUri = await Video.compress(uri, aggressiveOptions);
          
          const retryInfo = await FileSystem.getInfoAsync(compressedUri);
          const retrySize = retryInfo.exists && "size" in retryInfo ? retryInfo.size : 0;
          
          if (retrySize > 0) {
            const retrySizeFormatted = formatFileSize(retrySize);
            const reduction = originalSize > 0 ? ((1 - retrySize / originalSize) * 100).toFixed(1) : '0';
            console.log(`-> compressed media ${displayName}: compressed to ${retrySizeFormatted} (${reduction}% reduction)`);
            
            // Note: react-native-compressor doesn't support duration trimming directly
            // Server will handle duration trimming during upload
            return compressedUri;
          }
        } else {
          const reduction = originalSize > 0 ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : '0';
          console.log(`-> compressed media ${displayName}: success! ${originalSizeFormatted} -> ${compressedSizeFormatted} (${reduction}% reduction)`);
          
          // Note: Duration trimming will be handled server-side
          return compressedUri;
        }
      } catch (compressorError: any) {
        console.warn(`-> compressed media ${displayName}: compression error:`, compressorError?.message || compressorError);
        // Fall through to server-side processing
      }
    }

    // Fallback: if client-side compression failed or not available
    // The video will be trimmed server-side during upload (if maxDuration is provided)
    // Note: Server-side compression is not implemented - videos may exceed 5MB if compression fails
    console.warn(`-> compressed media ${displayName}: client-side compression unavailable or failed, will use server-side trimming`);
    console.warn(`  Target: trim to ${maxDurationSeconds}s, compress to ${MAX_VIDEO_SIZE_MB}MB max`);
    console.warn(`  Current: ${originalSizeFormatted}`);
    console.warn(`  Note: Server will trim video to ${maxDurationSeconds}s during upload`);
    console.warn(`  Warning: Video may exceed ${MAX_VIDEO_SIZE_MB}MB if compression failed`);
    
    // Return original - server will handle trimming
    // Compression failed, so video may be larger than desired
    return uri;
  } catch (error) {
    console.error(`-> compressed media ${displayName}: error processing video:`, error);
    return uri;
  }
}

/**
 * Compress media if it's a photo, otherwise compress/trim video
 * @param uri - Media URI
 * @param mediaType - "photo" or "video"
 * @param mediaName - Name/ID of the media for logging
 * @param roundDurationSeconds - Round duration in seconds (for video trimming)
 * @returns Compressed URI (for photos) or compressed/trimmed URI (for videos)
 */
export async function compressMedia(
  uri: string,
  mediaType: "photo" | "video",
  mediaName?: string,
  roundDurationSeconds?: number
): Promise<string> {
  if (mediaType === "photo") {
    return await compressImage(uri, mediaName);
  }
  
  // For videos: trim to round duration + 1 second, then compress to 5MB max
  const maxDuration = roundDurationSeconds ? roundDurationSeconds + 1 : undefined;
  return await compressVideo(uri, maxDuration || 10, mediaName);
}

/**
 * Compress multiple media items in parallel (max 20 concurrent)
 * @param mediaItems - Array of media items with uri, mediaType, and optional name
 * @param onProgress - Optional callback for progress updates
 * @param roundDurationSeconds - Round duration in seconds (for video trimming)
 * @returns Array of compressed URIs in the same order
 */
export async function compressMediaBatch(
  mediaItems: Array<{ uri: string; mediaType: "photo" | "video"; id?: string; name?: string }>,
  onProgress?: (completed: number, total: number) => void,
  roundDurationSeconds?: number
): Promise<string[]> {
  console.log(`-> Starting parallel compression of ${mediaItems.length} media items (max ${MAX_PARALLEL_COMPRESSION} concurrent)`);
  
  let completed = 0;
  const results = await processBatches(
    mediaItems,
    async (item, index) => {
      const mediaName = item.name || item.id || `media_${index + 1}`;
      const compressedUri = await compressMedia(item.uri, item.mediaType, mediaName, roundDurationSeconds);
      
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
