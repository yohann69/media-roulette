import { View, Text } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";
import type { UploadStage } from "../../stores/useSocket";

interface UploadProgressProps {
  stage: UploadStage;
  progress: number;
}

export function UploadProgress({ stage, progress }: UploadProgressProps) {
  const { t } = useTranslation();

  if (stage === "idle") return null;

  const label =
    stage === "compressing"
      ? t("lobby.compressingMedia")
      : t("lobby.uploadingMedia");

  return (
    <View className="mt-4 p-4 bg-gray-900 rounded-lg">
      <Text className="text-white text-center mb-2">{label}</Text>
      <View className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <View
          className="h-full bg-primary"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </View>
      <Text className="text-gray-400 text-center mt-1">
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
}
