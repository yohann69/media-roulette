import { View, Text } from "react-native";
import { QRCode } from "./QRCode";

interface GamePINProps {
  pin: string;
}

export function GamePIN({ pin }: GamePINProps) {
  const qrValue = `photoroulette://join?pin=${pin}`;

  return (
    <View className="items-center mb-8">
      <Text className="text-gray-400 text-base mb-4 text-center">
        Share this PIN or scan the QR code
      </Text>
      <Text className="text-primary text-5xl font-bold tracking-wider mb-6">
        {pin}
      </Text>
      <QRCode value={qrValue} size={180} />
    </View>
  );
}
