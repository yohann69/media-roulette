import { useState, useEffect, useRef } from "react";
import { getPermissionsAsync, requestPermissionsAsync } from "expo-media-library";
import { fetchRandomMedia, MediaAsset, MediaType, pickReplacement } from "../utils/fetchRandomMedia";

interface UseMediaFetcherReturn {
  media: MediaAsset[];
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  fetchMedia: (count?: number, type?: MediaType) => Promise<void>;
  reroll: () => Promise<void>;
  /**
   * Replaces a single item with another random one of the same type. When the
   * library has nothing else to offer, the item is removed instead (the last
   * remaining item is kept). Returns false if nothing changed.
   */
  replaceItem: (index: number) => Promise<boolean>;
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

  // Every item ever shown in this selection, so a swap never brings one back.
  const seenIds = useRef(new Set<string>());
  useEffect(() => {
    media.forEach((m) => seenIds.current.add(m.id));
  }, [media]);

  const replaceItem = async (index: number): Promise<boolean> => {
    const current = media[index];
    if (!current) return false;
    try {
      const replacement = await pickReplacement(current.mediaType, seenIds.current);
      if (!replacement) {
        if (media.length <= 1) return false;
        setMedia((prev) => prev.filter((m) => m.id !== current.id));
        return true;
      }
      seenIds.current.add(replacement.id);
      setMedia((prev) => prev.map((m, i) => (i === index ? replacement : m)));
      return true;
    } catch (err) {
      console.warn("Could not swap media:", err);
      return false;
    }
  };

  useEffect(() => {
    getPermissionsAsync().then(({ status }) => setPermissionGranted(status === "granted"));
  }, []);

  return { media, loading, error, permissionGranted, requestPermission, fetchMedia, reroll, replaceItem };
}
