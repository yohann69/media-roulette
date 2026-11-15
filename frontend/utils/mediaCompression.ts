import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import MediaToolkit from "react-native-media-toolkit";
import { processInBatches } from "./parallelProcessing";

/**
 * Local media preparation before anything leaves the device.
 *
 * Photos: decoded directly at game size (the full-resolution original is never
 * loaded into memory), then re-encoded as JPEG. Re-encoding always happens, so
 * EXIF data such as GPS location is never uploaded.
 *
 * Videos: trimmed to a short clip and re-encoded at 720p in a single native pass
 * (AVFoundation on iOS, Media3 on Android). Source metadata is not carried over.
 */

/** Longest edge of an in-game photo. Sharp on any phone held in portrait. */
const PHOTO_MAX_EDGE = 1440;
const PHOTO_QUALITY = 0.75;

/** Video clip: only a few seconds are ever played in a round. */
const VIDEO_CLIP_EXTRA_MS = 2000;
const VIDEO_MIN_CLIP_MS = 6000;
/** Bitrate scales with the output resolution, within these bounds. */
const VIDEO_MAX_BITRATE = 1_500_000;
const VIDEO_MIN_BITRATE = 200_000;
const VIDEO_BITS_PER_PIXEL = 0.07; // per frame, at ~30 fps: a good H.264 quality/size balance
const VIDEO_PORTRAIT_WIDTH = 720;
const VIDEO_LANDSCAPE_WIDTH = 1280;

/** Decoding is memory-heavy: keep concurrency low to avoid out-of-memory kills. */
const PHOTO_CONCURRENCY = 2;
const VIDEO_CONCURRENCY = 1;

export interface MediaToCompress {
  uri: string;
  mediaType: "photo" | "video";
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  /** Video duration in milliseconds, if known. */
  duration?: number | null;
}

export interface CompressOptions {
  /** Round duration in seconds; videos are clipped to slightly more than this. */
  roundDurationSeconds?: number;
  /** When false, the audio track is dropped from videos (smaller files). */
  keepVideoAudio?: boolean;
}

function toFileUri(pathOrUri: string): string {
  return pathOrUri.startsWith("/") ? `file://${pathOrUri}` : pathOrUri;
}

function logSize(label: string, uri: string) {
  if (!__DEV__) return;
  try {
    const size = new File(uri).size ?? 0;
    console.log(`-> ${label}: ${(size / 1024).toFixed(0)} KB`);
  } catch {
    // Size logging is best-effort
  }
}

export async function compressImage(uri: string, name = "photo"): Promise<string> {
  const context = ImageManipulator.manipulate(uri, {
    maxWidth: PHOTO_MAX_EDGE,
    maxHeight: PHOTO_MAX_EDGE,
  });
  const image = await context.renderAsync();
  try {
    const result = await image.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });
    logSize(`photo ${name} ${result.width}x${result.height}`, result.uri);
    return result.uri;
  } finally {
    image.release();
    context.release();
  }
}

export async function compressVideo(
  item: MediaToCompress,
  { roundDurationSeconds = 5, keepVideoAudio = true }: CompressOptions = {}
): Promise<string> {
  const clipMs = Math.max(VIDEO_MIN_CLIP_MS, roundDurationSeconds * 1000 + VIDEO_CLIP_EXTRA_MS);
  const isLandscape = (item.width ?? 0) > (item.height ?? 0);
  const needsTrim = item.duration == null || item.duration > clipMs;
  const targetWidth = isLandscape ? VIDEO_LANDSCAPE_WIDTH : VIDEO_PORTRAIT_WIDTH;
  const bitrate = videoBitrate(item.width, item.height, targetWidth);

  const result = await MediaToolkit.compressVideo(item.uri, {
    startTime: 0,
    endTime: needsTrim ? clipMs : undefined,
    bitrate,
    width: targetWidth,
    muteAudio: !keepVideoAudio,
  });
  const uri = toFileUri(result.uri);
  logSize(`video ${item.name ?? ""} ${result.width}x${result.height} ${result.duration}ms`, uri);
  return uri;
}

/**
 * Bitrate for the output resolution: small clips don't need 1.5 Mbps.
 * Videos are never upscaled, so the output is at most the source size.
 */
export function videoBitrate(width: number | undefined, height: number | undefined, targetWidth: number): number {
  if (!width || !height) return VIDEO_MAX_BITRATE;
  const scale = Math.min(1, targetWidth / width);
  const pixels = width * height * scale * scale;
  const bitrate = pixels * 30 * VIDEO_BITS_PER_PIXEL;
  return Math.round(Math.min(VIDEO_MAX_BITRATE, Math.max(VIDEO_MIN_BITRATE, bitrate)));
}

/**
 * Compresses every item. Items that fail are returned as `null` and must be
 * skipped by the caller: originals are never uploaded as a fallback.
 */
export async function compressMediaBatch(
  items: MediaToCompress[],
  onProgress?: (completed: number, total: number) => void,
  options: CompressOptions = {}
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(items.length).fill(null);
  let completed = 0;

  const run = (mediaType: "photo" | "video", concurrency: number) => {
    const indexed = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.mediaType === mediaType);

    return processInBatches(
      indexed,
      async ({ item, index }) => {
        try {
          results[index] =
            mediaType === "photo"
              ? await compressImage(item.uri, item.name)
              : await compressVideo(item, options);
        } catch (error) {
          console.warn(`Could not prepare ${mediaType} ${item.name ?? index}, skipping it:`, error);
          results[index] = null;
        }
        completed++;
        onProgress?.(completed, items.length);
      },
      concurrency
    );
  };

  await run("photo", PHOTO_CONCURRENCY);
  await run("video", VIDEO_CONCURRENCY);
  return results;
}

/** Deletes a temporary file produced by this module. Never touches library assets. */
export function deleteTempFile(uri: string | null | undefined) {
  if (!uri || !uri.startsWith("file://")) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cleanup is best-effort
  }
}
