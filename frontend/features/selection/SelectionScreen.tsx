import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";
import { MediaGrid } from "../../components/molecules/MediaGrid";
import { Button } from "../../components/atoms/Button";

export function SelectionScreen() {
  const router = useRouter();
  const {
    media,
    loading,
    error,
    permissionGranted,
    requestPermission,
    fetchMedia,
    reroll,
  } = useMediaFetcher(20, "mixed");

  useEffect(() => {
    const initializeMedia = async () => {
      if (permissionGranted && media.length === 0 && !loading) {
        // Auto-fetch on mount if permission is already granted
        await fetchMedia();
      } else if (!permissionGranted && !loading) {
        // Request permission on mount
        const granted = await requestPermission();
        if (granted) {
          await fetchMedia();
        }
      }
    };

    initializeMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReady = () => {
    // Navigate to lobby with selected media
    router.push("/lobby");
  };

  const handleReroll = async () => {
    await reroll();
  };

  if (loading && media.length === 0) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-4">
          {permissionGranted ? "Loading your media..." : "Requesting permission..."}
        </Text>
      </View>
    );
  }

  if (error && !permissionGranted) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Text className="text-white text-xl font-bold mb-4">Permission Required</Text>
        <Text className="text-gray-400 text-center mb-8">
          We need access to your photos and videos to play PhotoRoulette.
        </Text>
        <Button
          title="Grant Permission"
          onPress={requestPermission}
          variant="primary"
        />
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Text className="text-white text-xl font-bold mb-4">Error</Text>
        <Text className="text-gray-400 text-center mb-8">{error}</Text>
        <Button
          title="Try Again"
          onPress={handleReroll}
          variant="primary"
        />
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-12 pb-4">
        <Text className="text-white text-3xl font-bold mb-2">
          Your Random Media
        </Text>
        <Text className="text-gray-400 text-base">
          {media.length} random items from your gallery. Tap "Reroll" to get new random items.
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#ffffff" />
            <Text className="text-white mt-4">Loading new items...</Text>
          </View>
        ) : (
          <MediaGrid items={media} columns={4} />
        )}
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800">
        <View className="flex-row" style={{ gap: 16 }}>
          <View className="flex-1">
            <Button
              title="Reroll"
              onPress={handleReroll}
              variant="secondary"
              disabled={loading}
            />
          </View>
          <View className="flex-1">
            <Button
              title="Ready"
              onPress={handleReady}
              variant="primary"
              disabled={loading || media.length === 0}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

