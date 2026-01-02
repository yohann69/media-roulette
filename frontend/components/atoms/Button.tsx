import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    Animated,
} from "react-native";
import { useEffect, useRef } from "react";

interface ButtonProps {
    title: string;
    onPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
    disabled?: boolean;
    variant?: "primary" | "secondary";
    loading?: boolean;
}

export function Button({
    title,
    onPress,
    onPressIn,
    onPressOut,
    disabled = false,
    variant = "primary",
    loading = false,
}: ButtonProps) {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(disabled ? 0.5 : 1)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: disabled ? 0.5 : 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [disabled, opacity]);

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
            tension: 300,
            friction: 20,
        }).start();
        
        if (onPressIn) onPressIn();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 20,
        }).start();

        if (onPressOut) onPressOut();
    };

    const animatedStyle = {
        transform: [{ scale }],
        opacity,
    };

    const bgColor = variant === "primary" ? "bg-primary" : "bg-secondary";
    const textColor = "text-white";

    return (
        <Animated.View style={animatedStyle} className="w-full">
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                className={`${bgColor} py-6 px-8 rounded-2xl items-center justify-center ${disabled ? "opacity-50" : ""}`}
                activeOpacity={0.8}
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text className={`${textColor} text-xl font-bold`}>{title}</Text>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}
