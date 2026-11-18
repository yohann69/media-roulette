import { Album, AssetField, MediaSubtype, MediaType as LibraryMediaType, Query } from "expo-media-library";
import type { AssetMetadata } from "expo-media-library";
import { loadExcludedAlbums } from "./excludedAlbums";

export type MediaType = "photo" | "video" | "mixed";

export interface MediaAsset {
  /** Media library id (`ph://…` on iOS, `content://…` on Android). */
  id: string;
  /**
   * URI usable by expo-image, expo-image-manipulator and the video toolkit.
   * The library id is directly loadable on both platforms, so no file path has
   * to be resolved (which on iOS could trigger an iCloud download).
   */
  uri: string;
  mediaType: "photo" | "video";
  width: number;
  height: number;
  creationTime: number;
  /** Duration in milliseconds (videos only). */
  duration: number | null;
}

/** How many of the most recent items are eligible for the random draw. */
const CANDIDATE_POOL_SIZE = 5000;
/** Videos longer than this are skipped: only a short clip is used in-game. */
export const MAX_VIDEO_DURATION_MS = 10 * 60 * 1000;
const MIN_VIDEO_DURATION_MS = 1000;

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function loadExcludedAssetIds(): Promise<Set<string>> {
  const excludedAlbumIds = await loadExcludedAlbums();
  const ids = new Set<string>();
  if (excludedAlbumIds.size === 0) return ids;

  // Metadata only (ids): much lighter than loading full Asset objects.
  const results = await Promise.all(
    Array.from(excludedAlbumIds).map((albumId) =>
      new Query().album(new Album(albumId)).exeForMetadata().catch(() => []) // album may have been deleted
    )
  );
  results.forEach((assets) => assets.forEach((asset) => ids.add(asset.id)));
  return ids;
}

/**
 * Lightweight metadata for the media the game may use. Screenshots and screen
 * recordings are skipped (they rarely make good rounds and often contain private
 * conversations), as are videos that are too short or too long to clip.
 */
export async function queryCandidates(
  kind: "photo" | "video",
  limit: number = CANDIDATE_POOL_SIZE
): Promise<AssetMetadata[]> {
  const items = await new Query()
    .eq(AssetField.MEDIA_TYPE, kind === "photo" ? LibraryMediaType.IMAGE : LibraryMediaType.VIDEO)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(limit)
    .exeForMetadata();

  return items.filter((item) => {
    if (item.mediaSubtypes?.includes(MediaSubtype.SCREENSHOT)) return false;
    if (item.mediaSubtypes?.includes(MediaSubtype.SCREEN_RECORDING)) return false;
    // Filtered here rather than in the query: the query's duration unit differs
    // between iOS (seconds) and Android (milliseconds). Metadata is always in ms.
    if (kind === "video") {
      const duration = item.duration ?? 0;
      return duration >= MIN_VIDEO_DURATION_MS && duration <= MAX_VIDEO_DURATION_MS;
    }
    return true;
  });
}

function toMediaAsset(item: AssetMetadata, kind: "photo" | "video"): MediaAsset {
  return {
    id: item.id,
    uri: item.id,
    mediaType: kind,
    width: item.width ?? 0,
    height: item.height ?? 0,
    creationTime: item.creationTime ?? 0,
    duration: item.duration,
  };
}

// Swapping one item at a time shouldn't re-query the library on every tap.
const CANDIDATE_CACHE_MS = 60_000;
const candidateCache = new Map<string, { at: number; items: Promise<AssetMetadata[]> }>();

function cachedCandidates(kind: "photo" | "video"): Promise<AssetMetadata[]> {
  const cached = candidateCache.get(kind);
  if (cached && Date.now() - cached.at < CANDIDATE_CACHE_MS) return cached.items;
  const items = queryCandidates(kind);
  candidateCache.set(kind, { at: Date.now(), items });
  items.catch(() => candidateCache.delete(kind));
  return items;
}

/**
 * One new random item of the given type, different from everything in `avoidIds`.
 * Used to swap a single item in the selection grid.
 */
export async function pickReplacement(kind: "photo" | "video", avoidIds: Set<string>): Promise<MediaAsset | null> {
  const excluded = await loadExcludedAssetIds();
  const candidates = (await cachedCandidates(kind)).filter((item) => !excluded.has(item.id) && !avoidIds.has(item.id));
  if (candidates.length === 0) return null;
  return toMediaAsset(candidates[Math.floor(Math.random() * candidates.length)], kind);
}

async function pickRandom(kind: "photo" | "video", count: number, excluded: Set<string>) {
  const candidates = (await cachedCandidates(kind)).filter((item) => !excluded.has(item.id));
  return shuffle(candidates)
    .slice(0, count)
    .map((item) => toMediaAsset(item, kind));
}

/**
 * Picks random media from the device library.
 * - "photo" / "video": `count` items of that type.
 * - "mixed": up to 20 photos followed by up to 20 videos.
 */
export async function fetchRandomMedia(count: number = 20, type: MediaType = "mixed"): Promise<MediaAsset[]> {
  const excluded = await loadExcludedAssetIds();

  if (type === "photo" || type === "video") {
    return pickRandom(type, count, excluded);
  }

  const [photos, videos] = await Promise.all([
    pickRandom("photo", 20, excluded),
    pickRandom("video", 20, excluded),
  ]);
  return [...photos, ...videos];
}
