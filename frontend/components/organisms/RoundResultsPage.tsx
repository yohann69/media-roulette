import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";
import { Button } from "../../components/atoms/Button";
import { MediaDisplay } from "../../components/molecules/MediaDisplay";

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
  guessedPlayerId: string | null;
  isCorrect: boolean;
  roundScore: number;
  timeTaken: number | null;
  totalScore: number;
  tooSlow?: boolean;
}

interface MediaItem {
  id: string;
  uri?: string;
  base64?: string;
  mediaType: "photo" | "video";
  width?: number;
  height?: number;
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
  currentMedia?: MediaItem | null;
}

function formatTime(ms: number | null): string {
  if (ms === null || ms === undefined) return "-";
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
  currentMedia,
}: RoundResultsPageProps) {
  const { t } = useTranslation();

  const sortedPlayers = [...roundResults.leaderboard].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  // Find result data for each player to get their guess and time taken
  const getPlayerResult = (playerId: string): RoundResult | undefined => {
    return roundResults.results.find((r) => r.playerId === playerId);
  };

  // Check if nobody guessed correctly OR if nobody answered in time
  const hasCorrectGuess = roundResults.results.some((r) => r.isCorrect);
  const hasAnyGuess = roundResults.results.some((r) => !r.tooSlow && r.guessedPlayerId !== null);
  const shouldShowCorrectAnswer = !hasCorrectGuess || !hasAnyGuess;
  
  // Find the correct owner name
  const correctOwner = allPlayers.find((p) => p.id === roundResults.actualOwnerId);

  return (
    <View className="flex-1 bg-black">
      {/* Blurred background */}
      {currentMedia && <MediaDisplay media={currentMedia} showAsBackground />}
      
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="items-center mb-6">
          <Text className="text-white text-3xl font-bold mb-2">
            {t("leaderboard.roundResults")}
          </Text>
          <Text className="text-gray-400 text-base">
            {t("game.round", { current: currentRound, total: totalRounds })}
          </Text>
        </View>

        {/* Show correct answer if nobody guessed correctly OR if nobody answered */}
        {shouldShowCorrectAnswer && correctOwner && (
          <View className="w-full bg-primary/20 border-2 border-primary rounded-xl p-4 mb-6">
            <Text className="text-white text-lg font-semibold text-center mb-1">
              {t("leaderboard.correctAnswer")}
            </Text>
            <Text className="text-primary text-2xl font-bold text-center">
              {correctOwner.name}
            </Text>
          </View>
        )}

        <View className="gap-3 mb-6">
          {sortedPlayers.map((player, index) => {
            const playerResult = getPlayerResult(player.playerId);
            const timeTaken = playerResult?.timeTaken ?? null;
            const isCorrect = playerResult?.isCorrect || false;
            const guessedPlayerId = playerResult?.guessedPlayerId;
            const guessedPlayer = guessedPlayerId 
              ? allPlayers.find((p) => p.id === guessedPlayerId)
              : null;
            const didNotGuess = !playerResult || playerResult.tooSlow;
            const roundScore = playerResult?.roundScore || 0;

            // Determine card color based on correctness
            const cardBgColor = didNotGuess 
              ? "bg-gray-800 border-gray-700" 
              : isCorrect 
              ? "bg-green-900/30 border-green-500" 
              : "bg-red-900/30 border-red-500";

            return (
              <View
                key={player.playerId}
                className={`flex-row items-center justify-between py-4 px-4 rounded-xl border-2 ${cardBgColor}`}
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
                    <View className="flex-row items-center mb-1 flex-wrap">
                      <Text className="text-white text-lg font-semibold">
                        {player.playerName}
                      </Text>
                      {roundScore > 0 && (
                        <Text className="text-green-400 text-sm font-semibold ml-2">
                          +{roundScore.toLocaleString()} {t("common.pts")}
                        </Text>
                      )}
                      {roundScore === 0 && !didNotGuess && (
                        <Text className="text-gray-500 text-sm ml-2">
                          +0 {t("common.pts")}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2 mb-1">
                      {guessedPlayer ? (
                        <Text className="text-gray-300 text-sm">
                          {t("leaderboard.guessed")} <Text className="font-semibold">{guessedPlayer.name}</Text>
                        </Text>
                      ) : (
                        <Text className="text-gray-400 text-sm">
                          {t("leaderboard.tooSlow")}
                        </Text>
                      )}
                    </View>
                    {timeTaken !== null && timeTaken !== undefined && !didNotGuess && (
                      <Text className="text-gray-400 text-xs">
                        {t("leaderboard.responseTime")}: {formatTime(timeTaken)}
                      </Text>
                    )}
                  </View>
                </View>
                <View className="items-end justify-center ml-4">
                  <Text className="text-white text-xl font-bold">
                    {player.totalScore.toLocaleString()}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {t("common.pts")}
                  </Text>
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
