import { View, Text, ActivityIndicator, Pressable } from "react-native";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { Crown, WifiOff, X } from "lucide-react-native";
import { useTranslation } from "../../hooks/useTranslation";

interface Player {
  id: string;
  name: string;
  isHost?: boolean;
  state?: "selecting" | "compressing" | "uploading" | "ready";
  /** False while the player is temporarily offline (they keep their seat for a minute). */
  connected?: boolean;
  /** Games won in this room's series of rematches. */
  seriesWins?: number;
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
  /** When set (host only), other players get a remove button. */
  onKick?: (player: Player) => void;
}

interface AnimatedPlayer {
  scale: Animated.Value;
  opacity: Animated.Value;
  started: boolean;
}

export function PlayerList({ players, currentUserId, onKick }: PlayerListProps) {
  const { t } = useTranslation();
  const animatedPlayersRef = useRef<Map<string, AnimatedPlayer>>(new Map());

  // Players spring in when they join.
  useEffect(() => {
    const currentPlayerIds = new Set(players.map((p) => p.id));
    animatedPlayersRef.current.forEach((_, playerId) => {
      if (!currentPlayerIds.has(playerId)) animatedPlayersRef.current.delete(playerId);
    });
    players.forEach((player) => {
      const animated = animatedPlayersRef.current.get(player.id);
      if (!animated || animated.started) return;
      animated.started = true;
      Animated.parallel([
        Animated.spring(animated.scale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
        Animated.timing(animated.opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  }, [players]);

  const animationFor = (playerId: string): AnimatedPlayer => {
    let animated = animatedPlayersRef.current.get(playerId);
    if (!animated) {
      animated = { scale: new Animated.Value(0), opacity: new Animated.Value(0), started: false };
      animatedPlayersRef.current.set(playerId, animated);
    }
    return animated;
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {players.map((player) => {
        const { scale, opacity } = animationFor(player.id);
        const isSelecting = player.state === "selecting";
        const isBusy = isSelecting || player.state === "compressing" || player.state === "uploading";
        const spinnerColor = STATE_SPINNER_COLOR[player.state || "selecting"] || "#9ca3af";
        const isOffline = player.connected === false;
        const isMe = player.id === currentUserId;
        const baseOpacity = isOffline ? 0.4 : isSelecting ? 0.5 : 1;

        return (
          <Animated.View
            key={player.id}
            style={{ transform: [{ scale }], opacity: Animated.multiply(opacity, baseOpacity) }}
          >
            <View className="px-3 py-2 bg-gray-800 rounded-lg flex-row items-center gap-1">
              <Text className={`${isBusy ? "text-gray-400" : "text-white"} text-sm`}>{player.name}</Text>
              {isOffline ? (
                <WifiOff size={12} color="#9ca3af" />
              ) : isBusy ? (
                <ActivityIndicator size="small" color={spinnerColor} />
              ) : null}
              {player.isHost && <Crown size={12} color="#fbbf24" />}
              {!!player.seriesWins && (
                <Text className="text-yellow-400 text-xs" accessibilityLabel={t("lobby.seriesWins", { count: player.seriesWins })}>
                  🏆{player.seriesWins}
                </Text>
              )}
              {isMe && <Text className="text-gray-400 text-xs">({t("lobby.you")})</Text>}
              {onKick && !isMe && (
                <Pressable
                  onPress={() => onKick(player)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t("lobby.removePlayer", { name: player.name })}
                  className="ml-1"
                >
                  <X size={14} color="#9ca3af" />
                </Pressable>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}
