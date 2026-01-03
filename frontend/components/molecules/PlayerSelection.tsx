import { View, Text, TouchableOpacity } from "react-native";

interface Player {
  id: string;
  name: string;
}

interface PlayerSelectionProps {
  players: Player[];
  selectedPlayer: string | null;
  onSelect: (playerId: string) => void;
  disabled: boolean;
}

export function PlayerSelection({
  players,
  selectedPlayer,
  onSelect,
  disabled,
}: PlayerSelectionProps) {
  // Group players into rows of 2, except the last row if odd number
  const rows: Player[][] = [];
  for (let i = 0; i < players.length; i += 2) {
    rows.push(players.slice(i, i + 2));
  }

  return (
    <View className="mb-4">
      <View className="gap-3">
        {rows.map((row, rowIndex) => {
          const isLastRow = rowIndex === rows.length - 1;
          const isOddNumber = players.length % 2 !== 0;
          const isLastRowWithOneItem = isLastRow && isOddNumber && row.length === 1;

          // If last row has one item (odd number), render it without flex-row to take full width
          if (isLastRowWithOneItem) {
            const player = row[0];
            const isSelected = selectedPlayer === player.id;
            
            return (
              <View key={rowIndex}>
                <TouchableOpacity
                  onPress={() => onSelect(player.id)}
                  disabled={disabled}
                  className={`py-4 px-6 rounded-xl border-2 w-full ${
                    isSelected
                      ? "bg-primary border-primary"
                      : disabled
                      ? "bg-gray-800/90 border-gray-700 opacity-50"
                      : "bg-gray-800/90 border-gray-700"
                  }`}
                >
                  <Text
                    className={`text-lg font-semibold text-center ${
                      isSelected ? "text-white" : "text-gray-300"
                    }`}
                  >
                    {player.name}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }

          // Normal row with 2 items
          return (
            <View key={rowIndex} className="flex-row gap-3">
              {row.map((player) => {
                const isSelected = selectedPlayer === player.id;

                return (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() => onSelect(player.id)}
                    disabled={disabled}
                    className={`py-4 px-6 rounded-xl border-2 ${
                      isSelected
                        ? "bg-primary border-primary"
                        : disabled
                        ? "bg-gray-800/90 border-gray-700 opacity-50"
                        : "bg-gray-800/90 border-gray-700"
                    }`}
                    style={{ flex: 1 }}
                  >
                    <Text
                      className={`text-lg font-semibold text-center ${
                        isSelected ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {player.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}
