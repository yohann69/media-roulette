import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import { useTranslation } from "../hooks/useTranslation";
import { Button } from "../components/atoms/Button";
import { loadExcludedAlbums, saveExcludedAlbums } from "../utils/excludedAlbums";

type SettingsView = "root" | "albums";

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [view, setView] = useState<SettingsView>("root");
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loadingAlbums, setLoadingAlbums] = useState(false);

  useEffect(() => {
    loadExcludedAlbums().then(setExcluded);
  }, []);

  const toggleAlbum = async (id: string) => {
    const next = new Set(excluded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExcluded(next);
    await saveExcludedAlbums(next);
  };

  const loadAlbums = async () => {
    try {
      setLoadingAlbums(true);
      const { status } = await MediaLibrary.getPermissionsAsync();
      let granted = status === "granted";
      if (!granted) {
        const res = await MediaLibrary.requestPermissionsAsync();
        granted = res.status === "granted";
      }
      setPermissionGranted(granted);
      if (!granted) return;

      const all = await MediaLibrary.getAlbumsAsync();
      setAlbums(all);
    } catch (error) {
      console.error("Error loading albums", error);
    } finally {
      setLoadingAlbums(false);
    }
  };

  useEffect(() => {
    if (view === "albums") {
      loadAlbums();
    }
  }, [view]);

  const renderRoot = () => (
    <>
      <View className="pt-10 pb-3 px-6 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-gray-400 text-base">{t("common.back")}</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-semibold">
          {t("settings.title", { defaultValue: "Settings" })}
        </Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-4">
        <TouchableOpacity
          onPress={() => setView("albums")}
          className="bg-gray-900 rounded-2xl px-4 py-3 flex-row items-center justify-between"
        >
          <View className="flex-1">
            <Text className="text-white text-base font-semibold">
              {t("settings.mediaSourcesTitle", { defaultValue: "Excluded albums" })}
            </Text>
            <Text className="text-gray-400 text-xs mt-1">
              {t("settings.mediaSourcesSubtitle", {
                defaultValue: "Pick albums you never want to use in the game",
              })}
            </Text>
          </View>
          <Text className="text-gray-500 text-xl">›</Text>
        </TouchableOpacity>

        <View className="border-t border-gray-800 pt-4 mt-2">
          <Text className="text-gray-400 text-xs mb-3">
            {t("settings.legalSectionTitle", { defaultValue: "Legal" })}
          </Text>
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => router.push("/terms")}
              className="bg-gray-900 rounded-2xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-white text-base font-semibold">
                {t("settings.terms", { defaultValue: "Terms & Conditions" })}
              </Text>
              <Text className="text-gray-500 text-xl">›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/privacy")}
              className="bg-gray-900 rounded-2xl px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-white text-base font-semibold">
                {t("settings.privacy", { defaultValue: "Privacy Policy" })}
              </Text>
              <Text className="text-gray-500 text-xl">›</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>
      </ScrollView>
    </>
  );

  const renderAlbums = () => (
    <View className="flex-1">
      <View className="pt-10 pb-3 px-6 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => setView("root")}>
          <Text className="text-gray-400 text-base">{t("common.back")}</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-semibold">
          {t("settings.mediaSourcesTitle", { defaultValue: "Excluded albums" })}
        </Text>
        <View className="w-12" />
      </View>

      {!permissionGranted ? (
        <View className="bg-gray-900 rounded-2xl p-4 mt-2">
          <Text className="text-gray-300 text-sm mb-3">
            {t("settings.permissionExplanation", {
              defaultValue:
                "We need access to your albums so you can exclude private folders from the game.",
            })}
          </Text>
          <Button
            title={t("settings.grantPermission", { defaultValue: "Grant permission" })}
            onPress={loadAlbums}
            variant="primary"
          />
        </View>
      ) : loadingAlbums ? (
        <View className="bg-gray-900 rounded-2xl p-6 items-center mt-2">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-gray-400 text-sm mt-3">
            {t("settings.loadingAlbums", { defaultValue: "Loading albums..." })}
          </Text>
        </View>
      ) : albums.length === 0 ? (
        <View className="bg-gray-900 rounded-2xl p-4 mt-2 mx-6">
          <Text className="text-gray-400 text-sm text-center">
            {t("settings.noAlbums", { defaultValue: "No albums found on this device." })}
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 mt-1 px-6" contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="gap-2">
            {albums.map((album) => {
              const isExcluded = excluded.has(album.id);
              return (
                <TouchableOpacity
                  key={album.id}
                  onPress={() => toggleAlbum(album.id)}
                  className={`flex-row items-center justify-between px-4 py-3 rounded-2xl border ${
                    isExcluded
                      ? "bg-red-950/40 border-red-500"
                      : "bg-gray-900 border-gray-800"
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-white font-medium" numberOfLines={1}>
                      {album.title || t("settings.untitledAlbum", { defaultValue: "Untitled album" })}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">
                      {album.assetCount}{" "}
                      {t("settings.itemsLabel", { defaultValue: "items" })}
                    </Text>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      isExcluded ? "border-red-400 bg-red-500" : "border-gray-500"
                    }`}
                  >
                    {isExcluded && (
                      <Text className="text-black text-xs font-bold">✕</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      {view === "root" ? renderRoot() : renderAlbums()}
    </View>
  );
}


