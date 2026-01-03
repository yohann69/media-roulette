import { TouchableOpacity, Text, Animated, StyleSheet } from "react-native";
import { useEffect, useRef } from "react";
import { createWiggleAnimation } from "../../utils/wiggleAnimation";

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
  const wiggle = useRef(createWiggleAnimation()).current;
  const scaleAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
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
      ]).start(() => {
        wiggle.startWiggle();
      });
    } else {
      Animated.parallel([
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
  }, [visible, scaleAnim, opacityAnim, wiggle]);

  // Always render to allow animations to work properly

  return (
    <Animated.View
      style={[
        {
          transform: [
            { scale: scaleAnim },
            { rotate: wiggle.rotate },
          ],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.button,
          { backgroundColor: color },
          disabled && styles.disabled,
        ]}
        activeOpacity={0.8}
      >
        <Text style={styles.text}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  text: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});

