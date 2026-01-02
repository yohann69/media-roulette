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
  return (
    <View className="mb-4">
      <Text className="text-white text-lg font-semibold mb-4">
        Select the player:
      </Text>
      <View className="gap-3">
        {players.map((player) => {
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
                  ? "bg-gray-800 border-gray-700 opacity-50"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <Text
                className={`text-lg font-semibold ${
                  isSelected ? "text-white" : "text-gray-300"
                }`}
              >
                {player.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

