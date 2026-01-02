import { View } from "react-native";
import QRCodeSVG from "react-native-qrcode-svg";

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 200 }: QRCodeProps) {
  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <QRCodeSVG
        value={value}
        size={size}
        color="#000000"
        backgroundColor="#ffffff"
      />
    </View>
  );
}

