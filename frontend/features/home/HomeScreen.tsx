import { View, Text, Animated, Image, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Input } from "../../components/atoms/Input";
import { BackgroundSlideshow } from "../../components/molecules/BackgroundSlideshow";
import { WiggleButton } from "../../components/molecules/WiggleButton";
import { CustomSlider } from "../../components/atoms/Slider";
import { Toggle } from "../../components/atoms/Toggle";
import { QRScanner } from "../../components/molecules/QRScanner";
import { useUsername } from "../../hooks/useUsername";
import { useGameSettings, GameSettings } from "../../hooks/useGameSettings";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";
import { createSpringAnimation } from "../../utils/wiggleAnimation";

type ScreenState = "home" | "create-mode" | "create-rounds" | "create-settings" | "join";

const MODE_COLORS = {
  Photo: "#f97316", // Orange
  Video: "#3b82f6", // Blue
  Mix: "#a855f7", // Purple
};

const ROUND_OPTIONS = [10, 25, 50, 100];

export function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { username, setUsername, isLoading } = useUsername();
  const { saveSettings } = useGameSettings();
  const { connect, createGame, joinGame, isConnected } = useSocket();
  
  const [screenState, setScreenState] = useState<ScreenState>("home");
  const [selectedMode, setSelectedMode] = useState<"Photo" | "Video" | "Mix">("Photo");
  const [rounds, setRounds] = useState(10);
  const [timer, setTimer] = useState(5);
  const [playVideoWithSound, setPlayVideoWithSound] = useState(true);
  const [blindMode, setBlindMode] = useState(false);
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
    } else if (screenState === "join") {
      setScreenState("home");
    }
  };

  const handleCreateGame = () => {
    if (isUsernameValid) {
      setScreenState("create-mode");
    }
  };

  const handleModeSelect = (mode: "Photo" | "Video" | "Mix") => {
    setSelectedMode(mode);
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
      mode: selectedMode,
      playVideoWithSound: (selectedMode === "Video" || selectedMode === "Mix") ? playVideoWithSound : undefined,
      blindMode,
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
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleBackgroundPress}
            style={StyleSheet.absoluteFillObject}
          />
        )}
        
        <View className="flex-1">
          {/* Logo */}
          <Animated.View
            style={{
              transform: [{ scale: logoAnim.scale }],
              opacity: logoAnim.opacity,
            }}
            className="pt-12 items-center"
          >
            <Image
              source={require("../../assets/icon.png")}
              style={{ width: 280, height: 280 }}
              resizeMode="contain"
            />
            {!isConnected && (
              <Text className="text-orange-400 text-sm mt-2">
                {t("common.connecting")}
              </Text>
            )}
          </Animated.View>

          {/* Main Content */}
          <View className="flex-1 justify-center px-6">
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
                <Text className="text-white text-2xl font-bold text-center mb-8">
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
              </View>
            )}

            {/* Create Rounds Selection */}
            {screenState === "create-rounds" && (
              <View>
                <Text className="text-white text-2xl font-bold text-center mb-8">
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
                <Text className="text-white text-2xl font-bold text-center mb-8">
                  {t("gameSettings.additionalSettings")}
                </Text>
                
                <View className="mb-6">
                  <CustomSlider
                    label={t("gameSettings.timer")}
                    value={timer}
                    onValueChange={setTimer}
                    minimumValue={1}
                    maximumValue={15}
                    step={1}
                  />
                </View>

                {(selectedMode === "Video" || selectedMode === "Mix") && (
                  <View className="mb-6">
                    <Text className="text-white text-base font-semibold mb-3">
                      {t("gameSettings.playVideoWithSound")}
                    </Text>
                    <View className="flex-row items-center justify-between bg-gray-800 rounded-xl p-4">
                      <Text className="text-gray-300 text-sm flex-1">
                        {t("gameSettings.playVideoWithSoundDescription")}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setPlayVideoWithSound(!playVideoWithSound)}
                        className={`w-14 h-8 rounded-full ${
                          playVideoWithSound ? "bg-primary" : "bg-gray-600"
                        } justify-center`}
                      >
                        <View
                          className={`w-6 h-6 rounded-full bg-white ${
                            playVideoWithSound ? "ml-7" : "ml-1"
                          }`}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View className="mb-6">
                  <Text className="text-white text-base font-semibold mb-3">
                    {t("gameSettings.blindMode")}
                  </Text>
                  <View className="flex-row items-center justify-between bg-gray-800 rounded-xl p-4">
                    <Text className="text-gray-300 text-sm flex-1">
                      {t("gameSettings.blindModeDescription")}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setBlindMode(!blindMode)}
                      className={`w-14 h-8 rounded-full ${
                        blindMode ? "bg-primary" : "bg-gray-600"
                      } justify-center`}
                    >
                      <View
                        className={`w-6 h-6 rounded-full bg-white ${
                          blindMode ? "ml-7" : "ml-1"
                        }`}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <WiggleButton
                  title={isCreatingGame ? t("home.creating") : t("common.continue")}
                  onPress={handleSettingsConfirm}
                  color={currentColor}
                  disabled={isCreatingGame}
                  visible={true}
                />
              </View>
            )}

            {/* Join Game */}
            {screenState === "join" && (
              <View>
                <Text className="text-white text-2xl font-bold text-center mb-4">
                  {t("join.title")}
                </Text>
                <Text className="text-gray-400 text-center mb-8">
                  {t("join.description")}
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
                    label={t("join.pinLabel")}
                    autoFocus
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    onPress={() => setShowScanner(true)}
                    disabled={!isConnected}
                    className="absolute right-3 top-10 p-2 items-center justify-center"
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
                  title={isJoining ? t("join.joining") : t("join.join")}
                  onPress={handleJoin}
                  color="#3b82f6"
                  disabled={!isValidPIN || isJoining || !isConnected}
                  visible={true}
                />
              </View>
            )}
          </View>
        </View>
      </View>

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
    </View>
  );
}
