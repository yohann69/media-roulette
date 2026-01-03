import { Animated } from "react-native";

/**
 * Creates a wiggle animation that continuously rotates slightly
 */
export function createWiggleAnimation() {
  const rotateAnim = new Animated.Value(0);
  
  const startWiggle = () => {
    const wiggle = () => {
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Repeat after a delay
        setTimeout(() => {
          wiggle();
        }, 2000 + Math.random() * 1000); // Random delay between 2-3 seconds
      });
    };
    
    wiggle();
  };
  
  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-3deg', '3deg'],
  });
  
  return {
    rotateAnim,
    rotate,
    startWiggle,
  };
}

/**
 * Creates a spring animation for appearing/disappearing elements
 */
export function createSpringAnimation(initialValue: number = 0) {
  const scale = new Animated.Value(initialValue);
  const opacity = new Animated.Value(initialValue);
  
  const appear = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const disappear = (callback?: () => void) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };
  
  return {
    scale,
    opacity,
    appear,
    disappear,
  };
}

