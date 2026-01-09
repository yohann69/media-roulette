import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "../hooks/useTranslation";

export default function TermsScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1 px-6 pt-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-white text-3xl font-extrabold mb-2">
          {t("terms.title", { defaultValue: "Terms & Conditions" })}
        </Text>
        <Text className="text-gray-500 text-xs mb-6">
          {t("terms.lastUpdated", { defaultValue: "Last updated: January 2024" })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("terms.section1Title", { defaultValue: "1. What this app does" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("terms.section1Body", {
            defaultValue:
              "PhotoRoulette is a casual party game. It randomly selects photos and videos from the devices of players in a room and shows them to everyone so they can guess who took them.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("terms.section2Title", { defaultValue: "2. Your responsibilities" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("terms.section2Body", {
            defaultValue:
              "You are fully responsible for the media stored on your device and for what you choose to show in the game. Do not use content that is illegal, offensive, harmful, or that you do not have the right to share.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("terms.section3Title", { defaultValue: "3. No storage of your media" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("terms.section3Body", {
            defaultValue:
              "The game uses your device gallery locally to pick media. The server does not permanently store your personal photos or videos. Temporary technical copies may be created in memory for the duration of a game and then discarded.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("terms.section4Title", { defaultValue: "4. Online features" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("terms.section4Body", {
            defaultValue:
              "Multiplayer games use an online connection to sync players, scores and game state. Do not attempt to cheat, disrupt games, or attack the service or other players.",
          })}
        </Text>

        <Text className="text-white text-lg font-semibold mb-2">
          {t("terms.section5Title", { defaultValue: "5. No warranty" })}
        </Text>
        <Text className="text-gray-200 text-sm leading-6 mb-4">
          {t("terms.section5Body", {
            defaultValue:
              "PhotoRoulette is provided “as is” without any guarantees. Use it at your own risk. The developer cannot be held liable for any loss, damage or issues arising from the use of the app.",
          })}
        </Text>

        <Text className="text-gray-500 text-xs mt-2">
          {t("terms.disclaimer", {
            defaultValue:
              "This text is a general description and may not cover all legal requirements in your country. For full legal compliance, please have it reviewed by a qualified lawyer.",
          })}
        </Text>
      </ScrollView>
    </View>
  );
}


