import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../components/atoms/Button";

export default function LobbyScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <Text className="text-white text-3xl font-bold mb-4">Create Game</Text>
      <Text className="text-gray-400 text-center mb-8">
        This is a placeholder screen for creating a game lobby.
      </Text>
      <Button
        title="Back to Home"
        onPress={() => router.back()}
        variant="secondary"
      />
    </View>
  );
}

