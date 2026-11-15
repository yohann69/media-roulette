import type { RefObject } from "react";
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
  worstPlayer: { playerName: string | null; score: number; correctAnswers?: number; totalRounds?: number };
  hardestRound: { round: number | null; correctCount: number };
  masterOfDisguise?: { playerName: string | null; fooled: number };
}

export interface SeriesEntry {
  playerId: string;
  playerName: string;
  wins: number;
  score: number;
}

interface GameStatsPageProps {
  leaderboard: PlayerScore[];
  stats: GameStats;
  totalRounds?: number;
  onPlayAgain: () => void;
  /** Standings across rematches, shown from the second game on. */
  series?: SeriesEntry[];
  gamesPlayed?: number;
  /** Attached to the recap part (podium and awards), to capture it as an image. */
  recapRef?: RefObject<any>;
}

function formatTime(ms: number | null): string {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

/**
 * End-of-game podium and awards. The ref points at the "recap" part (podium and
 * awards), which can be captured as an image and shared.
 */
export function GameStatsPage({ leaderboard, stats, series, gamesPlayed = 0, recapRef }: GameStatsPageProps) {
  const { t } = useTranslation();
  const sortedSeries = [...(series ?? [])].sort((a, b) => b.wins - a.wins || b.score - a.score);
  
  const sortedPlayers = [...leaderboard].sort((a, b) => b.totalScore - a.totalScore);
  const top3 = sortedPlayers.slice(0, 3);
  const players4and5 = sortedPlayers.slice(3, 5);

  return (
    <ScrollView className="flex-1 bg-black" contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
      {/* Negative margin + padding: same layout on screen, a small border in the shared image. */}
      <View ref={recapRef} collapsable={false} className="bg-black" style={{ margin: -12, padding: 12 }}>
      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <View className="mb-8">
          <Text className="text-gray-500 text-xs font-semibold tracking-widest text-center mt-4">MEDIA ROULETTE</Text>
          <Text className="text-white text-4xl font-bold mb-6 mt-2 text-center">🏆 {t("leaderboard.podium")}</Text>
          <View className="flex-row justify-center items-end gap-3 mb-4">
            {/* 2nd place */}
            {top3[1] && (
              <View className="items-center flex-1">
                <View className="bg-gray-700 border-2 border-gray-600 rounded-2xl p-5 w-full items-center mb-2">
                  <Text className="text-5xl mb-3">🥈</Text>
                  <Text className="text-white text-xl font-bold">{top3[1].playerName}</Text>
                  <Text className="text-gray-300 text-lg mt-1">{top3[1].totalScore.toLocaleString()} {t("common.pts")}</Text>
                </View>
              </View>
            )}
            
            {/* 1st place */}
            {top3[0] && (
              <View className="items-center flex-1">
                <View className="bg-primary/30 border-2 border-primary rounded-2xl p-6 w-full items-center mb-2">
                  <Text className="text-6xl mb-3">🥇</Text>
                  <Text className="text-white text-2xl font-bold">{top3[0].playerName}</Text>
                  <Text className="text-primary text-xl font-semibold mt-1">{top3[0].totalScore.toLocaleString()} {t("common.pts")}</Text>
                </View>
              </View>
            )}
            
            {/* 3rd place */}
            {top3[2] && (
              <View className="items-center flex-1">
                <View className="bg-orange-900/30 border-2 border-orange-600 rounded-2xl p-5 w-full items-center mb-2">
                  <Text className="text-5xl mb-3">🥉</Text>
                  <Text className="text-white text-xl font-bold">{top3[2].playerName}</Text>
                  <Text className="text-gray-300 text-lg mt-1">{top3[2].totalScore.toLocaleString()} {t("common.pts")}</Text>
                </View>
              </View>
            )}
          </View>
          
          {/* 4th and 5th place side by side */}
          {players4and5.length > 0 && (
            <View className="flex-row gap-3 mb-6">
              {players4and5.map((player, index) => (
                <View key={player.playerId} className="flex-1">
                  <View className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-5 items-center">
                    <Text className="text-gray-500 text-xl mb-2">#{index + 4}</Text>
                    <Text className="text-white text-xl font-bold text-center">{player.playerName}</Text>
                    <Text className="text-gray-300 text-base mt-1">{player.totalScore.toLocaleString()} {t("common.pts")}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Fun Stats */}
      <View className="gap-3 mb-6">
        {/* Longest Streak */}
        {stats.longestStreak.streak > 0 && (
          <View className="bg-orange-900/30 border-2 border-orange-500 rounded-2xl py-4 px-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-orange-500 text-3xl mr-3">🔥</Text>
                <Text className="text-gray-300 text-xl">{t("stats.longestStreak")}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-xl font-semibold">
                  {stats.longestStreak.playerName || t("common.nobody")}
                </Text>
                <Text className="text-orange-400 text-sm mt-1">
                  {stats.longestStreak.streak} {t("stats.consecutive")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Fastest Answer */}
        {stats.fastestAnswer.time !== null && stats.fastestAnswer.time !== undefined && (
          <View className="bg-yellow-900/30 border-2 border-yellow-500 rounded-2xl py-4 px-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-yellow-500 text-3xl mr-3">⚡</Text>
                <Text className="text-gray-300 text-xl">{t("stats.fastestAnswer")}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-xl font-semibold">
                  {stats.fastestAnswer.playerName || t("common.nobody")}
                </Text>
                <Text className="text-yellow-400 text-sm mt-1">
                  {formatTime(stats.fastestAnswer.time)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Average Time */}
        {stats.averageTime !== null && (
          <View className="bg-gray-800 border-2 border-gray-700 rounded-2xl py-4 px-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-blue-400 text-3xl mr-3">📊</Text>
                <Text className="text-gray-300 text-xl">{t("stats.averageTime")}</Text>
              </View>
              <Text className="text-white text-xl font-semibold">
                {formatTime(stats.averageTime)}
              </Text>
            </View>
          </View>
        )}

        {/* Master of disguise: whose media fooled the most guesses */}
        {!!stats.masterOfDisguise?.playerName && stats.masterOfDisguise.fooled > 0 && (
          <View className="bg-purple-900/30 border-2 border-purple-500 rounded-2xl py-4 px-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-3xl mr-3">🎭</Text>
                <Text className="text-gray-300 text-xl">{t("stats.masterOfDisguise")}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-xl font-semibold">{stats.masterOfDisguise.playerName}</Text>
                <Text className="text-purple-300 text-sm mt-1">
                  {t("stats.fooled", { count: stats.masterOfDisguise.fooled })}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Worst Player */}
        {stats.worstPlayer.playerName && (
          <View className="bg-gray-800 border-2 border-gray-700 rounded-2xl py-4 px-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-gray-500 text-3xl mr-3">😅</Text>
                <Text className="text-gray-300 text-xl">{t("stats.worstPlayer")}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-xl font-semibold">
                  {stats.worstPlayer.playerName}
                </Text>
                {stats.worstPlayer.correctAnswers !== undefined && stats.worstPlayer.totalRounds !== undefined && (
                  <Text className="text-gray-400 text-sm mt-1">
                    {stats.worstPlayer.correctAnswers}/{stats.worstPlayer.totalRounds}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Hardest Round */}
        {stats.hardestRound.round !== null && (
          <View className="bg-red-900/20 border-2 border-red-700 rounded-2xl py-4 px-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Text className="text-red-500 text-3xl mr-3">💀</Text>
                <Text className="text-gray-300 text-xl">{t("stats.hardestRound")}</Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-xl font-semibold">
                  {stats.hardestRound.round ? t("stats.roundNumber", { round: stats.hardestRound.round }) : "-"}
                </Text>
                {stats.hardestRound.correctCount !== undefined && stats.hardestRound.correctCount !== Infinity && (
                  <Text className="text-red-400 text-sm mt-1">
                    {stats.hardestRound.correctCount} {t("stats.correctAnswers")}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
      </View>

      {/* Series standings across rematches */}
      {gamesPlayed >= 2 && sortedSeries.length > 0 && (
        <View className="mb-6">
          <Text className="text-white text-2xl font-bold mb-1">{t("stats.seriesTitle")}</Text>
          <Text className="text-gray-400 text-sm mb-4">{t("stats.seriesSubtitle", { count: gamesPlayed })}</Text>
          <View className="gap-2">
            {sortedSeries.map((entry, index) => (
              <View key={entry.playerId} className="flex-row items-center justify-between bg-gray-800 rounded-xl px-5 py-3">
                <View className="flex-row items-center flex-1">
                  <Text className="text-gray-500 text-base w-8">#{index + 1}</Text>
                  <Text className="text-white text-lg font-semibold">{entry.playerName}</Text>
                </View>
                <Text className="text-yellow-400 text-base mr-4">🏆 {entry.wins}</Text>
                <Text className="text-gray-300 text-base">
                  {entry.score.toLocaleString()} {t("common.pts")}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Full Leaderboard (remaining players after top 5) */}
      {sortedPlayers.length > 5 && (
        <View className="mb-6">
          <Text className="text-white text-2xl font-bold mb-5">{t("leaderboard.fullLeaderboard")}</Text>
          <View className="gap-3">
            {sortedPlayers.slice(5).map((player, index) => (
              <View
                key={player.playerId}
                className="flex-row items-center justify-between bg-gray-800 rounded-xl p-5"
              >
                <View className="flex-row items-center">
                  <Text className="text-gray-500 text-xl mr-4">#{index + 6}</Text>
                  <Text className="text-white text-xl font-semibold">{player.playerName}</Text>
                </View>
                <Text className="text-gray-300 text-xl">
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
