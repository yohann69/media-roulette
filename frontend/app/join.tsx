import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Input } from "../components/atoms/Input";
import { Button } from "../components/atoms/Button";
import { QRScanner } from "../components/molecules/QRScanner";

export default function JoinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const handleJoin = () => {
    if (pin.trim().length === 6 && /^\d{6}$/.test(pin)) {
      // Navigate to selection screen as joiner with PIN
      router.push({ 
        pathname: "/selection", 
        params: { isHost: "false", pin: pin.trim() } 
      });
    }
  };

  const handleQRScan = (scannedPin: string) => {
    setPin(scannedPin);
    setShowScanner(false);
  };

  const isValidPIN = pin.trim().length === 6 && /^\d{6}$/.test(pin);

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Text className="text-white text-3xl font-bold mb-2 text-center">
          Join Game
        </Text>
        <Text className="text-gray-400 text-center mb-8">
          Enter the game PIN or scan the QR code
        </Text>

        <Input
          value={pin}
          onChangeText={(text) => {
            // Only allow digits and limit to 6 characters
            const digitsOnly = text.replace(/\D/g, "").slice(0, 6);
            setPin(digitsOnly);
          }}
          placeholder="000000"
          label="Game PIN (6 digits)"
          autoFocus
        />

        <View className="mt-4">
          <Button
            title="📷 Scan QR Code"
            onPress={() => setShowScanner(true)}
            variant="secondary"
          />
        </View>
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800 bg-black">
        <Button
          title="Join"
          onPress={handleJoin}
          disabled={!isValidPIN}
          variant="primary"
        />
        <View className="mt-3">
          <Button
            title="Back to Home"
            onPress={() => router.back()}
            variant="secondary"
          />
        </View>
      </View>

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
    </View>
  );
}
