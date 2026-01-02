import { View, Text } from "react-native";

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
            <Text className="text-white text-sm mb-1">Your guess:</Text>
            <Text className="text-white text-xl font-bold">
              {selectedPlayerName}
            </Text>
            {!isCorrect && (
              <Text className="text-red-400 text-sm mt-1">❌ Incorrect</Text>
            )}
          </View>

          <View className="py-4 px-6 rounded-xl bg-green-900/30 border-2 border-green-500">
            <Text className="text-white text-sm mb-1">Correct answer:</Text>
            <Text className="text-white text-xl font-bold">
              {correctPlayer?.name}
            </Text>
            <Text className="text-green-400 text-sm mt-1">✅ Correct</Text>
          </View>
        </>
      ) : (
        <>
          <View className="py-4 px-6 rounded-xl bg-gray-800 border-2 border-gray-700 mb-3">
            <Text className="text-gray-400 text-sm mb-1">
              You didn't select anyone
            </Text>
          </View>

          <View className="py-4 px-6 rounded-xl bg-green-900/30 border-2 border-green-500">
            <Text className="text-white text-sm mb-1">Correct answer:</Text>
            <Text className="text-white text-xl font-bold">
              {correctPlayer?.name}
            </Text>
            <Text className="text-green-400 text-sm mt-1">✅ Correct</Text>
          </View>
        </>
      )}

      <View className="mt-4">
        <Text className="text-gray-400 text-center">
          {isCorrect
            ? "🎉 Great guess!"
            : hasSelected
            ? "Better luck next time!"
            : "Time's up!"}
        </Text>
      </View>
    </View>
  );
}

