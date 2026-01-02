import { View, Text, ScrollView } from "react-native";

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
    <ScrollView className="max-h-48">
      {players.map((player) => {
        const isSelecting = player.state === "selecting";
        const opacity = isSelecting ? 0.5 : 1;
        
        return (
          <View
            key={player.id}
            className="flex-row items-center py-3 px-4 bg-gray-800 rounded-lg mb-2"
            style={{ opacity }}
          >
            <View className={`w-10 h-10 rounded-full ${isSelecting ? "bg-gray-600" : "bg-primary"} items-center justify-center mr-3`}>
              <Text className="text-white text-base font-semibold">
                {player.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className={`${isSelecting ? "text-gray-400" : "text-white"} text-base font-medium`}>
                {player.name}
                {isSelecting && (
                  <Text className="text-gray-500 text-xs"> (Selecting media...)</Text>
                )}
                {player.isHost && (
                  <Text className="text-gray-400 text-xs"> (Host)</Text>
                )}
                {player.id === currentUserId && (
                  <Text className="text-primary text-xs"> (You)</Text>
                )}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
