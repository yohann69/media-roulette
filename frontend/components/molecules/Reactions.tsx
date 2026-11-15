import { useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { REACTIONS, useSocket, type Reaction } from "../../stores/useSocket";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useTranslation } from "../../hooks/useTranslation";

interface Floating {
  key: number;
  emoji: string;
  name: string;
  x: number;
  progress: Animated.Value;
}

/** At most this many emoji float at once, so a burst never floods the screen. */
const MAX_FLOATING = 12;
const FLOAT_MS = 2200;

/**
 * Shows everyone's reactions floating up the screen. Sits on top of the screen
 * content and never intercepts touches.
 */
export function ReactionLayer() {
  const { height, width } = useWindowDimensions();
  const [items, setItems] = useState<Floating[]>([]);
  const nextKey = useRef(0);

  useSocketEvent("reaction", ({ playerId, emoji }: { playerId: string; emoji: string }) => {
    const name = useSocket.getState().room?.players.find((p) => p.id === playerId)?.name ?? "";
    const item: Floating = {
      key: nextKey.current++,
      emoji,
      name,
      x: 24 + Math.random() * Math.max(0, width - 96),
      progress: new Animated.Value(0),
    };
    setItems((prev) => [...prev.slice(-(MAX_FLOATING - 1)), item]);
    Animated.timing(item.progress, {
      toValue: 1,
      duration: FLOAT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setItems((prev) => prev.filter((i) => i.key !== item.key)));
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((item) => (
        <Animated.View
          key={item.key}
          style={{
            position: "absolute",
            left: item.x,
            top: height * 0.72,
            alignItems: "center",
            opacity: item.progress.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: item.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.45] }) },
              { scale: item.progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.15, 1] }) },
            ],
          }}
        >
          <Text style={{ fontSize: 40 }}>{item.emoji}</Text>
          {!!item.name && (
            <Text className="text-white text-xs font-semibold" numberOfLines={1} style={{ maxWidth: 80 }}>
              {item.name}
            </Text>
          )}
        </Animated.View>
      ))}
    </View>
  );
}

/** Row of reaction buttons. */
export function ReactionBar({ pin }: { pin: string }) {
  const { t } = useTranslation();
  const sendReaction = useSocket((s) => s.sendReaction);

  const send = (emoji: Reaction) => {
    Haptics.selectionAsync().catch(() => {});
    sendReaction(pin, emoji);
  };

  return (
    <View className="flex-row justify-center gap-3" accessibilityRole="toolbar" accessibilityLabel={t("reactions.label")}>
      {REACTIONS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => send(emoji)}
          accessibilityRole="button"
          accessibilityLabel={t("reactions.send", { emoji })}
          className="w-12 h-12 rounded-full bg-gray-800/80 items-center justify-center active:scale-90"
        >
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}
