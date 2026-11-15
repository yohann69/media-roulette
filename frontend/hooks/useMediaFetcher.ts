import { useState, useEffect } from "react";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-media-library";
import { fetchRandomMedia, MediaAsset, MediaType } from "../utils/fetchRandomMedia";

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
      const { status } = await requestPermissionsAsync();
      const granted = status === "granted";
      setPermissionGranted(granted);
      if (!granted) setError("Media library permission denied");
      return granted;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request permission");
      setPermissionGranted(false);
      return false;
    }
  };

  const fetchMedia = async (count: number = initialCount, type: MediaType = initialType) => {
    if (!permissionGranted) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedMedia = await fetchRandomMedia(count, type);

      if (media.length > 0 && media.length === fetchedMedia.length) {
        // Reroll: swap items one by one for a smooth animation
        for (let i = 0; i < fetchedMedia.length; i++) {
          setTimeout(() => {
            setMedia((prev) => {
              const updated = [...prev];
              updated[i] = fetchedMedia[i];
              return updated;
            });
          }, i * 30);
        }
      } else {
        setMedia(fetchedMedia);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch media");
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const reroll = async () => {
    await fetchMedia(initialCount, initialType);
  };

  useEffect(() => {
    getPermissionsAsync().then(({ status }) => setPermissionGranted(status === "granted"));
  }, []);

  return { media, loading, error, permissionGranted, requestPermission, fetchMedia, reroll };
}
