import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { Button } from "../atoms/Button";

interface PlayerScore {
  playerId: string;
  playerName: string;
  totalScore: number;
}

interface GameStats {
  longestStreak: { playerName: string | null; streak: number };
  fastestAnswer: { playerName: string | null; time: number | null; round: number | null };
  averageTime: number | null;
  worstPlayer: { playerName: string | null; score: number };
  hardestRound: { round: number | null; correctCount: number };
}

interface GameStatsPageProps {
  leaderboard: PlayerScore[];
  stats: GameStats;
  totalRounds?: number;
  onPlayAgain: () => void;
}

function formatTime(ms: number | null): string {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

export function GameStatsPage({
  leaderboard,
  stats,
  totalRounds,
  onPlayAgain,
}: GameStatsPageProps) {
  const { t } = useTranslation();
  
  const sortedPlayers = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <ScrollView className="flex-1 bg-black" contentContainerStyle={{ padding: 24, paddingTop: 44 }}>
      {/* Fun Stats */}
      <View className="gap-3 mb-6">
        {/* Longest Streak */}
        {stats.longestStreak.streak > 0 && (
          <View className="bg-orange-900/30 border-2 border-orange-500 rounded-2xl py-3 px-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-orange-500 text-2xl mr-3">🔥</Text>
                <Text className="text-gray-300 text-base">{t("stats.longestStreak")}</Text>
              </View>
              <Text className="text-white text-base font-semibold">
                {stats.longestStreak.playerName || t("common.nobody")}
              </Text>
            </View>
          </View>
        )}

        {/* Fastest Answer */}
        {stats.fastestAnswer.time !== null && stats.fastestAnswer.time !== undefined && (
          <View className="bg-yellow-900/30 border-2 border-yellow-500 rounded-2xl py-3 px-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-yellow-500 text-2xl mr-3">⚡</Text>
                <Text className="text-gray-300 text-base">{t("stats.fastestAnswer")}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-base font-semibold">
                  {stats.fastestAnswer.playerName || t("common.nobody")}
                </Text>
                {stats.fastestAnswer.round && totalRounds && (
                  <Text className="text-yellow-400 text-xs mt-1">
                    {t("game.round", { current: stats.fastestAnswer.round, total: totalRounds })}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Average Time */}
        {stats.averageTime !== null && (
          <View className="bg-gray-800 border-2 border-gray-700 rounded-2xl py-3 px-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-blue-400 text-2xl mr-3">📊</Text>
                <Text className="text-gray-300 text-base">{t("stats.averageTime")}</Text>
              </View>
              <Text className="text-white text-base font-semibold">
                {formatTime(stats.averageTime)}
              </Text>
            </View>
          </View>
        )}

        {/* Worst Player */}
        {stats.worstPlayer.playerName && (
          <View className="bg-gray-800 border-2 border-gray-700 rounded-2xl py-3 px-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-gray-500 text-2xl mr-3">😅</Text>
                <Text className="text-gray-300 text-base">{t("stats.worstPlayer")}</Text>
              </View>
              <Text className="text-white text-base font-semibold">
                {stats.worstPlayer.playerName}
              </Text>
            </View>
          </View>
        )}

        {/* Hardest Round */}
        {stats.hardestRound.round !== null && (
          <View className="bg-red-900/20 border-2 border-red-700 rounded-2xl py-3 px-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-red-500 text-2xl mr-3">💀</Text>
                <Text className="text-gray-300 text-base">{t("stats.hardestRound")}</Text>
              </View>
              <Text className="text-white text-base font-semibold">
                {stats.hardestRound.round ? t("game.round", { current: stats.hardestRound.round, total: totalRounds || stats.hardestRound.round }) : "-"}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Full Leaderboard */}
      <View className="mb-6">
        <Text className="text-white text-xl font-bold mb-4">{t("leaderboard.fullLeaderboard")}</Text>
        <View className="gap-2">
          {sortedPlayers.map((player, index) => (
            <View
              key={player.playerId}
              className="flex-row items-center justify-between bg-gray-800 rounded-xl p-4"
            >
              <View className="flex-row items-center">
                <Text className="text-gray-500 text-base mr-3">#{index + 1}</Text>
                <Text className="text-white text-lg font-semibold">{player.playerName}</Text>
              </View>
              <Text className="text-gray-300 text-base">
                {player.totalScore.toLocaleString()} {t("common.pts")}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}


