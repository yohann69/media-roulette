import { useState, useEffect } from "react";
import * as MediaLibrary from "expo-media-library";
import { fetchRandomMedia, MediaType } from "../utils/fetchRandomMedia";

interface MediaAsset {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
  width: number;
  height: number;
  creationTime: number;
}

interface UseMediaFetcherReturn {
  media: MediaAsset[];
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  fetchMedia: (count?: number, type?: MediaType) => Promise<void>;
  reroll: () => Promise<void>;
}

export function useMediaFetcher(
  initialCount: number = 20,
  initialType: MediaType = "mixed"
): UseMediaFetcherReturn {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const requestPermission = async (): Promise<boolean> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      const granted = status === "granted";
      setPermissionGranted(granted);
      if (!granted) {
        setError("Media library permission denied");
      }
      return granted;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to request permission";
      setError(errorMessage);
      setPermissionGranted(false);
      return false;
    }
  };

  const fetchMedia = async (
    count: number = initialCount,
    type: MediaType = initialType
  ) => {
    if (!permissionGranted) {
      const granted = await requestPermission();
      if (!granted) {
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedMedia = await fetchRandomMedia(count, type);
      setMedia(fetchedMedia);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch media";
      setError(errorMessage);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const reroll = async () => {
    await fetchMedia(initialCount, initialType);
  };

  useEffect(() => {
    // Check existing permission status
    MediaLibrary.getPermissionsAsync().then(({ status }) => {
      setPermissionGranted(status === "granted");
    });
  }, []);

  return {
    media,
    loading,
    error,
    permissionGranted,
    requestPermission,
    fetchMedia,
    reroll,
  };
}

