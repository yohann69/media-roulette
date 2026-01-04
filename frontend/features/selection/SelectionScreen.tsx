import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MediaGrid } from "../../components/molecules/MediaGrid";
import { Button } from "../../components/atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";
import { useSelectionScreenLogic } from "./useSelectionScreenLogic";

interface SelectionScreenProps {
  isHost?: string;
  pin?: string;
  playAgain?: string;
  onClose?: () => void;
}

export function SelectionScreen({ isHost, pin, playAgain, onClose }: SelectionScreenProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string; playAgain?: string }>();
  
  // Use props if provided, otherwise fall back to route params
  const actualParams = {
    isHost: isHost || params.isHost,
    pin: pin || params.pin,
    playAgain: playAgain || params.playAgain,
  };
  
  const {
    media,
    loading,
    error,
    permissionGranted,
    isUploading,
    handleReady,
    handleReroll,
    requestPermission,
    blindMode,
  } = useSelectionScreenLogic(actualParams, onClose);

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

  // In blind mode, show loading screen while uploading
  if (blindMode && (loading || isUploading || media.length === 0)) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-4 text-center">
          {isUploading ? t("selection.uploading") : t("selection.loadingMedia")}
        </Text>
        {blindMode && (
          <Text className="text-gray-400 text-sm mt-2 text-center">
            {t("selection.blindModeMessage")}
          </Text>
        )}
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
            onPress={onClose || (() => router.back())}
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
            onPress={onClose || (() => router.back())}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  const isModal = !!onClose;

  return (
    <View style={isModal ? undefined : { flex: 1 }}>
      {!isModal && (
        <View className="px-6 pt-4 pb-4">
          <Text className="text-white text-3xl font-bold mb-2">
            {t("selection.title")}
          </Text>
          <Text className="text-gray-400 text-base">
            {t("selection.description", { count: media.length })}
          </Text>
        </View>
      )}

      {isModal ? (
        <View>
          {loading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#ffffff" />
              <Text className="text-white mt-4">{t("selection.loadingNewItems")}</Text>
            </View>
          ) : (
            <MediaGrid items={media} columns={4} />
          )}
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {loading ? (
            <View className="py-20 items-center">
              <ActivityIndicator size="large" color="#ffffff" />
              <Text className="text-white mt-4">{t("selection.loadingNewItems")}</Text>
            </View>
          ) : (
            <MediaGrid items={media} columns={4} />
          )}
        </ScrollView>
      )}

      <View className={`${isModal ? "px-0 pt-4 pb-2" : "px-6 py-3 pb-8"} border-t border-gray-800`}>
        <View className="flex-row" style={{ gap: isModal ? 12 : 16 }}>
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
