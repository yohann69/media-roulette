import { View, Text } from "react-native";
import { QRCode } from "./QRCode";
import { SOCKET_URL } from "../../stores/useSocket";

interface GamePINProps {
  pin: string;
}

/** Link that opens the app on the join screen (or explains how to get it). */
export function inviteLink(pin: string) {
  return `${SOCKET_URL.replace(/\/$/, "")}/j/${pin}`;
}

export function GamePIN({ pin }: GamePINProps) {
  return (
    <View className="items-center mb-8">
      <Text className="text-primary text-7xl font-bold tracking-wider mb-6">
        {pin}
      </Text>
      {/* A web link: the phone's own camera app can open it too. */}
      <QRCode value={inviteLink(pin)} size={180} />
    </View>
  );
}
