import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

interface PlayerScore {
  playerId: string;
  playerName: string;
  totalScore: number;
  roundScore: number;
  timeTaken: number | null;
}

interface PodiumProps {
  players: PlayerScore[];
}

export function Podium({ players }: PodiumProps) {
  const { t } = useTranslation();
  const sortedPlayers = [...players].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
      <View className="items-center mb-8">
        <Text className="text-white text-4xl font-bold mb-2">{t("leaderboard.gameOver")}</Text>
        <Text className="text-gray-400 text-lg">{t("leaderboard.finalResults")}</Text>
      </View>

      <View className="gap-4 mb-8">
        {sortedPlayers.map((player, index) => {
          const isFirst = index === 0;
          const isSecond = index === 1;
          const isThird = index === 2;

          return (
            <View
              key={player.playerId}
              className={`flex-row items-center justify-between py-4 px-6 rounded-2xl ${
                isFirst
                  ? "bg-primary/30 border-2 border-primary"
                  : isSecond
                  ? "bg-gray-700 border-2 border-gray-600"
                  : isThird
                  ? "bg-orange-900/30 border-2 border-orange-600"
                  : "bg-gray-800"
              }`}
            >
              <View className="flex-row items-center flex-1">
                <View className="w-12 items-center mr-4">
                  {isFirst && <Text className="text-4xl">🥇</Text>}
                  {isSecond && <Text className="text-4xl">🥈</Text>}
                  {isThird && <Text className="text-4xl">🥉</Text>}
                  {index > 2 && (
                    <Text className="text-gray-500 text-lg">#{index + 1}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-white text-xl font-bold">
                    {player.playerName}
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    {player.totalScore.toLocaleString()} {t("common.pts")}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
