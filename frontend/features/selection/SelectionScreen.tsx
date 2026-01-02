import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useMediaFetcher } from "../../hooks/useMediaFetcher";
import { MediaGrid } from "../../components/molecules/MediaGrid";
import { Button } from "../../components/atoms/Button";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";

export function SelectionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { setMediaPool, room } = useSocket();
  
  // Get game mode from room settings
  // Wait for room to be available before determining media type
  const gameMode = room?.settings?.mode || "Photo";
  // Map "Photo" -> "photo", "Video" -> "video", "Mix" -> "mixed"
  const mediaType = gameMode === "Photo" ? "photo" : gameMode === "Video" ? "video" : "mixed";
  // For mixed mode, we need 40 items (20 photos + 20 videos), otherwise 20
  const mediaCount = mediaType === "mixed" ? 40 : 20;
  
  const {
    media,
    loading,
    error,
    permissionGranted,
    requestPermission,
    fetchMedia,
    reroll,
  } = useMediaFetcher(mediaCount, mediaType);
  
  // Refetch media when room settings change
  useEffect(() => {
    if (room?.settings?.mode && permissionGranted && !loading) {
      // Media will be refetched with new type when reroll is called or component remounts
      console.log("Room settings updated, media type:", mediaType);
    }
  }, [room?.settings?.mode, mediaType, permissionGranted, loading]);

  const isHost = params.isHost === "true";
  const pin = params.pin || "";
  const playAgain = params.playAgain === "true";
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const initializeMedia = async () => {
      // Wait for room to be available if we're joining
      if (!isHost && !room) {
        // Wait a bit for room to load
        return;
      }
      
      if (permissionGranted && media.length === 0 && !loading) {
        await fetchMedia(mediaCount, mediaType);
      } else if (!permissionGranted && !loading) {
        const granted = await requestPermission();
        if (granted) {
          await fetchMedia(mediaCount, mediaType);
        }
      }
    };

    initializeMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, isHost, mediaType, mediaCount]);

  const handleReady = async () => {
    if (!pin) {
      console.error("No PIN available");
      return;
    }

    if (media.length === 0) {
      console.error("No media to upload");
      return;
    }

    setIsUploading(true);

    try {
      // In play again mode, anyone can set media pool (first to validate becomes host)
      // Otherwise, only host can set media pool
      if (isHost || playAgain) {
        console.log(`Uploading ${media.length} media items for PIN ${pin}${playAgain ? " (play again)" : ""}`);
        const success = await setMediaPool(pin, media, playAgain);
        if (!success) {
          console.error("Failed to upload media pool");
          setIsUploading(false);
          return;
        }
        console.log("Media pool uploaded successfully");
      }

      setIsUploading(false);

      // After play again, check if we're now the host
      const updatedIsHost = playAgain ? true : isHost;
      router.push({ 
        pathname: "/lobby", 
        params: { isHost: updatedIsHost ? "true" : "false", pin } 
      });
    } catch (error) {
      console.error("Error in handleReady:", error);
      setIsUploading(false);
    }
  };

  const handleReroll = async () => {
    await fetchMedia(mediaCount, mediaType);
  };

  if (loading && media.length === 0) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-4">
          {permissionGranted ? t("selection.loadingMedia") : t("selection.requestingPermission")}
        </Text>
      </View>
    );
  }

  if (error && !permissionGranted) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Text className="text-white text-xl font-bold mb-4">{t("selection.permissionRequired")}</Text>
        <Text className="text-gray-400 text-center mb-8">
          {t("selection.permissionMessage")}
        </Text>
        <Button
          title={t("selection.grantPermission")}
          onPress={requestPermission}
          variant="primary"
        />
        <View className="mt-3">
          <Button
            title={t("common.goBack")}
            onPress={() => router.back()}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Text className="text-white text-xl font-bold mb-4">{t("common.error")}</Text>
        <Text className="text-gray-400 text-center mb-8">{error}</Text>
        <Button
          title={t("common.retry")}
          onPress={handleReroll}
          variant="primary"
        />
        <View className="mt-3">
          <Button
            title={t("common.goBack")}
            onPress={() => router.back()}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <View className="px-6 pt-12 pb-4">
        <Text className="text-white text-3xl font-bold mb-2">
          {t("selection.title")}
        </Text>
        <Text className="text-gray-400 text-base">
          {t("selection.description", { count: media.length })}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {loading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#ffffff" />
            <Text className="text-white mt-4">{t("selection.loadingNewItems")}</Text>
          </View>
        ) : (
          <MediaGrid items={media} columns={4} />
        )}
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800">
        <View className="flex-row" style={{ gap: 16 }}>
          <View className="flex-1">
            <Button
              title={t("selection.reroll")}
              onPress={handleReroll}
              variant="secondary"
              disabled={loading || isUploading}
            />
          </View>
          <View className="flex-1">
            <Button
              title={isUploading ? t("selection.uploading") : t("selection.ready")}
              onPress={handleReady}
              variant="primary"
              disabled={loading || media.length === 0 || isUploading}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
