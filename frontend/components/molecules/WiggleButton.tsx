import { TouchableOpacity, Text, Animated, StyleSheet } from "react-native";
import { useEffect, useRef } from "react";

interface WiggleButtonProps {
  title: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
  visible?: boolean;
}

export function WiggleButton({
  title,
  onPress,
  color,
  disabled = false,
  visible = true,
}: WiggleButtonProps) {
  const translateX = useRef(new Animated.Value(visible ? 0 : -300)).current;
  const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Slide in from left with bounce
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Slide out to right
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 300,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateX, scaleAnim, opacityAnim]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.95,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      tension: 300,
      friction: 20,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    // Bounce animation on press
    Animated.sequence([
      Animated.spring(pressScale, {
        toValue: 1.05,
        tension: 200,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(pressScale, {
        toValue: 1,
        tension: 200,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Call the actual onPress after a short delay for better UX
    setTimeout(() => {
      onPress();
    }, 150);
  };

  return (
    <Animated.View
      style={[
        {
          transform: [
            { translateX },
            { scale: Animated.multiply(scaleAnim, pressScale) },
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          { backgroundColor: color },
          disabled && styles.disabled,
        ]}
        activeOpacity={0.9}
      >
        <Text style={styles.text}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    paddingVertical: 14, // Reduced from 20 to match input height
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    minHeight: 52, // Match input height
  },
  text: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});

