import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Input } from "../components/atoms/Input";
import { Button } from "../components/atoms/Button";

export default function JoinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState("");

  const handleJoin = () => {
    if (pin.trim().length > 0) {
      // Navigate to selection screen after entering PIN
      router.push("/selection");
    }
  };

  return (
    <View className="flex-1 bg-black px-6 py-12">
      <Text className="text-white text-3xl font-bold mb-2 text-center">
        Join Game
      </Text>
      <Text className="text-gray-400 text-center mb-8">
        Enter the game PIN to join
      </Text>

      <Input
        value={pin}
        onChangeText={setPin}
        placeholder="Enter PIN"
        label="Game PIN"
        autoFocus
      />

      <View className="mt-6">
        <Button
          title="Join"
          onPress={handleJoin}
          disabled={pin.trim().length === 0}
          variant="primary"
        />
      </View>

      <View className="mt-4">
        <Button
          title="Back to Home"
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>
    </View>
  );
}

