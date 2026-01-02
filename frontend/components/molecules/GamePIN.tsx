import { View, Text } from "react-native";
import { QRCode } from "./QRCode";

interface GamePINProps {
  pin: string;
}

export function GamePIN({ pin }: GamePINProps) {
  const qrValue = `photoroulette://join?pin=${pin}`;

  return (
    <View style={{ alignItems: "center", marginBottom: 32 }}>
      <Text
        style={{
          color: "#9ca3af",
          fontSize: 16,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        Share this PIN or scan the QR code
      </Text>
      <Text
        style={{
          color: "#3b82f6",
          fontSize: 48,
          fontWeight: "bold",
          letterSpacing: 8,
          marginBottom: 24,
        }}
      >
        {pin}
      </Text>
      <QRCode value={qrValue} size={180} />
    </View>
  );
}

