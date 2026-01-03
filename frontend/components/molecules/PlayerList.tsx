import { View, Text } from "react-native";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  state?: "selecting" | "ready";
}

interface PlayerListProps {
  players: Player[];
  currentUserId?: string;
}

export function PlayerList({ players, currentUserId }: PlayerListProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {players.map((player) => {
        const isSelecting = player.state === "selecting";
        const opacity = isSelecting ? 0.5 : 1;
        
        return (
          <View
            key={player.id}
            className="px-3 py-2 bg-gray-800 rounded-lg"
            style={{ opacity }}
          >
            <Text className={`${isSelecting ? "text-gray-400" : "text-white"} text-sm`}>
              {player.name}
              {isSelecting && " ⏳"}
              {player.isHost && " 👑"}
              {player.id === currentUserId && " (You)"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
