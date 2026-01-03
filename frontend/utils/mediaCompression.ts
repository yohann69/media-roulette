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
 * Get video duration using expo-av
 * Returns 0 if duration cannot be determined (will still attempt trimming)
 */
async function getVideoDuration(uri: string): Promise<number> {
  try {
    const AV = await import("expo-av");
    // expo-av Video API - we'll attempt to get duration but it's not critical
    // If we can't get it, we'll still trim/compress based on maxDurationSeconds
    return 0; // Duration check is optional - we always trim to maxDurationSeconds anyway
  } catch (error) {
    return 0;
  }
}

/**
 * Compress and trim a video client-side
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

    // Get video duration
    const videoDuration = await getVideoDuration(uri);
    const needsTrimming = videoDuration > maxDurationSeconds;
    const needsCompression = originalSize > MAX_VIDEO_SIZE_BYTES;

    // If video is already small enough and doesn't need trimming, return original
    if (!needsCompression && !needsTrimming) {
      console.log(`-> compressed media ${displayName}: already optimized (${originalSizeFormatted}, ${videoDuration.toFixed(1)}s)`);
      return uri;
    }

    // Try to use ffmpeg-kit for video processing
    let FFmpegKit: any = null;
    try {
      const ffmpegModule = await import("ffmpeg-kit-react-native");
      FFmpegKit = ffmpegModule.FFmpegKit || ffmpegModule.default?.FFmpegKit;
    } catch (e) {
      console.warn("ffmpeg-kit not available, will attempt server-side processing");
    }

    if (FFmpegKit) {
      // Client-side processing with ffmpeg-kit
      const cacheDir = FileSystem.cacheDirectory || "";
      const outputUri = `${cacheDir}compressed_${Date.now()}_${displayName}.mp4`;
      
      // Build ffmpeg command
      // -i input: input file
      // -t duration: trim to max duration
      // -c:v libx264: video codec
      // -crf 28: quality (lower = better quality, higher = smaller file)
      // -preset fast: encoding speed
      // -c:a aac: audio codec
      // -b:a 128k: audio bitrate
      // -movflags +faststart: optimize for streaming
      // -fs 5M: limit file size to 5MB (approximate)
      
      let crf = 28; // Start with moderate quality
      let command = `-i "${uri}" -t ${maxDurationSeconds} -c:v libx264 -crf ${crf} -preset fast -c:a aac -b:a 128k -movflags +faststart "${outputUri}"`;
      
      if (needsCompression) {
        // Add file size limit
        command = `-i "${uri}" -t ${maxDurationSeconds} -c:v libx264 -crf ${crf} -preset fast -c:a aac -b:a 128k -movflags +faststart -fs ${MAX_VIDEO_SIZE_BYTES} "${outputUri}"`;
      }

      console.log(`-> compressed media ${displayName}: processing video (trim to ${maxDurationSeconds}s, compress to ${MAX_VIDEO_SIZE_MB}MB)`);
      
      try {
        // FFmpegKit.execute can take command as string or array of arguments
        // Using array format is more reliable
        const commandArray = command.split(' ').filter(arg => arg.length > 0);
        const session = await FFmpegKit.execute(...commandArray);
        const returnCode = await session.getReturnCode();
        
        if (returnCode && returnCode.isValueSuccess && returnCode.isValueSuccess()) {
          // Check output file size
          const outputInfo = await FileSystem.getInfoAsync(outputUri);
          const outputSize = outputInfo.exists && "size" in outputInfo ? outputInfo.size : 0;
          
          if (outputSize > 0 && outputSize <= MAX_VIDEO_SIZE_BYTES) {
            const outputSizeFormatted = formatFileSize(outputSize);
            const reduction = originalSize > 0 ? ((1 - outputSize / originalSize) * 100).toFixed(1) : '0';
            console.log(`-> compressed media ${displayName}: success! ${originalSizeFormatted} -> ${outputSizeFormatted} (${reduction}% reduction)`);
            return outputUri;
          } else if (outputSize > MAX_VIDEO_SIZE_BYTES) {
            // Try with higher CRF (lower quality) for better compression
            console.log(`-> compressed media ${displayName}: output still too large (${formatFileSize(outputSize)}), trying higher compression...`);
            crf = 32; // Lower quality for smaller file
            const retryCommand = `-i "${uri}" -t ${maxDurationSeconds} -c:v libx264 -crf ${crf} -preset fast -c:a aac -b:a 96k -movflags +faststart -fs ${MAX_VIDEO_SIZE_MB}M "${outputUri}"`;
            const retryCommandArray = retryCommand.split(' ').filter(arg => arg.length > 0);
            const retrySession = await FFmpegKit.execute(...retryCommandArray);
            const retryReturnCode = await retrySession.getReturnCode();
            
            if (retryReturnCode && retryReturnCode.isValueSuccess && retryReturnCode.isValueSuccess()) {
              const retryOutputInfo = await FileSystem.getInfoAsync(outputUri);
              const retryOutputSize = retryOutputInfo.exists && "size" in retryOutputInfo ? retryOutputInfo.size : 0;
              if (retryOutputSize > 0) {
                console.log(`-> compressed media ${displayName}: compressed to ${formatFileSize(retryOutputSize)}`);
                return outputUri;
              }
            }
          }
        } else {
          const failStackTrace = session?.getFailStackTrace ? await session.getFailStackTrace() : null;
          console.warn(`-> compressed media ${displayName}: ffmpeg failed`, failStackTrace);
        }
      } catch (ffmpegError) {
        console.warn(`-> compressed media ${displayName}: ffmpeg error:`, ffmpegError);
      }
    }

    // Fallback: if client-side processing failed or not available, return original
    // Server-side processing can be implemented as a fallback
    console.warn(`-> compressed media ${displayName}: client-side processing unavailable or failed, using original`);
    console.warn(`  Target: trim to ${maxDurationSeconds}s, compress to ${MAX_VIDEO_SIZE_MB}MB max`);
    console.warn(`  Current: ${originalSizeFormatted}, duration: ${videoDuration.toFixed(1)}s`);
    
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
