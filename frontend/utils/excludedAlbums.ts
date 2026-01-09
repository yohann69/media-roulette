import AsyncStorage from "@react-native-async-storage/async-storage";

const EXCLUDED_ALBUMS_KEY = "@photoroulette:excludedAlbums";

export async function loadExcludedAlbums(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(EXCLUDED_ALBUMS_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw) as string[];
    return new Set(ids);
  } catch (error) {
    console.error("Failed to load excluded albums", error);
    return new Set();
  }
}

export async function saveExcludedAlbums(ids: Set<string>): Promise<void> {
  try {
    const arr = Array.from(ids);
    await AsyncStorage.setItem(EXCLUDED_ALBUMS_KEY, JSON.stringify(arr));
  } catch (error) {
    console.error("Failed to save excluded albums", error);
  }
}


