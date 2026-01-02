import { View, Text } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

interface WarningBannerProps {
  totalMedia: number;
  requiredRounds: number;
}

export function WarningBanner({
  totalMedia,
  requiredRounds,
}: WarningBannerProps) {
  const { t } = useTranslation();

  if (totalMedia >= requiredRounds) {
    return null;
  }

  return (
    <View className="bg-orange-900 rounded-xl p-3 mb-4">
      <Text className="text-orange-200 text-sm text-center">
        {t("warning.notEnoughMediaBanner", { total: totalMedia, rounds: requiredRounds })}
      </Text>
    </View>
  );
}
