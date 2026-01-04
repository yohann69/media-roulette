import { View, Text, Animated, Image, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Input } from "../../components/atoms/Input";
import { BackgroundSlideshow } from "../../components/molecules/BackgroundSlideshow";
import { WiggleButton } from "../../components/molecules/WiggleButton";
import { CustomSlider } from "../../components/atoms/Slider";
import { Toggle } from "../../components/atoms/Toggle";
import { QRScanner } from "../../components/molecules/QRScanner";
import { AnimatedLogo } from "../../components/molecules/AnimatedLogo";
import { useUsername } from "../../hooks/useUsername";
import { useGameSettings, GameSettings } from "../../hooks/useGameSettings";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";
import { createSpringAnimation } from "../../utils/wiggleAnimation";

type ScreenState = "home" | "create-mode" | "create-rounds" | "create-settings" | "create-duration" | "join";

const MODE_COLORS = {
  Photo: "#f97316", // Orange
  Video: "#3b82f6", // Blue
  Mix: "#a855f7", // Purple
  Blind: "#ef4444", // Red
};

const ROUND_OPTIONS = [10, 25, 50, 100];

export function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { username, setUsername, isLoading } = useUsername();
  const { saveSettings } = useGameSettings();
  const { connect, createGame, joinGame, isConnected } = useSocket();
  
  const [screenState, setScreenState] = useState<ScreenState>("home");
  const [selectedMode, setSelectedMode] = useState<"Photo" | "Video" | "Mix" | "Blind">("Photo");
  const [rounds, setRounds] = useState(10);
  const [timer, setTimer] = useState(5);
  const [playVideoWithSound, setPlayVideoWithSound] = useState(true);
  const [pin, setPin] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Animation refs
  const logoAnim = useRef(createSpringAnimation(0)).current;
  const inputAnim = useRef(createSpringAnimation(0)).current;
  const buttonsAnim = useRef(createSpringAnimation(0)).current;

  // Connect socket on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Animate logo and input on mount
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => logoAnim.appear(), 100);
      setTimeout(() => inputAnim.appear(), 200);
      setTimeout(() => buttonsAnim.appear(), 300);
    }
  }, [isLoading, logoAnim, inputAnim, buttonsAnim]);

  const isUsernameValid = username.trim().length > 0;
  const currentColor = MODE_COLORS[selectedMode];

  const handleBackgroundPress = () => {
    if (screenState === "create-mode") {
      setScreenState("home");
    } else if (screenState === "create-rounds") {
      setScreenState("create-mode");
    } else if (screenState === "create-settings") {
      setScreenState("create-rounds");
    } else if (screenState === "create-duration") {
      setScreenState("create-settings");
    } else if (screenState === "join") {
      setScreenState("home");
    }
  };

  const handleCreateGame = () => {
    if (isUsernameValid) {
      setScreenState("create-mode");
    }
  };

  const handleModeSelect = (mode: "Photo" | "Video" | "Mix" | "Blind") => {
    setSelectedMode(mode);
    // Trigger logo animation by temporarily resetting targetMode
    setScreenState("create-rounds");
  };

  const handleRoundsSelect = (roundsValue: number) => {
    setRounds(roundsValue);
    setScreenState("create-settings");
  };

  const handleSettingsConfirm = async () => {
    const settings: any = {
      rounds,
      timer,
      mode: selectedMode === "Blind" ? "Photo" : selectedMode, // Blind mode uses Photo mode but with blindMode flag
      playVideoWithSound: (selectedMode === "Video" || selectedMode === "Mix") ? playVideoWithSound : undefined,
      blindMode: selectedMode === "Blind", // Set blindMode flag if Blind mode is selected
    };
    
    saveSettings(settings);
    setIsCreatingGame(true);

    const gamePin = await createGame(username || "Player", settings);

    if (gamePin) {
      router.push({
        pathname: "/selection",
        params: { isHost: "true", pin: gamePin }
      });
    } else {
      setIsCreatingGame(false);
      console.error("Failed to create game");
    }
  };

  const handleJoinGame = () => {
    if (isUsernameValid) {
      setScreenState("join");
    }
  };

  const handleJoin = async () => {
    if (pin.trim().length === 6 && /^\d{6}$/.test(pin) && !isJoining && isConnected) {
      setIsJoining(true);
      setJoinError("");
      const success = await joinGame(pin.trim(), username || "Player");
      if (success) {
        router.push({
          pathname: "/selection",
          params: { isHost: "false", pin: pin.trim() }
        });
      } else {
        setIsJoining(false);
        setJoinError(t("join.error"));
      }
    }
  };

  const handleQRScan = (scannedPin: string) => {
    setPin(scannedPin);
    setShowScanner(false);
    if (scannedPin.length === 6 && /^\d{6}$/.test(scannedPin)) {
      setTimeout(() => handleJoin(), 100);
    }
  };

  const isValidPIN = pin.trim().length === 6 && /^\d{6}$/.test(pin);

  if (isLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">{t("common.loading")}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <BackgroundSlideshow />
      <View className="flex-1" style={{ zIndex: 1 }}>
        {/* Background tap handler - only active when not on home screen */}
        {screenState !== "home" && (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleBackgroundPress}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        )}
        
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
          {/* Logo */}
          <Animated.View
            style={{
              transform: [{ scale: logoAnim.scale }],
              opacity: logoAnim.opacity,
            }}
            className="pt-12 items-center mb-8"
          >
            <AnimatedLogo 
              targetMode={
                screenState === "home" ? "initial" : 
                screenState === "create-mode" ? selectedMode : 
                undefined
              }
              size={200}
            />
            {!isConnected && (
              <Text className="text-orange-400 text-sm mt-2">
                {t("common.connecting")}
              </Text>
            )}
          </Animated.View>

          {/* Main Content */}
          <View className="flex-1 justify-start px-6 pb-8">
            {/* Home State */}
            {screenState === "home" && (
              <>
                <Animated.View
                  style={{
                    transform: [{ scale: inputAnim.scale }],
                    opacity: inputAnim.opacity,
                  }}
                  className="mb-8"
                >
                  <Input
                    value={username}
                    onChangeText={setUsername}
                    placeholder={username ? undefined : t("home.usernamePlaceholder")}
                    autoFocus={!username}
                  />
                </Animated.View>

                <Animated.View
                  style={{
                    transform: [{ scale: buttonsAnim.scale }],
                    opacity: buttonsAnim.opacity,
                  }}
                >
                  <WiggleButton
                    title={t("home.createGame")}
                    onPress={handleCreateGame}
                    color="#f97316"
                    disabled={!isUsernameValid || isCreatingGame || !isConnected}
                    visible={true}
                  />
                  <WiggleButton
                    title={t("home.joinGame")}
                    onPress={handleJoinGame}
                    color="#3b82f6"
                    disabled={!isUsernameValid || !isConnected}
                    visible={true}
                  />
                </Animated.View>
              </>
            )}

            {/* Create Mode Selection */}
            {screenState === "create-mode" && (
              <View>
                <Text className="text-white text-3xl font-bold text-center mb-8">
                  {t("gameSettings.selectMode")}
                </Text>
                <WiggleButton
                  title={t("gameSettings.photo")}
                  onPress={() => handleModeSelect("Photo")}
                  color={MODE_COLORS.Photo}
                  visible={true}
                />
                <WiggleButton
                  title={t("gameSettings.video")}
                  onPress={() => handleModeSelect("Video")}
                  color={MODE_COLORS.Video}
                  visible={true}
                />
                <WiggleButton
                  title={t("gameSettings.mix")}
                  onPress={() => handleModeSelect("Mix")}
                  color={MODE_COLORS.Mix}
                  visible={true}
                />
                <WiggleButton
                  title={t("gameSettings.blind")}
                  onPress={() => handleModeSelect("Blind")}
                  color={MODE_COLORS.Blind}
                  visible={true}
                />
              </View>
            )}

            {/* Create Rounds Selection */}
            {screenState === "create-rounds" && (
              <View>
                <Text className="text-white text-3xl font-bold text-center mb-8">
                  {t("gameSettings.rounds")}
                </Text>
                {ROUND_OPTIONS.map((option) => (
                  <WiggleButton
                    key={option}
                    title={option.toString()}
                    onPress={() => handleRoundsSelect(option)}
                    color={currentColor}
                    visible={true}
                  />
                ))}
              </View>
            )}

            {/* Create Settings */}
            {screenState === "create-settings" && (
              <View>
                {(selectedMode === "Video" || selectedMode === "Mix") ? (
                  <>
                    <Text className="text-white text-3xl font-bold text-center mb-8">
                      {t("gameSettings.playVideoWithSound")}
                    </Text>
                    <WiggleButton
                      title={playVideoWithSound ? t("gameSettings.withSound") : t("gameSettings.withoutSound")}
                      onPress={() => {
                        setPlayVideoWithSound(!playVideoWithSound);
                        // Auto-continue to duration selection
                        setTimeout(() => {
                          setScreenState("create-duration");
                        }, 200);
                      }}
                      color={currentColor}
                      visible={true}
                    />
                  </>
                ) : (
                  <>
                    <Text className="text-white text-3xl font-bold text-center mb-8">
                      {t("gameSettings.roundDuration")}
                    </Text>
                    {[5, 6,  8, 10].map((seconds) => (
                      <WiggleButton
                        key={seconds}
                        title={`${seconds} ${t("gameSettings.seconds")}`}
                        onPress={() => {
                          setTimer(seconds);
                          // Auto-continue when timer is selected
                          setTimeout(() => {
                            handleSettingsConfirm();
                          }, 200);
                        }}
                        color={currentColor}
                        visible={true}
                      />
                    ))}
                  </>
                )}
              </View>
            )}

            {/* Create Duration Selection */}
            {screenState === "create-duration" && (
              <View>
                <Text className="text-white text-3xl font-bold text-center mb-8">
                  {t("gameSettings.roundDuration")}
                </Text>
                {[5, 6, 7, 8, 9, 10].map((seconds) => (
                  <WiggleButton
                    key={seconds}
                    title={`${seconds} ${t("gameSettings.seconds")}`}
                    onPress={() => {
                      setTimer(seconds);
                      // Auto-continue when timer is selected
                      setTimeout(() => {
                        handleSettingsConfirm();
                      }, 200);
                    }}
                    color={currentColor}
                    visible={true}
                  />
                ))}
              </View>
            )}

            {/* Join Game */}
            {screenState === "join" && (
              <View>
                <Text className="text-white text-3xl font-bold text-center mb-8">
                  {t("join.title")}
                </Text>

                {joinError && (
                  <Text className="text-red-400 text-sm text-center mb-4">
                    {joinError}
                  </Text>
                )}

                <View className="relative mb-6">
                  <Input
                    value={pin}
                    onChangeText={(text) => {
                      const digitsOnly = text.replace(/\D/g, "").slice(0, 6);
                      setPin(digitsOnly);
                      setJoinError("");
                    }}
                    placeholder={t("join.pinPlaceholder")}
                    autoFocus
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    onPress={() => setShowScanner(true)}
                    disabled={!isConnected}
                    className="absolute right-3 top-3 p-2 items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <View className="items-center justify-center">
                      {(() => {
                        try {
                          const { Camera } = require("lucide-react-native");
                          return <Camera size={24} color="#ffffff" />;
                        } catch {
                          return <Text className="text-2xl">📷</Text>;
                        }
                      })()}
                    </View>
                  </TouchableOpacity>
                </View>

                <WiggleButton
                  title={isJoining ? t("join.joining") : t("home.joinGame")}
                  onPress={handleJoin}
                  color="#3b82f6"
                  disabled={!isValidPIN || isJoining || !isConnected}
                  visible={true}
                />
              </View>
            )}
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
    </View>
  );
}
