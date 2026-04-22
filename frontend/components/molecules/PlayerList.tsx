import { View, Text, ActivityIndicator } from "react-native";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  state?: "selecting" | "compressing" | "uploading" | "ready";
}

// Colors per in-progress state (keeps the tailwind palette already in use).
const STATE_SPINNER_COLOR: Record<string, string> = {
  selecting: "#9ca3af",
  compressing: "#f59e0b",
  uploading: "#60a5fa",
};

interface PlayerListProps {
  players: Player[];
  currentUserId?: string;
}

interface AnimatedPlayer {
  player: Player;
  scale: Animated.Value;
  opacity: Animated.Value;
}

export function PlayerList({ players, currentUserId }: PlayerListProps) {
  let Crown: any = null;
  
  try {
    const lucide = require("lucide-react-native");
    Crown = lucide.Crown;
  } catch {
    // Icons not available, will use text fallback
  }

  const animatedPlayersRef = useRef<Map<string, AnimatedPlayer>>(new Map());

  // Initialize animations for new players
  useEffect(() => {
    const currentPlayerIds = new Set(players.map(p => p.id));
    
    // Animate out players that left
    animatedPlayersRef.current.forEach((animatedPlayer, playerId) => {
      if (!currentPlayerIds.has(playerId)) {
        const { scale, opacity } = animatedPlayer;
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          animatedPlayersRef.current.delete(playerId);
        });
      }
    });
    
    // Add animations for new players
    players.forEach((player) => {
      if (!animatedPlayersRef.current.has(player.id)) {
        const scale = new Animated.Value(0);
        const opacity = new Animated.Value(0);
        animatedPlayersRef.current.set(player.id, { player, scale, opacity });
        
        // Animate in
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        // Update existing player data
        animatedPlayersRef.current.get(player.id)!.player = player;
      }
    });
  }, [players]);

  return (
    <View className="flex-row flex-wrap gap-2">
      {players.map((player) => {
        const animated = animatedPlayersRef.current.get(player.id);
        const isSelecting = player.state === "selecting";
        const isCompressing = player.state === "compressing";
        const isUploading = player.state === "uploading";
        const isBusy = isSelecting || isCompressing || isUploading;
        const spinnerColor = STATE_SPINNER_COLOR[player.state || "selecting"] || "#9ca3af";

        if (!animated) {
          // If player doesn't have animation yet, create it immediately
          const scale = new Animated.Value(1);
          const opacity = new Animated.Value(1);
          animatedPlayersRef.current.set(player.id, { player, scale, opacity });
          return (
            <View
              key={player.id}
              className="px-3 py-2 bg-gray-800 rounded-lg flex-row items-center gap-1"
            >
              <Text className={`${isBusy ? "text-gray-400" : "text-white"} text-sm`}>
                {player.name}
              </Text>
              {isBusy && (
                <ActivityIndicator size="small" color={spinnerColor} />
              )}
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
        }
        const { scale, opacity } = animated;
        const baseOpacity = isSelecting ? 0.5 : 1;

        return (
          <Animated.View
            key={player.id}
            style={{
              transform: [{ scale }],
              opacity: Animated.multiply(opacity, baseOpacity),
            }}
          >
            <View className="px-3 py-2 bg-gray-800 rounded-lg flex-row items-center gap-1">
              <Text className={`${isBusy ? "text-gray-400" : "text-white"} text-sm`}>
                {player.name}
              </Text>
              {isBusy && (
                <ActivityIndicator size="small" color={spinnerColor} />
              )}
              {player.isHost && Crown ? (
                <Crown size={12} color="#fbbf24" />
              ) : player.isHost ? (
                <Text className="text-yellow-400 text-xs">👑</Text>
              ) : null}
              {player.id === currentUserId && (
                <Text className="text-gray-400 text-xs">(You)</Text>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
