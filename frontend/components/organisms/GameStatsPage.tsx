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
  onPlayAgain,
}: GameStatsPageProps) {
  const { t } = useTranslation();
  
  const sortedPlayers = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);
  const top3 = sortedPlayers.slice(0, 3);

  return (
    <ScrollView className="flex-1 bg-black" contentContainerStyle={{ padding: 24 }}>
      <View className="items-center mb-8">
        <Text className="text-white text-5xl font-bold mb-2">🎉</Text>
        <Text className="text-white text-4xl font-bold mb-2">{t("leaderboard.gameOver")}</Text>
        <Text className="text-gray-400 text-lg">{t("leaderboard.finalResults")}</Text>
      </View>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <View className="mb-8">
          <Text className="text-white text-2xl font-bold mb-4 text-center">🏆 {t("leaderboard.podium")}</Text>
          <View className="flex-row justify-center items-end gap-3 mb-4">
            {/* 2nd place */}
            {top3[1] && (
              <View className="items-center flex-1">
                <View className="bg-gray-700 border-2 border-gray-600 rounded-2xl p-4 w-full items-center mb-2">
                  <Text className="text-4xl mb-2">🥈</Text>
                  <Text className="text-white text-lg font-bold">{top3[1].playerName}</Text>
                  <Text className="text-gray-300 text-sm">{top3[1].totalScore.toLocaleString()} {t("common.pts")}</Text>
                </View>
              </View>
            )}
            
            {/* 1st place */}
            {top3[0] && (
              <View className="items-center flex-1">
                <View className="bg-primary/30 border-2 border-primary rounded-2xl p-6 w-full items-center mb-2">
                  <Text className="text-5xl mb-2">🥇</Text>
                  <Text className="text-white text-xl font-bold">{top3[0].playerName}</Text>
                  <Text className="text-primary text-base font-semibold">{top3[0].totalScore.toLocaleString()} {t("common.pts")}</Text>
                </View>
              </View>
            )}
            
            {/* 3rd place */}
            {top3[2] && (
              <View className="items-center flex-1">
                <View className="bg-orange-900/30 border-2 border-orange-600 rounded-2xl p-4 w-full items-center mb-2">
                  <Text className="text-4xl mb-2">🥉</Text>
                  <Text className="text-white text-lg font-bold">{top3[2].playerName}</Text>
                  <Text className="text-gray-300 text-sm">{top3[2].totalScore.toLocaleString()} {t("common.pts")}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Fun Stats */}
      <View className="gap-4 mb-6">
        {/* Longest Streak */}
        {stats.longestStreak.streak > 0 && (
          <View className="bg-orange-900/30 border-2 border-orange-500 rounded-2xl p-5">
            <View className="flex-row items-center mb-2">
              <Text className="text-orange-500 text-3xl mr-3">🔥</Text>
              <View className="flex-1">
                <Text className="text-gray-400 text-sm">{t("stats.longestStreak")}</Text>
                <Text className="text-white text-xl font-bold">
                  {stats.longestStreak.playerName || t("common.nobody")}
                </Text>
                <Text className="text-orange-400 text-lg font-semibold">
                  {stats.longestStreak.streak} {t("stats.consecutive")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Fastest Answer */}
        {stats.fastestAnswer.time !== null && stats.fastestAnswer.time !== undefined && (
          <View className="bg-yellow-900/30 border-2 border-yellow-500 rounded-2xl p-5">
            <View className="flex-row items-center mb-2">
              <Text className="text-yellow-500 text-3xl mr-3">⚡</Text>
              <View className="flex-1">
                <Text className="text-gray-400 text-sm">{t("stats.fastestAnswer")}</Text>
                <Text className="text-white text-xl font-bold">
                  {stats.fastestAnswer.playerName || t("common.nobody")}
                </Text>
                <Text className="text-yellow-400 text-lg font-semibold">
                  {formatTime(stats.fastestAnswer.time)}
                  {stats.fastestAnswer.round && ` (${t("game.round", { current: stats.fastestAnswer.round, total: 0 })})`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Average Time */}
        {stats.averageTime !== null && (
          <View className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-5">
            <View className="flex-row items-center mb-2">
              <Text className="text-blue-400 text-3xl mr-3">📊</Text>
              <View className="flex-1">
                <Text className="text-gray-400 text-sm">{t("stats.averageTime")}</Text>
                <Text className="text-white text-xl font-bold">
                  {formatTime(stats.averageTime)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Worst Player */}
        {stats.worstPlayer.playerName && (
          <View className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-5">
            <View className="flex-row items-center mb-2">
              <Text className="text-gray-500 text-3xl mr-3">😅</Text>
              <View className="flex-1">
                <Text className="text-gray-400 text-sm">{t("stats.worstPlayer")}</Text>
                <Text className="text-white text-xl font-bold">
                  {stats.worstPlayer.playerName}
                </Text>
                <Text className="text-gray-400 text-sm">
                  {stats.worstPlayer.score.toLocaleString()} {t("common.pts")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Hardest Round */}
        {stats.hardestRound.round !== null && (
          <View className="bg-red-900/20 border-2 border-red-700 rounded-2xl p-5">
            <View className="flex-row items-center mb-2">
              <Text className="text-red-500 text-3xl mr-3">💀</Text>
              <View className="flex-1">
                <Text className="text-gray-400 text-sm">{t("stats.hardestRound")}</Text>
                <Text className="text-white text-xl font-bold">
                  {t("game.round", { current: stats.hardestRound.round, total: 0 }).replace(" of 0", "")}
                </Text>
                <Text className="text-red-400 text-sm">
                  {stats.hardestRound.correctCount} {t("stats.correctAnswers")}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Full Leaderboard */}
      {sortedPlayers.length > 3 && (
        <View className="mb-6">
          <Text className="text-white text-xl font-bold mb-4">{t("leaderboard.fullLeaderboard")}</Text>
          <View className="gap-2">
            {sortedPlayers.slice(3).map((player, index) => (
              <View
                key={player.playerId}
                className="flex-row items-center justify-between bg-gray-800 rounded-xl p-4"
              >
                <View className="flex-row items-center">
                  <Text className="text-gray-500 text-base mr-3">#{index + 4}</Text>
                  <Text className="text-white text-lg font-semibold">{player.playerName}</Text>
                </View>
                <Text className="text-gray-300 text-base">
                  {player.totalScore.toLocaleString()} {t("common.pts")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

