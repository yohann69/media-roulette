import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { Button } from "../../components/atoms/Button";

interface PlayerScore {
  playerId: string;
  playerName: string;
  totalScore: number;
  roundScore: number;
  timeTaken: number | null;
}

interface RoundResult {
  playerId: string;
  playerName: string;
  guessedPlayerId: string;
  isCorrect: boolean;
  roundScore: number;
  timeTaken: number;
  totalScore: number;
}

interface RoundResultsPageProps {
  currentRound: number;
  totalRounds: number;
  roundResults: {
    actualOwnerId: string;
    results: RoundResult[];
    leaderboard: PlayerScore[];
  };
  actualOwnerName: string;
  isOwner: boolean;
  onContinue: () => void;
  allPlayers: Array<{ id: string; name: string }>;
}

function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

export function RoundResultsPage({
  currentRound,
  totalRounds,
  roundResults,
  actualOwnerName,
  isOwner,
  onContinue,
  allPlayers,
}: RoundResultsPageProps) {
  const { t } = useTranslation();

  const sortedPlayers = [...roundResults.leaderboard].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  // Find result data for each player to get their time taken
  const getPlayerResult = (playerId: string) => {
    return roundResults.results.find((r) => r.playerId === playerId);
  };

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="items-center mb-6">
          <Text className="text-white text-3xl font-bold mb-2">
            {t("leaderboard.roundResults")}
          </Text>
          <Text className="text-gray-400 text-base">
            {t("game.round", { current: currentRound, total: totalRounds })}
          </Text>
        </View>

        <View className="gap-3 mb-6">
          {sortedPlayers.map((player, index) => {
            const playerResult = getPlayerResult(player.playerId);
            const timeTaken = playerResult?.timeTaken;
            const isCorrect = playerResult?.isCorrect || false;
            const guessedPlayerId = playerResult?.guessedPlayerId;
            const guessedPlayer = guessedPlayerId 
              ? allPlayers.find((p) => p.id === guessedPlayerId)
              : null;
            const didNotGuess = !playerResult;

            return (
              <View
                key={player.playerId}
                className={`flex-row items-center justify-between py-4 px-4 rounded-xl ${
                  index === 0
                    ? "bg-primary/20 border-2 border-primary"
                    : "bg-gray-800"
                }`}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 items-center mr-3">
                    {index === 0 && (
                      <Text className="text-primary text-2xl">🥇</Text>
                    )}
                    {index === 1 && (
                      <Text className="text-gray-400 text-2xl">🥈</Text>
                    )}
                    {index === 2 && (
                      <Text className="text-orange-600 text-2xl">🥉</Text>
                    )}
                    {index > 2 && (
                      <Text className="text-gray-500 text-base">
                        #{index + 1}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1">
                      <Text className="text-white text-lg font-semibold">
                        {player.playerName}
                      </Text>
                      {isCorrect && (
                        <Text className="text-green-400 text-sm ml-2">
                          ✓ {t("leaderboard.correct")}
                        </Text>
                      )}
                      {!isCorrect && guessedPlayer && (
                        <Text className="text-gray-400 text-sm ml-2">
                          {t("leaderboard.guessed")} {guessedPlayer.name}
                        </Text>
                      )}
                      {(didNotGuess || timeTaken === null) && (
                        <Text className="text-red-400 text-sm ml-2">
                          {t("leaderboard.tooSlow")}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-3">
                      <Text className="text-gray-400 text-sm">
                        {t("leaderboard.total")}: {player.totalScore.toLocaleString()} {t("common.pts")}
                      </Text>
                      {player.roundScore > 0 && (
                        <Text className="text-green-400 text-sm font-semibold">
                          +{player.roundScore.toLocaleString()} {t("common.pts")}
                        </Text>
                      )}
                    </View>
                    {timeTaken !== null && timeTaken !== undefined && !didNotGuess && (
                      <Text className="text-gray-500 text-xs mt-1">
                        {t("leaderboard.responseTime")}: {formatTime(timeTaken)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800 bg-black">
        {isOwner ? (
          <Button
            title={t("common.continue")}
            onPress={onContinue}
            variant="primary"
          />
        ) : (
          <Button
            title={t("leaderboard.waitingForOwner", { ownerName: actualOwnerName })}
            onPress={() => {}}
            variant="secondary"
            disabled
          />
        )}
      </View>
    </View>
  );
}

