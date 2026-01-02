import { View, Text, Animated, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Input } from "../../components/atoms/Input";
import { Button } from "../../components/atoms/Button";
import { useUsername } from "../../hooks/useUsername";
import { GameSettingsModal } from "../game-settings/GameSettingsModal";
import { useGameSettings, GameSettings } from "../../hooks/useGameSettings";
import { useSocket } from "../../stores/useSocket";

export function HomeScreen() {
    const router = useRouter();
    const { username, setUsername, isLoading } = useUsername();
    const { saveSettings } = useGameSettings();
    const { connect, createGame, isConnected } = useSocket();
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [isCreatingGame, setIsCreatingGame] = useState(false);

    // Connect socket on mount
    useEffect(() => {
        connect();
        return () => {
            // Cleanup on unmount if needed
        };
    }, [connect]);

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

    const handleSettingsConfirm = async (settings: GameSettings) => {
        saveSettings(settings);
        setIsCreatingGame(true);

        // Create game via socket
        const pin = await createGame(username || "Player", settings);
        
        if (pin) {
            // Navigate to selection as host with PIN
            router.push({ 
                pathname: "/selection", 
                params: { isHost: "true", pin } 
            });
        } else {
            setIsCreatingGame(false);
            // Show error (could add error state here)
            console.error("Failed to create game");
        }
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
                    {!isConnected && (
                        <Text className="text-orange-400 text-sm mt-2">
                            Connecting to server...
                        </Text>
                    )}
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
                        title={isCreatingGame ? "Creating..." : "Create Game"}
                        onPress={handleCreateGame}
                        disabled={!isUsernameValid || isCreatingGame || !isConnected}
                        variant="primary"
                    />
                </Animated.View>
                <Animated.View style={button2Style}>
                    <Button
                        title="Join Game"
                        onPress={handleJoinGame}
                        disabled={!isUsernameValid || !isConnected}
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
