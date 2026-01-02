import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { Animated } from "react-native";

interface CountdownTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  isActive: boolean;
}

export function CountdownTimer({
  duration,
  onComplete,
  isActive,
}: CountdownTimerProps) {
  const progress = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isActive) {
      progress.setValue(1);
      setTimeLeft(duration);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Reset progress and time
    progress.setValue(1);
    setTimeLeft(duration);

    // Start countdown animation
    const animation = Animated.timing(progress, {
      toValue: 0,
      duration: duration * 1000,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        setTimeLeft(0);
        onComplete();
      }
    });

    // Update time left every second
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

    return () => {
      animation.stop();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [duration, isActive, onComplete, progress]);

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
        <Text className="text-gray-400 text-sm">Time remaining</Text>
        <Text className="text-white text-sm font-semibold">
          {timeLeft}s
        </Text>
      </View>
    </View>
  );
}
