import { getStoredItem, setStoredItem, STORAGE_KEYS } from "./storage";

export async function loadExcludedAlbums(): Promise<Set<string>> {
  try {
    const raw = await getStoredItem(STORAGE_KEYS.excludedAlbums);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch (error) {
    console.error("Failed to load excluded albums", error);
    return new Set();
  }
}

export async function saveExcludedAlbums(ids: Set<string>): Promise<void> {
  try {
    await setStoredItem(STORAGE_KEYS.excludedAlbums, JSON.stringify(Array.from(ids)));
  } catch (error) {
    console.error("Failed to save excluded albums", error);
  }
}
