import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "../hooks/useTranslation";

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-black">
      <View className="pt-10 pb-3 px-6 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-gray-400 text-base">{t("common.back")}</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-semibold">
          {t("privacy.title", { defaultValue: "Privacy Policy" })}
        </Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-gray-500 text-xs mb-6">
          {t("privacy.lastUpdated", { defaultValue: "Last updated: January 2024" })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("privacy.section1Title", { defaultValue: "1. Media access" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("privacy.section1Body", {
            defaultValue:
              "The app requests access to your photo and video library only so it can randomly select media for the game. Your media stay on your device during normal use.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("privacy.section2Title", { defaultValue: "2. What is stored" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("privacy.section2Body", {
            defaultValue:
              "We may store limited technical data such as game room IDs, usernames, scores and timestamps needed for gameplay. We do not build advertising profiles and we do not sell your data.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("privacy.section3Title", { defaultValue: "3. Multiplayer data" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("privacy.section3Body", {
            defaultValue:
              "During an online game, basic information like your username, answers and scores are shared with other players in the same room so the game can work. Media content is only visible to players in that room for the duration of the game.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("privacy.section4Title", { defaultValue: "4. Permissions and control" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("privacy.section4Body", {
            defaultValue:
              "You can revoke photo and video permissions at any time in your device settings. In the app settings you can also exclude specific albums so they are never used in the game.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("privacy.section5Title", { defaultValue: "5. Security" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("privacy.section5Body", {
            defaultValue:
              "We use standard technical measures to protect data in transit between players and the server. However, no online service can be 100% secure, and you should avoid using the app on untrusted networks.",
          })}
        </Text>

        <Text className="text-gray-500 text-xs mt-2">
          {t("privacy.disclaimer", {
            defaultValue:
              "This policy is a simplified explanation of how the app handles data and may not cover all legal requirements in your country. For full legal compliance, please have it reviewed by a qualified lawyer.",
          })}
        </Text>
      </ScrollView>
    </View>
  );
}


