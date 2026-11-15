import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  username: "@mediaroulette:username",
  gameSettings: "@mediaroulette:gameSettings",
  excludedAlbums: "@mediaroulette:excludedAlbums",
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

// Values saved before the app was renamed used the "@photoroulette:" prefix.
const LEGACY_PREFIX = "@photoroulette:";
const CURRENT_PREFIX = "@mediaroulette:";

/**
 * Reads a value, transparently migrating it from the pre-rename key the first time.
 */
export async function getStoredItem(key: StorageKey): Promise<string | null> {
  const value = await AsyncStorage.getItem(key);
  if (value !== null) return value;

  const legacyKey = key.replace(CURRENT_PREFIX, LEGACY_PREFIX);
  const legacyValue = await AsyncStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    await AsyncStorage.setItem(key, legacyValue);
    await AsyncStorage.removeItem(legacyKey);
  }
  return legacyValue;
}

export function setStoredItem(key: StorageKey, value: string): Promise<void> {
  return AsyncStorage.setItem(key, value);
}

export function removeStoredItem(key: StorageKey): Promise<void> {
  return AsyncStorage.removeItem(key);
}
