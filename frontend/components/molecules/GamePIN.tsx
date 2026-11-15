import { View, Text } from "react-native";
import { QRCode } from "./QRCode";

interface GamePINProps {
  pin: string;
}

export function GamePIN({ pin }: GamePINProps) {
  const qrValue = `mediaroulette://join?pin=${pin}`;

  return (
    <View className="items-center mb-8">
      <Text className="text-primary text-7xl font-bold tracking-wider mb-6">
        {pin}
      </Text>
      <QRCode value={qrValue} size={180} />
    </View>
  );
}
