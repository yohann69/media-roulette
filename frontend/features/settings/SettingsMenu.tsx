import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import * as MediaLibrary from "expo-media-library";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CustomModal } from "../../components/molecules/Modal";
import { Button } from "../../components/atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";

type SettingsView = "root" | "albums" | "terms" | "privacy";

const EXCLUDED_ALBUMS_KEY = "@photoroulette:excludedAlbums";

interface SettingsMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function SettingsMenu({ visible, onClose }: SettingsMenuProps) {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<SettingsView>("root");
  const [albums, setAlbums] = useState<MediaLibrary.Album[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [excludedAlbums, setExcludedAlbums] = useState<Set<string>>(new Set());

  const loadExcluded = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(EXCLUDED_ALBUMS_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        setExcludedAlbums(new Set(ids));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveExcluded = useCallback(
    async (next: Set<string>) => {
      setExcludedAlbums(next);
      try {
        await AsyncStorage.setItem(EXCLUDED_ALBUMS_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
    },
    []
  );

  const toggleAlbum = (id: string) => {
    const next = new Set(excludedAlbums);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    saveExcluded(next);
  };

  const loadAlbums = useCallback(async () => {
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      let granted = status === "granted";
      if (!granted) {
        const req = await MediaLibrary.requestPermissionsAsync();
        granted = req.status === "granted";
      }
      setPermissionGranted(granted);
      if (!granted) return;

      setLoadingAlbums(true);
      const all = await MediaLibrary.getAlbumsAsync();
      setAlbums(all);
    } catch (err) {
      console.error("Error loading albums", err);
    } finally {
      setLoadingAlbums(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setCurrentView("root");
      loadExcluded();
    }
  }, [visible, loadExcluded]);

  const handleClose = () => {
    setCurrentView("root");
    onClose();
  };

  const renderHeader = (title: string, showBack: boolean) => (
    <View className="flex-row items-center justify-between mb-4">
      <View className="w-10">{showBack && (
        <TouchableOpacity onPress={() => setCurrentView("root")}>
          <Text className="text-gray-400 text-base">{t("common.back")}</Text>
        </TouchableOpacity>
      )}</View>
      <Text className="text-white text-lg font-semibold text-center flex-1">{title}</Text>
      <View className="w-10" />
    </View>
  );

  const renderRoot = () => (
    <View className="gap-4">
      {renderHeader("Settings", false)}
      <TouchableOpacity
        className="bg-gray-900 rounded-2xl px-4 py-3 flex-row items-center justify-between"
        onPress={() => {
          setCurrentView("albums");
          loadAlbums();
        }}
      >
        <View>
          <Text className="text-white text-base font-semibold">Media sources</Text>
          <Text className="text-gray-400 text-xs mt-1">
            Choose which albums can be used in games
          </Text>
        </View>
        <Text className="text-gray-500 text-xl">›</Text>
      </TouchableOpacity>

      <View className="border-t border-gray-800 pt-4 mt-2">
        <Text className="text-gray-400 text-xs mb-3">Legal</Text>
        <View className="gap-3">
          <TouchableOpacity
            className="bg-gray-900 rounded-2xl px-4 py-3 flex-row items-center justify-between"
            onPress={() => setCurrentView("terms")}
          >
            <Text className="text-white text-base font-semibold">Terms & Conditions</Text>
            <Text className="text-gray-500 text-xl">›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-900 rounded-2xl px-4 py-3 flex-row items-center justify-between"
            onPress={() => setCurrentView("privacy")}
          >
            <Text className="text-white text-base font-semibold">Privacy Policy</Text>
            <Text className="text-gray-500 text-xl">›</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderAlbums = () => (
    <View className="flex-1">
      {renderHeader("Media sources", true)}
      {!permissionGranted ? (
        <View className="bg-gray-900 rounded-2xl p-4 mt-2">
          <Text className="text-gray-300 text-sm mb-3">
            We need access to your albums to let you exclude folders from the game.
          </Text>
          <Button title="Grant permission" onPress={loadAlbums} variant="primary" />
        </View>
      ) : loadingAlbums ? (
        <View className="bg-gray-900 rounded-2xl p-6 items-center mt-2">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-gray-400 text-sm mt-3">Loading albums…</Text>
        </View>
      ) : albums.length === 0 ? (
        <View className="bg-gray-900 rounded-2xl p-4 mt-2">
          <Text className="text-gray-400 text-sm text-center">No albums found on this device.</Text>
        </View>
      ) : (
        <ScrollView className="mt-1" contentContainerStyle={{ paddingBottom: 16 }}>
          <View className="gap-2">
            {albums.map((album) => {
              const excluded = excludedAlbums.has(album.id);
              return (
                <TouchableOpacity
                  key={album.id}
                  className={`flex-row items-center justify-between px-4 py-3 rounded-2xl border ${
                    excluded ? "bg-red-950/40 border-red-500" : "bg-gray-900 border-gray-800"
                  }`}
                  onPress={() => toggleAlbum(album.id)}
                >
                  <View className="flex-1">
                    <Text className="text-white font-medium" numberOfLines={1}>
                      {album.title || "Untitled album"}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-1">
                      {album.assetCount} items
                    </Text>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      excluded ? "border-red-400 bg-red-500" : "border-gray-500"
                    }`}
                  >
                    {excluded && <Text className="text-black text-xs font-bold">✕</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );

  const renderLegalText = (title: string, paragraphs: string[]) => (
    <View className="flex-1">
      {renderHeader(title, true)}
      <ScrollView className="mt-2" contentContainerStyle={{ paddingBottom: 16 }}>
        {paragraphs.map((p, idx) => (
          <Text
            key={idx}
            className={`text-gray-200 text-sm leading-6 ${idx === 0 ? "" : "mt-3"}`}
          >
            {p}
          </Text>
        ))}
      </ScrollView>
    </View>
  );

  let body: JSX.Element;
  if (currentView === "albums") {
    body = renderAlbums();
  } else if (currentView === "terms") {
    body = renderLegalText("Terms & Conditions", [
      "PhotoRoulette is a party game where your personal media stays on your device. By playing, you agree to only use content you are allowed to share with your friends.",
      "You are responsible for the photos and videos on your device and for how you use them in the game.",
      "Do not use the app in a way that could harm or harass other people. Use it respectfully and only with people who agreed to play.",
    ]);
  } else if (currentView === "privacy") {
    body = renderLegalText("Privacy Policy", [
      "Your photos and videos never leave your phone for this app. We only scan your gallery locally to pick random media for the game.",
      "Basic game data (like your username and scores) can be shared with other players in the same room to make the game work.",
      "You can revoke photo permissions at any time in your device settings. If you do, the game will simply stop using your media.",
    ]);
  } else {
    body = renderRoot();
  }

  return (
    <CustomModal visible={visible} onClose={handleClose} title="" showCloseButton={false}>
      <View className="max-h-[80vh]">
        {body}
        <View className="mt-4">
          <Button title={t("common.close")} onPress={handleClose} variant="secondary" />
        </View>
      </View>
    </CustomModal>
  );
}


