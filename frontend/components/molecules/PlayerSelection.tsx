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
  // Group players into rows of 2 (or 1 if odd number)
  const rows: Player[][] = [];
  for (let i = 0; i < players.length; i += 2) {
    rows.push(players.slice(i, i + 2));
  }

  return (
    <View className="mb-4">
      <View className="gap-3">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-3">
            {row.map((player) => {
              const isSelected = selectedPlayer === player.id;
              const isOddRow = row.length === 1;

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
                  } ${isOddRow ? "flex-1" : "flex-1"}`}
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
            {/* Add empty space if odd row to maintain layout */}
            {row.length === 1 && <View className="flex-1" />}
          </View>
        ))}
      </View>
    </View>
  );
}

