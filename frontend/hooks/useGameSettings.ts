import { useEffect, useState } from "react";
import { getStoredItem, setStoredItem, STORAGE_KEYS } from "../utils/storage";

export interface GameSettings {
  rounds: number;
  timer: number;
  mode: "Photo" | "Video" | "Mix";
  playVideoWithSound?: boolean;
  blindMode?: boolean;
}

const DEFAULT_SETTINGS: GameSettings = { rounds: 10, timer: 5, mode: "Photo" };

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  // Load the last used settings so the creation flow can be prefilled.
  useEffect(() => {
    getStoredItem(STORAGE_KEYS.gameSettings)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) });
      })
      .catch((error) => console.error("Error loading game settings:", error));
  }, []);

  const saveSettings = async (newSettings: GameSettings) => {
    setSettings(newSettings);
    try {
      await setStoredItem(STORAGE_KEYS.gameSettings, JSON.stringify(newSettings));
    } catch (error) {
      console.error("Error saving game settings:", error);
    }
  };

  return { settings, saveSettings };
}
