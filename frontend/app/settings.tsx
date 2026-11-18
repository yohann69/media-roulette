import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "../hooks/useTranslation";
import { AlbumExclusions } from "../features/settings/AlbumExclusions";

type SettingsView = "root" | "albums";

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [view, setView] = useState<SettingsView>("root");
  const renderRoot = () => (
    <>
      <View className="pt-14 pb-4 px-6 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => router.back()}
          className="items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10"
        >
          <Text className="text-2xl text-white">←</Text>
        </TouchableOpacity>
        <Text className="text-white text-4xl font-extrabold">
          {t("settings.title", { defaultValue: "Settings" })}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="gap-4">
        <TouchableOpacity
          onPress={() => setView("albums")}
          className="bg-gray-900 rounded-2xl px-4 py-3 flex-row items-center justify-between"
        >
          <View className="flex-1">
            <Text className="text-white text-xl font-semibold">
              {t("settings.mediaSourcesTitle", { defaultValue: "Excluded albums" })}
            </Text>
            <Text className="text-gray-400 text-sm mt-2">
              {t("settings.mediaSourcesSubtitle", {
                defaultValue: "Pick albums you never want to use in the game",
              })}
            </Text>
          </View>
          <Text className="text-gray-500 text-xl">›</Text>
        </TouchableOpacity>

        <View className="border-t border-gray-800 pt-4 mt-2">
          <Text className="text-gray-400 text-sm mb-3">
            {t("settings.legalSectionTitle", { defaultValue: "Legal" })}
          </Text>
          <View className="gap-3">
            <TouchableOpacity
              onPress={() => router.push("/terms")}
              className="bg-gray-900 rounded-2xl px-4 py-4 flex-row items-center justify-between"
            >
              <Text className="text-white text-lg font-semibold">
                {t("settings.terms", { defaultValue: "Terms & Conditions" })}
              </Text>
              <Text className="text-gray-500 text-xl">›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/privacy")}
              className="bg-gray-900 rounded-2xl px-4 py-4 flex-row items-center justify-between"
            >
              <Text className="text-white text-lg font-semibold">
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

  return (
    <View className="flex-1 bg-black">
      {view === "root" ? renderRoot() : <AlbumExclusions onBack={() => setView("root")} />}
    </View>
  );
}


