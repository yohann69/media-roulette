import { View, Text } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

interface Player {
  id: string;
  name: string;
}

interface ResultDisplayProps {
  selectedPlayer: string | null;
  correctPlayerId: string;
  players: Player[];
}

export function ResultDisplay({
  selectedPlayer,
  correctPlayerId,
  players,
}: ResultDisplayProps) {
  const { t } = useTranslation();
  const isCorrect = selectedPlayer === correctPlayerId;
  const hasSelected = selectedPlayer !== null;
  const correctPlayer = players.find((p) => p.id === correctPlayerId);
  const selectedPlayerName = selectedPlayer
    ? players.find((p) => p.id === selectedPlayer)?.name
    : null;

  return (
    <View className="mb-6">
      {hasSelected ? (
        <>
          <View
            className={`py-4 px-6 rounded-xl mb-3 ${
              isCorrect
                ? "bg-green-900/30 border-2 border-green-500"
                : "bg-red-900/30 border-2 border-red-500"
            }`}
          >
            <Text className="text-white text-sm mb-1">{t("result.yourGuess")}</Text>
            <Text className="text-white text-xl font-bold">
              {selectedPlayerName}
            </Text>
            {!isCorrect && (
              <Text className="text-red-400 text-sm mt-1">{t("result.incorrect")}</Text>
            )}
          </View>

          <View className="py-4 px-6 rounded-xl bg-green-900/30 border-2 border-green-500">
            <Text className="text-white text-sm mb-1">{t("result.correctAnswer")}</Text>
            <Text className="text-white text-xl font-bold">
              {correctPlayer?.name}
            </Text>
            <Text className="text-green-400 text-sm mt-1">{t("result.correct")}</Text>
          </View>
        </>
      ) : (
        <>
          <View className="py-4 px-6 rounded-xl bg-gray-800 border-2 border-gray-700 mb-3">
            <Text className="text-gray-400 text-sm mb-1">
              {t("result.noSelection")}
            </Text>
          </View>

          <View className="py-4 px-6 rounded-xl bg-green-900/30 border-2 border-green-500">
            <Text className="text-white text-sm mb-1">{t("result.correctAnswer")}</Text>
            <Text className="text-white text-xl font-bold">
              {correctPlayer?.name}
            </Text>
            <Text className="text-green-400 text-sm mt-1">{t("result.correct")}</Text>
          </View>
        </>
      )}

      <View className="mt-4">
        <Text className="text-gray-400 text-center">
          {isCorrect
            ? t("result.greatGuess")
            : hasSelected
            ? t("result.betterLuck")
            : t("result.timesUp")}
        </Text>
      </View>
    </View>
  );
}
