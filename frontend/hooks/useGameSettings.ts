import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const GAME_SETTINGS_KEY = "@photoroulette:gameSettings";

export interface GameSettings {
  rounds: number;
  timer: number;
  mode: "Photo" | "Video" | "Mix";
}

export function useGameSettings() {
  const [settings, setSettings] = useState<GameSettings>({
    rounds: 25,
    timer: 5,
    mode: "Photo",
  });

  const saveSettings = async (newSettings: GameSettings) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem(
        GAME_SETTINGS_KEY,
        JSON.stringify(newSettings)
      );
    } catch (error) {
      console.error("Error saving game settings:", error);
    }
  };

  return {
    settings,
    saveSettings,
  };
}
