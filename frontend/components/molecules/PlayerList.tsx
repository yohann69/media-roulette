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
  let Clock: any = null;
  let Crown: any = null;
  
  try {
    const lucide = require("lucide-react-native");
    Clock = lucide.Clock;
    Crown = lucide.Crown;
  } catch {
    // Icons not available, will use text fallback
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {players.map((player) => {
        const isSelecting = player.state === "selecting";
        const opacity = isSelecting ? 0.5 : 1;
        
        return (
          <View
            key={player.id}
            className="px-3 py-2 bg-gray-800 rounded-lg flex-row items-center gap-1"
            style={{ opacity }}
          >
            <Text className={`${isSelecting ? "text-gray-400" : "text-white"} text-sm`}>
              {player.name}
            </Text>
            {isSelecting && Clock ? (
              <Clock size={12} color="#9ca3af" />
            ) : isSelecting ? (
              <Text className="text-gray-400 text-xs">⏳</Text>
            ) : null}
            {player.isHost && Crown ? (
              <Crown size={12} color="#fbbf24" />
            ) : player.isHost ? (
              <Text className="text-yellow-400 text-xs">👑</Text>
            ) : null}
            {player.id === currentUserId && (
              <Text className="text-gray-400 text-xs">(You)</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
