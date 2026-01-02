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
  const { setMediaPool } = useSocket();
  const {
    media,
    loading,
    error,
    permissionGranted,
    requestPermission,
    fetchMedia,
    reroll,
  } = useMediaFetcher(20, "mixed");

  const isHost = params.isHost === "true";
  const pin = params.pin || "";
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const initializeMedia = async () => {
      if (permissionGranted && media.length === 0 && !loading) {
        await fetchMedia();
      } else if (!permissionGranted && !loading) {
        const granted = await requestPermission();
        if (granted) {
          await fetchMedia();
        }
      }
    };

    initializeMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReady = async () => {
    if (!pin) {
      console.error("No PIN available");
      return;
    }

    setIsUploading(true);

    if (isHost) {
      const success = await setMediaPool(pin, media);
      if (!success) {
        console.error("Failed to upload media pool");
        setIsUploading(false);
        return;
      }
    }

    setIsUploading(false);

    if (isHost) {
      router.push({ pathname: "/lobby", params: { isHost: "true", pin } });
    } else {
      router.push({ pathname: "/lobby", params: { isHost: "false", pin } });
    }
  };

  const handleReroll = async () => {
    await reroll();
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
