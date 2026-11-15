import { View, Text, Pressable, Share } from "react-native";
import { Share2 } from "lucide-react-native";
import { QRCode } from "./QRCode";
import { SOCKET_URL } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";

interface GamePINProps {
  pin: string;
}

/** Link that opens the app on the join screen (or explains how to get it). */
export function inviteLink(pin: string) {
  return `${SOCKET_URL.replace(/\/$/, "")}/j/${pin}`;
}

export function GamePIN({ pin }: GamePINProps) {
  const { t } = useTranslation();
  const link = inviteLink(pin);

  const handleShare = () => {
    Share.share({ message: t("lobby.inviteMessage", { pin, link }) }).catch(() => {});
  };

  return (
    <View className="items-center mb-8">
      <Text className="text-primary text-7xl font-bold tracking-wider mb-6">
        {pin}
      </Text>
      {/* A web link: the phone's own camera app can open it too. */}
      <QRCode value={link} size={180} />
      <Pressable
        onPress={handleShare}
        accessibilityRole="button"
        accessibilityLabel={t("lobby.shareInvite")}
        className="flex-row items-center gap-2 mt-4 px-5 py-3 rounded-full bg-gray-800 active:opacity-70"
      >
        <Share2 size={18} color="#ffffff" />
        <Text className="text-white text-base font-semibold">{t("lobby.shareInvite")}</Text>
      </Pressable>
    </View>
  );
}
