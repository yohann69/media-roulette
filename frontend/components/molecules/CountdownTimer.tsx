import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Animated } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

interface CountdownTimerProps {
  duration: number;
  onComplete: () => void;
  isActive: boolean;
  roundKey?: string | number; // Key to reset timer only when round changes
}

export function CountdownTimer({
  duration,
  onComplete,
  isActive,
  roundKey,
}: CountdownTimerProps) {
  const { t } = useTranslation();
  const progress = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const lastRoundKeyRef = useRef<string | number | undefined>(undefined);
  const hasStartedRef = useRef<boolean>(false);
  // Keep onComplete in a ref so parent re-renders (e.g. after a user selects a
  // player) don't invalidate the effect below and tear down the running timer.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Only reset timer if roundKey changed (new round)
    const isNewRound = roundKey !== undefined && roundKey !== lastRoundKeyRef.current;
    
    if (!isActive) {
      // Timer stopped - don't reset, just stop animations
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      hasStartedRef.current = false;
      return;
    }

    // If it's a new round, reset everything and start timer
    if (isNewRound && !hasStartedRef.current) {
      lastRoundKeyRef.current = roundKey;
      hasStartedRef.current = true;
      progress.setValue(1);
      setTimeLeft(duration);
      
      // Stop any existing animation
      if (animationRef.current) {
        animationRef.current.stop();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Start new animation
      const animation = Animated.timing(progress, {
        toValue: 0,
        duration: duration * 1000,
        useNativeDriver: false,
      });
      animationRef.current = animation;

      animation.start(({ finished }) => {
        if (finished) {
          setTimeLeft(0);
          onCompleteRef.current();
        }
      });

      // Start interval for time display
      let currentTime = duration;
      intervalRef.current = setInterval(() => {
        currentTime = Math.max(0, currentTime - 1);
        setTimeLeft(currentTime);
        if (currentTime === 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, 1000);
    }
    // If not a new round and timer already started, don't reset - timer continues

    return () => {
      // Cleanup on unmount
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [duration, isActive, progress, roundKey]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View className="w-full mb-4">
      <View className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <Animated.View
          className="h-full bg-primary rounded-full"
          style={{ width }}
        />
      </View>
      <View className="flex-row justify-between items-center mt-2">
        <Text className="text-gray-400 text-sm">{t("game.timeRemaining")}</Text>
        <Text className="text-white text-sm font-semibold">
          {timeLeft}s
        </Text>
      </View>
    </View>
  );
}
