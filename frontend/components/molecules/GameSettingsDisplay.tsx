import { View, Text } from "react-native";
import { GameSettings } from "../../hooks/useGameSettings";

interface GameSettingsDisplayProps {
  settings: GameSettings;
}

export function GameSettingsDisplay({ settings }: GameSettingsDisplayProps) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: "#9ca3af",
          fontSize: 14,
          marginBottom: 8,
        }}
      >
        Game Settings
      </Text>
      <View
        style={{
          backgroundColor: "#1f2937",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 14, marginBottom: 4 }}>
          Rounds: {settings.rounds}
        </Text>
        <Text style={{ color: "#ffffff", fontSize: 14, marginBottom: 4 }}>
          Timer: {settings.timer}s
        </Text>
        <Text style={{ color: "#ffffff", fontSize: 14 }}>
          Mode: {settings.mode}
        </Text>
      </View>
    </View>
  );
}

