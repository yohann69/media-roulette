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
    <View
      style={{
        backgroundColor: "#7c2d12",
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
      }}
    >
      <Text style={{ color: "#fca5a5", fontSize: 14, textAlign: "center" }}>
        ⚠️ Not enough media: {totalMedia} available, {requiredRounds} rounds
        needed
      </Text>
    </View>
  );
}

