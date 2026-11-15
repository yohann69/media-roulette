import { View, Text, Pressable } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

type ExtraKey = "captionThis" | "storyTime";

interface GameSettingsDisplayProps {
  /** Host only: lets them turn the party extras on or off. */
  onToggleExtra?: (key: ExtraKey, value: boolean) => void;
  settings: {
    rounds: number;
    timer: number;
    mode: string;
    blindMode?: boolean;
    timeMachine?: boolean;
    slowReveal?: boolean;
    captionThis?: boolean;
    storyTime?: boolean;
  };
}

export function GameSettingsDisplay({ settings, onToggleExtra }: GameSettingsDisplayProps) {
  const { t } = useTranslation();

  const getModeLabel = (mode: string) => {
    if (settings.blindMode) return t("gameSettings.blind");
    if (settings.timeMachine) return t("gameSettings.timeMachine");
    if (settings.slowReveal) return t("gameSettings.slowReveal");
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
          {/* Mode labels already start with their emoji. */}
          {t("gameSettingsDisplay.mode", { emoji: "", mode: getModeLabel(settings.mode) }).replace(/\s+/g, " ")}
        </Text>

        {/* Party extras: every 3rd round. The host switches them on; everyone sees them. */}
        {(onToggleExtra || settings.captionThis || settings.storyTime) && (
          <View className="mt-3 pt-3 border-t border-gray-700">
            <Text className="text-gray-400 text-xs mb-2">{t("extras.title")}</Text>
            <View className="flex-row flex-wrap gap-2">
              {(["captionThis", "storyTime"] as const).map((key) => {
                const on = !!settings[key];
                if (!onToggleExtra && !on) return null;
                return (
                  <Pressable
                    key={key}
                    disabled={!onToggleExtra}
                    onPress={() => onToggleExtra?.(key, !on)}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: on, disabled: !onToggleExtra }}
                    className={`px-3 py-2 rounded-full border ${
                      on ? "bg-primary border-primary" : "bg-gray-700 border-gray-600"
                    }`}
                  >
                    <Text className={`text-sm font-semibold ${on ? "text-white" : "text-gray-300"}`}>
                      {t(`extras.${key}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {onToggleExtra && <Text className="text-gray-500 text-xs mt-2">{t("extras.hint")}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}
