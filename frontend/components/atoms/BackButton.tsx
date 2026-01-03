import { TouchableOpacity, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "../../hooks/useTranslation";

interface BackButtonProps {
  onPress?: () => void;
  variant?: "icon" | "text";
}

export function BackButton({ onPress, variant = "icon" }: BackButtonProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  if (variant === "text") {
    return (
      <TouchableOpacity
        onPress={handlePress}
        className="py-2 px-4"
        activeOpacity={0.7}
      >
        <Text className="text-white text-base font-semibold">
          {t("common.back")}
        </Text>
      </TouchableOpacity>
    );
  }

  // Icon variant
  let ArrowLeft: any = null;
  try {
    const lucide = require("lucide-react-native");
    ArrowLeft = lucide.ArrowLeft;
  } catch {
    // Fallback to text if icon not available
    return (
      <TouchableOpacity
        onPress={handlePress}
        className="py-2 px-4"
        activeOpacity={0.7}
      >
        <Text className="text-white text-2xl">←</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="p-2"
      activeOpacity={0.7}
    >
      <ArrowLeft size={24} color="#ffffff" />
    </TouchableOpacity>
  );
}

