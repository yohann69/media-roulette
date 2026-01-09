import * as MediaLibrary from "expo-media-library";
import { loadExcludedAlbums } from "./excludedAlbums";

export type MediaType = "photo" | "video" | "mixed";

interface MediaAsset {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
  width: number;
  height: number;
  creationTime: number;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Fetches random media items from the device
 * @param count - Number of items to return (default: 20)
 * @param type - Type of media to fetch: 'photo', 'video', or 'mixed'
 * @returns Array of media assets
 */
export async function fetchRandomMedia(
  count: number = 20,
  type: MediaType = "mixed"
): Promise<MediaAsset[]> {
  try {
    // Load excluded albums and build a set of excluded asset IDs
    const excludedAlbumIds = await loadExcludedAlbums();
    const excludedAssetIds = new Set<string>();

    if (excludedAlbumIds.size > 0) {
      const allAlbums = await MediaLibrary.getAlbumsAsync();
      const targetAlbums = allAlbums.filter((a) => excludedAlbumIds.has(a.id));

      if (targetAlbums.length > 0) {
        const results = await Promise.all(
          targetAlbums.map((album) =>
            MediaLibrary.getAssetsAsync({
              album,
              first: 10000,
            })
          )
        );

        results.forEach((res) => {
          res.assets.forEach((asset) => excludedAssetIds.add(asset.id));
        });
      }
    }

    let allAssets: MediaLibrary.Asset[] = [];

    if (type === "photo" || type === "mixed") {
      const photos = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: 1000, // Fetch a large batch
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      const filtered = photos.assets.filter(
        (asset) => !excludedAssetIds.has(asset.id)
      );
      allAssets = [...allAssets, ...filtered];
    }

    if (type === "video" || type === "mixed") {
      const videos = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.video,
        first: 1000, // Fetch a large batch
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      const filtered = videos.assets.filter(
        (asset) => !excludedAssetIds.has(asset.id)
      );
      allAssets = [...allAssets, ...filtered];
    }

    // Shuffle all assets
    const shuffled = shuffleArray(allAssets);

    if (type === "photo") {
      // For photo mode: only photos, exactly count items
      const photos = shuffled.filter(
        (asset) => asset.mediaType === MediaLibrary.MediaType.photo
      );
      const selected = shuffleArray(photos).slice(0, Math.min(count, photos.length));

      return selected.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        mediaType: "photo" as const,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
      }));
    }

    if (type === "video") {
      // For video mode: only videos, exactly count items
      const videos = shuffled.filter(
        (asset) => asset.mediaType === MediaLibrary.MediaType.video
      );
      const selected = shuffleArray(videos).slice(0, Math.min(count, videos.length));

      return selected.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        mediaType: "video" as const,
        width: asset.width,
        height: asset.height,
        creationTime: asset.creationTime,
      }));
    }

    if (type === "mixed") {
      // For mixed: pick 20 photos first, then 20 videos (40 total)
      const photos = shuffled.filter(
        (asset) => asset.mediaType === MediaLibrary.MediaType.photo
      );
      const videos = shuffled.filter(
        (asset) => asset.mediaType === MediaLibrary.MediaType.video
      );

      const photoCount = Math.min(20, photos.length);
      const videoCount = Math.min(20, videos.length);

      const selectedPhotos = shuffleArray(photos).slice(0, photoCount);
      const selectedVideos = shuffleArray(videos).slice(0, videoCount);

      return [
        ...selectedPhotos.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          mediaType: "photo" as const,
          width: asset.width,
          height: asset.height,
          creationTime: asset.creationTime,
        })),
        ...selectedVideos.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          mediaType: "video" as const,
          width: asset.width,
          height: asset.height,
          creationTime: asset.creationTime,
        })),
      ];
    }

    // Fallback: just pick random items
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    return selected.map((asset) => ({
      id: asset.id,
      uri: asset.uri,
      mediaType:
        asset.mediaType === MediaLibrary.MediaType.photo ? "photo" : "video",
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
    }));
  } catch (error) {
    console.error("Error fetching media:", error);
    throw error;
  }
}


