import { View, Text, Animated, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Input } from "../../components/atoms/Input";
import { Button } from "../../components/atoms/Button";
import { useUsername } from "../../hooks/useUsername";
import { GameSettingsModal } from "../game-settings/GameSettingsModal";
import { useGameSettings, GameSettings } from "../../hooks/useGameSettings";

export function HomeScreen() {
    const router = useRouter();
    const { username, setUsername, isLoading } = useUsername();
    const { saveSettings } = useGameSettings();
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // Animation values
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const titleTranslateY = useRef(new Animated.Value(20)).current;
    const inputOpacity = useRef(new Animated.Value(0)).current;
    const inputTranslateY = useRef(new Animated.Value(20)).current;
    const button1Opacity = useRef(new Animated.Value(0)).current;
    const button1TranslateY = useRef(new Animated.Value(20)).current;
    const button2Opacity = useRef(new Animated.Value(0)).current;
    const button2TranslateY = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        if (!isLoading) {
            // Animate title with delay
            setTimeout(() => {
                Animated.parallel([
                    Animated.spring(titleOpacity, {
                        toValue: 1,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                    Animated.spring(titleTranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                ]).start();
            }, 100);

            // Animate input with delay
            setTimeout(() => {
                Animated.parallel([
                    Animated.spring(inputOpacity, {
                        toValue: 1,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                    Animated.spring(inputTranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                ]).start();
            }, 200);

            // Animate buttons with delay
            setTimeout(() => {
                Animated.parallel([
                    Animated.spring(button1Opacity, {
                        toValue: 1,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                    Animated.spring(button1TranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                ]).start();
            }, 300);

            setTimeout(() => {
                Animated.parallel([
                    Animated.spring(button2Opacity, {
                        toValue: 1,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                    Animated.spring(button2TranslateY, {
                        toValue: 0,
                        useNativeDriver: true,
                        tension: 50,
                        friction: 7,
                    }),
                ]).start();
            }, 400);
        }
    }, [isLoading, titleOpacity, titleTranslateY, inputOpacity, inputTranslateY, button1Opacity, button1TranslateY, button2Opacity, button2TranslateY]);

    const titleStyle = {
        opacity: titleOpacity,
        transform: [{ translateY: titleTranslateY }],
    };

    const inputStyle = {
        opacity: inputOpacity,
        transform: [{ translateY: inputTranslateY }],
    };

    const button1Style = {
        opacity: button1Opacity,
        transform: [{ translateY: button1TranslateY }],
    };

    const button2Style = {
        opacity: button2Opacity,
        transform: [{ translateY: button2TranslateY }],
    };

    const isUsernameValid = username.trim().length > 0;

    const handleCreateGame = () => {
        if (isUsernameValid) {
            setShowSettingsModal(true);
        }
    };

    const handleSettingsConfirm = (settings: GameSettings) => {
        saveSettings(settings);
        router.push("/selection");
    };

    const handleJoinGame = () => {
        if (isUsernameValid) {
            router.push("/join");
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-black items-center justify-center">
                <Text className="text-white">Loading...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-black">
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 48 }}>
                <Animated.View style={titleStyle} className="mb-12 items-center">
                    <Text className="text-white text-4xl font-bold mb-2">
                        PhotoRoulette
                    </Text>
                    <Text className="text-gray-400 text-lg">Let's play together!</Text>
                </Animated.View>

                <Animated.View style={inputStyle} className="mb-8">
                    <Input
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Enter your username"
                        label="Username"
                        autoFocus={!username}
                    />
                </Animated.View>
            </ScrollView>

            <View className="px-6 py-4 border-t border-gray-800 bg-black">
                <Animated.View style={button1Style} className="mb-3">
                    <Button
                        title="Create Game"
                        onPress={handleCreateGame}
                        disabled={!isUsernameValid}
                        variant="primary"
                    />
                </Animated.View>
                <Animated.View style={button2Style}>
                    <Button
                        title="Join Game"
                        onPress={handleJoinGame}
                        disabled={!isUsernameValid}
                        variant="secondary"
                    />
                </Animated.View>
            </View>

            <GameSettingsModal
                visible={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                onConfirm={handleSettingsConfirm}
            />
        </View>
    );
}
