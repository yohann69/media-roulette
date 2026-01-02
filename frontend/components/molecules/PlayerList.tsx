import { View, Text, ScrollView } from "react-native";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
}

interface PlayerListProps {
  players: Player[];
  currentUserId?: string;
}

export function PlayerList({ players, currentUserId }: PlayerListProps) {
  return (
    <ScrollView style={{ maxHeight: 200 }}>
      {players.map((player) => (
        <View
          key={player.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: "#1f2937",
            borderRadius: 8,
            marginBottom: 8,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#3b82f6",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
              {player.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 16,
                fontWeight: "500",
              }}
            >
              {player.name}
              {player.isHost && (
                <Text style={{ color: "#9ca3af", fontSize: 12 }}> (Host)</Text>
              )}
              {player.id === currentUserId && (
                <Text style={{ color: "#3b82f6", fontSize: 12 }}> (You)</Text>
              )}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

