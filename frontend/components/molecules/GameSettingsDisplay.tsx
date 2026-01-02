import { View, Text } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

interface GameSettingsDisplayProps {
  settings: {
    rounds: number;
    timer: number;
    mode: string;
  };
}

export function GameSettingsDisplay({ settings }: GameSettingsDisplayProps) {
  const { t } = useTranslation();

  const getModeEmoji = (mode: string) => {
    if (mode === "Photo") return "📸";
    if (mode === "Video") return "🎞️";
    return "🎉";
  };

  const getModeLabel = (mode: string) => {
    if (mode === "Photo") return t("gameSettings.photo");
    if (mode === "Video") return t("gameSettings.video");
    return t("gameSettings.mix");
  };

  return (
    <View className="mb-4">
      <Text className="text-gray-400 text-sm mb-2">{t("gameSettingsDisplay.title")}</Text>
      <View className="bg-gray-800 rounded-xl p-4">
        <Text className="text-white text-sm mb-1">
          {t("gameSettingsDisplay.rounds", { count: settings.rounds })}
        </Text>
        <Text className="text-white text-sm mb-1">
          {t("gameSettingsDisplay.timer", { seconds: settings.timer })}
        </Text>
        <Text className="text-white text-sm">
          {t("gameSettingsDisplay.mode", { emoji: getModeEmoji(settings.mode), mode: getModeLabel(settings.mode) })}
        </Text>
      </View>
    </View>
  );
}
