import { View, Text, ScrollView } from "react-native";
import { MediaDisplay } from "../molecules/MediaDisplay";
import { ResultDisplay } from "../molecules/ResultDisplay";
import { Button } from "../atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";

interface Player {
  id: string;
  name: string;
}

interface MediaItem {
  id: string;
  uri?: string;
  base64?: string;
  mediaType: "photo" | "video";
}

interface ResultViewProps {
  currentRound: number;
  totalRounds: number;
  currentMedia: MediaItem | null;
  selectedPlayer: string | null;
  correctPlayerId: string;
  players: Player[];
  isOwner: boolean;
  onShowAgain: () => void;
  onContinue: () => void;
}

export function ResultView({
  currentRound,
  totalRounds,
  currentMedia,
  selectedPlayer,
  correctPlayerId,
  players,
  isOwner,
  onShowAgain,
  onContinue,
}: ResultViewProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="items-center mb-6">
          <Text className="text-white text-2xl font-bold mb-1">
            {t("game.round", { current: currentRound, total: totalRounds })}
          </Text>
          <Text className="text-gray-400 text-sm">{t("game.result")}</Text>
        </View>

        {currentMedia && <MediaDisplay media={currentMedia} />}

        <ResultDisplay
          selectedPlayer={selectedPlayer}
          correctPlayerId={correctPlayerId}
          players={players}
        />
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800 bg-black">
        {isOwner ? (
          <View className="gap-3">
            <Button
              title={t("result.showAgain")}
              onPress={onShowAgain}
              variant="secondary"
            />
            <Button title={t("common.continue")} onPress={onContinue} variant="primary" />
          </View>
        ) : (
          <Button
            title={currentRound < totalRounds ? t("common.continue") : t("leaderboard.finalResults")}
            onPress={onContinue}
            variant="primary"
          />
        )}
      </View>
    </View>
  );
}
