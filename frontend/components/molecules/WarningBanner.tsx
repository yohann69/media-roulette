import { View, Text } from "react-native";

interface WarningBannerProps {
  totalMedia: number;
  requiredRounds: number;
}

export function WarningBanner({
  totalMedia,
  requiredRounds,
}: WarningBannerProps) {
  if (totalMedia >= requiredRounds) {
    return null;
  }

  return (
    <View className="bg-orange-900 rounded-xl p-3 mb-4">
      <Text className="text-orange-200 text-sm text-center">
        ⚠️ Not enough media: {totalMedia} available, {requiredRounds} rounds
        needed
      </Text>
    </View>
  );
}
