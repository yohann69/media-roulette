import { View, Text } from "react-native";

interface QRCodeProps {
  value: string;
  size?: number;
}

// Simple QR code placeholder - shows PIN in a scannable format
// For production, use a proper QR code library with native modules
export function QRCode({ value, size = 200 }: QRCodeProps) {
  // Extract PIN from the value
  const pinMatch = value.match(/pin=(\d{6})/);
  const pin = pinMatch ? pinMatch[1] : value.substring(0, 6);
  
  return (
    <View className="bg-white p-6 rounded-xl items-center justify-center" style={{ width: size, height: size }}>
      <View className="items-center">
        <Text className="text-black text-4xl font-bold mb-2">
          {pin}
        </Text>
        <Text className="text-gray-600 text-sm text-center">
          Scan or enter this PIN
        </Text>
      </View>
    </View>
  );
}
