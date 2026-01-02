import { View, Text } from "react-native";
import { GameSettings } from "../../hooks/useGameSettings";

interface GameSettingsDisplayProps {
  settings: GameSettings;
}

export function GameSettingsDisplay({ settings }: GameSettingsDisplayProps) {
  const getModeEmoji = (mode: string) => {
    if (mode === "Photo") return "📸";
    if (mode === "Video") return "🎞️";
    return "🎉";
  };

  return (
    <View className="mb-4">
      <Text className="text-gray-400 text-sm mb-2">Game Settings</Text>
      <View className="bg-gray-800 rounded-xl p-4">
        <Text className="text-white text-sm mb-1">
          Rounds: {settings.rounds}
        </Text>
        <Text className="text-white text-sm mb-1">
          Timer: {settings.timer}s
        </Text>
        <Text className="text-white text-sm">
          Mode: {getModeEmoji(settings.mode)} {settings.mode}
        </Text>
      </View>
    </View>
  );
}
