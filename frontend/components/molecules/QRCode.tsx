import { View } from "react-native";
import QRCodeSvg from "react-native-qrcode-svg";

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCode({ value, size = 200 }: QRCodeProps) {
  return (
    <View className="bg-white p-4 rounded-xl items-center justify-center" style={{ width: size, height: size }}>
      <QRCodeSvg
        value={value}
        size={size - 32} // Account for padding
        color="#000000"
        backgroundColor="#FFFFFF"
      />
    </View>
  );
}
