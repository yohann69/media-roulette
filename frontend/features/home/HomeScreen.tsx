import { View, Text, Animated, Image, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, BackHandler, Pressable, Keyboard, Vibration } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "../../components/atoms/Input";
import { BackgroundSlideshow } from "../../components/molecules/BackgroundSlideshow";
import { WiggleButton } from "../../components/molecules/WiggleButton";
import { CustomSlider } from "../../components/atoms/Slider";
import { Toggle } from "../../components/atoms/Toggle";
import { QRScanner } from "../../components/molecules/QRScanner";
import { AnimatedLogo } from "../../components/molecules/AnimatedLogo";
import { CustomModal } from "../../components/molecules/Modal";
import { Button } from "../../components/atoms/Button";
import { MAX_USERNAME_LENGTH, useUsername } from "../../hooks/useUsername";
import { useGameSettings, GameSettings } from "../../hooks/useGameSettings";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";
import { createSpringAnimation } from "../../utils/wiggleAnimation";
import { checkMediaAvailability } from "../../utils/checkMediaAvailability";
import { getPermissionsAsync, presentPermissionsPicker } from "expo-media-library";

// Safely import lucide-react-native icons
let CameraIcon: any = null;
let SettingsIcon: any = null;
try {
  const lucide = require("lucide-react-native");
  CameraIcon = lucide.Camera;
  SettingsIcon = lucide.Settings;
} catch {
  // Icon not available, will use text fallback
}

type ScreenState = "home" | "create-mode" | "create-rounds" | "create-settings" | "create-duration" | "join";

const MODE_COLORS = {
  Photo: "#f97316", // Orange (unchanged)
  Video: "#a855f7", // Purple (was Mix color)
  Mix: "#3b82f6", // Blue (was Video color)
  Blind: "#ef4444", // Red
  TimeMachine: "#14b8a6", // Teal
  SlowReveal: "#6366f1", // Indigo
  Caption: "#ec4899", // Pink
};

type CreateMode = keyof typeof MODE_COLORS;

const ROUND_OPTIONS = [10, 25, 50, 100];

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { joinPin } = useLocalSearchParams<{ joinPin?: string }>();
  const { username, setUsername, isLoading } = useUsername();
  const { saveSettings } = useGameSettings();
  const { connect, createGame, joinGame, leaveGame, isConnected, connectionFailed } = useSocket();

  const [screenState, setScreenState] = useState<ScreenState>("home");
  const [selectedMode, setSelectedMode] = useState<CreateMode>("Photo");
  const [rounds, setRounds] = useState(10);
  const [timer, setTimer] = useState(5);
  const [playVideoWithSound, setPlayVideoWithSound] = useState(true);
  const [pin, setPin] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [showMediaError, setShowMediaError] = useState(false);
  const [mediaAccessLimited, setMediaAccessLimited] = useState(false);
  const [showPermissionInfo, setShowPermissionInfo] = useState(false);
  const permissionInfoResolve = useRef<(() => void) | null>(null);
  const [mediaErrorText, setMediaErrorText] = useState("");
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [hasJoinError, setHasJoinError] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const hasAutoJoinedRef = useRef(false);

  // Animation refs
  const logoAnim = useRef(createSpringAnimation(0)).current;
  const inputAnim = useRef(createSpringAnimation(0)).current;
  const buttonsAnim = useRef(createSpringAnimation(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const inputShakeAnim = useRef(new Animated.Value(0)).current;

  // Connect socket on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Opened from a lobby QR code (mediaroulette://join?pin=...): prefill the join form.
  useEffect(() => {
    if (joinPin && /^\d{6}$/.test(joinPin)) {
      setPin(joinPin);
      setScreenState("join");
    }
  }, [joinPin]);

  // Listen for connection errors
  useEffect(() => {
    if (connectionFailed) {
      setShowConnectionError(true);
    }
  }, [connectionFailed]);

  // Animate logo and input on mount
  useEffect(() => {
    if (!isLoading) {
      setTimeout(() => logoAnim.appear(), 100);
      setTimeout(() => inputAnim.appear(), 200);
      setTimeout(() => buttonsAnim.appear(), 300);
    }
  }, [isLoading, logoAnim, inputAnim, buttonsAnim]);

  // Keyboard visibility listeners
  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
      if (screenState === "join") {
        Animated.spring(logoScale, {
          toValue: 0.7,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      if (screenState === "join") {
        Animated.spring(logoScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      } else {
        // Reset logo scale when not in join screen
        logoScale.setValue(1);
      }
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [logoScale, screenState]);

  // Reset logo scale when leaving join screen
  useEffect(() => {
    if (screenState !== "join") {
      logoScale.setValue(1);
      setKeyboardVisible(false);
    }
  }, [screenState, logoScale]);

  const isUsernameValid = username.trim().length > 0;
  const currentColor = MODE_COLORS[selectedMode];

  // Buttons spring in after each step change: a tap during that animation can
  // land on the background, which means "go back". Ignore those taps.
  const lastStepChange = useRef(0);
  useEffect(() => {
    lastStepChange.current = Date.now();
  }, [screenState]);

  const handleBackgroundPress = useCallback(() => {
    if (Date.now() - lastStepChange.current < 800) return;
    if (screenState === "create-mode") {
      setScreenState("home");
    } else if (screenState === "create-rounds") {
      setScreenState("create-mode");
    } else if (screenState === "create-settings") {
      // Video mode skips the rounds step entirely, so back from settings
      // should return to mode selection rather than the hidden rounds screen.
      setScreenState(selectedMode === "Video" ? "create-mode" : "create-rounds");
    } else if (screenState === "create-duration") {
      setScreenState("create-settings");
    } else if (screenState === "join") {
      setScreenState("home");
    }
  }, [screenState, selectedMode]);

  useEffect(() => {
    const onBackPress = () => {
      if (screenState !== "home") {
        handleBackgroundPress();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [screenState, handleBackgroundPress]);

  const handleCreateGame = () => {
    if (isUsernameValid) {
      setScreenState("create-mode");
    }
  };

  const handleModeSelect = (mode: CreateMode) => {
    setSelectedMode(mode);
    // Video mode has a fixed round count of 10 because processing videos is
    // already heavy; skip the rounds picker and go straight to settings.
    if (mode === "Video") {
      setRounds(10);
      setScreenState("create-settings");
      return;
    }
    setScreenState("create-rounds");
  };

  const handleRoundsSelect = (roundsValue: number) => {
    setRounds(roundsValue);
    // Caption mode has no answer timer (writing and voting are timed by the server).
    if (selectedMode === "Caption") {
      handleSettingsConfirm(5, roundsValue);
      return;
    }
    setScreenState("create-settings");
  };

  // `selectedTimer` is passed explicitly: reading the `timer` state here would
  // return the value from the render in which the button was pressed.
  /**
   * The first time, explain what happens with the player's photos before the
   * system permission prompt appears.
   */
  const explainPermissionIfNeeded = async () => {
    const { status } = await getPermissionsAsync();
    if (status !== "undetermined") return;
    await new Promise<void>((resolve) => {
      permissionInfoResolve.current = resolve;
      setShowPermissionInfo(true);
    });
  };

  const closePermissionInfo = () => {
    setShowPermissionInfo(false);
    permissionInfoResolve.current?.();
    permissionInfoResolve.current = null;
  };

  const handleSettingsConfirm = async (selectedTimer: number, roundsOverride?: number) => {
    // Blind, Time Machine, Slow Reveal and Caption are photo games with an extra rule.
    const isPhotoVariant =
      selectedMode === "Blind" || selectedMode === "TimeMachine" || selectedMode === "SlowReveal" || selectedMode === "Caption";
    const settings: any = {
      rounds: roundsOverride ?? rounds,
      timer: selectedTimer,
      mode: isPhotoVariant ? "Photo" : selectedMode,
      playVideoWithSound: (selectedMode === "Video" || selectedMode === "Mix") ? playVideoWithSound : undefined,
      blindMode: selectedMode === "Blind",
      timeMachine: selectedMode === "TimeMachine",
      slowReveal: selectedMode === "SlowReveal",
      captionMode: selectedMode === "Caption",
    };
    const mediaMode = isPhotoVariant && selectedMode !== "Blind" ? "Photo" : selectedMode;

    // Check media availability before creating game
    await explainPermissionIfNeeded();
    const mediaCheck = await checkMediaAvailability(mediaMode);

    if (!mediaCheck.hasEnough) {
      const required = mediaMode === "Photo" || mediaMode === "Blind"
        ? `• ${mediaCheck.requiredPhotos} photos`
        : mediaMode === "Video"
          ? `• ${mediaCheck.requiredVideos} videos`
          : `• ${mediaCheck.requiredPhotos} photos\n• ${mediaCheck.requiredVideos} videos`;

      const available = mediaMode === "Photo" || mediaMode === "Blind"
        ? `• ${mediaCheck.photoCount} photos`
        : mediaMode === "Video"
          ? `• ${mediaCheck.videoCount} videos`
          : `• ${mediaCheck.photoCount} photos\n• ${mediaCheck.videoCount} videos`;

      setMediaErrorText(t("common.notEnoughMediaForMode", { required, available }));
      setMediaAccessLimited(mediaCheck.limitedAccess);
      setShowMediaError(true);
      return;
    }

    saveSettings(settings);
    setIsCreatingGame(true);

    const gamePin = await createGame(username || "Player", settings);

    if (gamePin) {
      setIsCreatingGame(false);
      router.push({
        pathname: "/lobby",
        params: { isHost: "true", pin: gamePin },
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

  const handleJoin = async (pinOverride?: string) => {
    const pinToUse = pinOverride || pin;
    if (pinToUse.trim().length === 6 && /^\d{6}$/.test(pinToUse) && !isJoining && isConnected) {
      setIsJoining(true);
      setJoinError("");
      hasAutoJoinedRef.current = true;

      // First join the game to get room settings
      const success = await joinGame(pinToUse.trim(), username || "Player");
      if (success) {
        // Read the room from the store: the `room` captured by this render is
        // still the pre-join value.
        const joinedRoom = useSocket.getState().room;
        const roomMode = joinedRoom?.settings?.mode || "Photo";
        const blindMode = joinedRoom?.settings?.blindMode || false;
        const modeToCheck = blindMode ? "Blind" : (roomMode === "Photo" ? "Photo" : roomMode === "Video" ? "Video" : "Mix");

        // Check media availability
        await explainPermissionIfNeeded();
        const mediaCheck = await checkMediaAvailability(modeToCheck);

        if (!mediaCheck.hasEnough) {
          const required = modeToCheck === "Photo" || modeToCheck === "Blind"
            ? `• ${mediaCheck.requiredPhotos} photos`
            : modeToCheck === "Video"
              ? `• ${mediaCheck.requiredVideos} videos`
              : `• ${mediaCheck.requiredPhotos} photos\n• ${mediaCheck.requiredVideos} videos`;

          const available = modeToCheck === "Photo" || modeToCheck === "Blind"
            ? `• ${mediaCheck.photoCount} photos`
            : modeToCheck === "Video"
              ? `• ${mediaCheck.videoCount} videos`
              : `• ${mediaCheck.photoCount} photos\n• ${mediaCheck.videoCount} videos`;

          // We're already in the room on the server: leave it so we don't
          // block the lobby as a player who can never become ready.
          await leaveGame(pinToUse.trim());
          setMediaErrorText(t("common.notEnoughMediaForMode", { required, available }));
          setMediaAccessLimited(mediaCheck.limitedAccess);
          setShowMediaError(true);
          setIsJoining(false);
          hasAutoJoinedRef.current = false;
          return;
        }

        setIsJoining(false);
        router.push({
          pathname: "/lobby",
          params: { isHost: "false", pin: pinToUse.trim() },
        });
      } else {
        setIsJoining(false);
        hasAutoJoinedRef.current = false;
        // Show error feedback: vibrate and highlight input
        setHasJoinError(true);
        // Vibrate on error
        Vibration.vibrate(200);

        // Shake animation
        inputShakeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(inputShakeAnim, {
            toValue: 10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(inputShakeAnim, {
            toValue: -10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(inputShakeAnim, {
            toValue: 10,
            duration: 50,
            useNativeDriver: true,
          }),
          Animated.timing(inputShakeAnim, {
            toValue: 0,
            duration: 50,
            useNativeDriver: true,
          }),
        ]).start();

        // Clear error after animation
        setTimeout(() => {
          setHasJoinError(false);
        }, 2000);
      }
    }
  };

  const handleQRScan = (scannedPin: string) => {
    setPin(scannedPin);
    setShowScanner(false);
    // Auto-join immediately after scanning
    if (scannedPin.length === 6 && /^\d{6}$/.test(scannedPin)) {
      handleJoin(scannedPin);
    }
  };

  const isValidPIN = pin.trim().length === 6 && /^\d{6}$/.test(pin);

  // Auto-join when 6 digits are entered (instant, no delay)
  useEffect(() => {
    if (screenState === "join" && isValidPIN && !isJoining && isConnected && pin.length === 6 && !hasAutoJoinedRef.current) {
      handleJoin(pin);
    }
    // Reset the ref when PIN changes
    if (pin.length < 6) {
      hasAutoJoinedRef.current = false;
      setHasJoinError(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, isConnected, screenState]); // Only trigger on pin, connection, or screen state change

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
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                if (screenState !== "home") handleBackgroundPress();
              }}
            >
              {/* Settings button */}
              {screenState === "home" && (
                <View className="absolute right-6 z-20" style={{ top: insets.top + 8 }}>
                  <TouchableOpacity
                    onPress={() => router.push("/settings")}
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.title")}
                    className="w-10 h-10 rounded-full bg-black/60 border border-gray-800 items-center justify-center"
                  >
                    {SettingsIcon ? (
                      <SettingsIcon size={20} color="#ffffff" />
                    ) : (
                      <Text className="text-white text-lg">⚙️</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {/* Logo */}
              <Animated.View
                style={{
                  transform: screenState === "join"
                    ? [{ scale: Animated.multiply(logoAnim.scale, logoScale) }]
                    : [{ scale: logoAnim.scale }],
                  opacity: logoAnim.opacity,
                }}
                className="pt-12 items-center mb-8"
              >
                <AnimatedLogo
                  targetMode={
                    screenState === "home" || screenState === "join" || screenState === "create-mode" ? "initial" :
                      selectedMode
                  }
                  size={screenState === "join" && keyboardVisible ? 120 : 200}
                />
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
                        maxLength={MAX_USERNAME_LENGTH}
                        autoCorrect={false}
                        autoCapitalize="words"
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
                  <View pointerEvents="auto">
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
                    <WiggleButton
                      title={t("gameSettings.timeMachine")}
                      onPress={() => handleModeSelect("TimeMachine")}
                      color={MODE_COLORS.TimeMachine}
                      visible={true}
                    />
                    <WiggleButton
                      title={t("gameSettings.slowReveal")}
                      onPress={() => handleModeSelect("SlowReveal")}
                      color={MODE_COLORS.SlowReveal}
                      visible={true}
                    />
                    <WiggleButton
                      title={t("gameSettings.captionMode")}
                      onPress={() => handleModeSelect("Caption")}
                      color={MODE_COLORS.Caption}
                      visible={true}
                    />
                  </View>
                )}

                {/* Create Rounds Selection */}
                {screenState === "create-rounds" && (
                  <View pointerEvents="auto">
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
                  <View pointerEvents="auto">
                    {(selectedMode === "Video" || selectedMode === "Mix") ? (
                      <>
                        <Text className="text-white text-3xl font-bold text-center mb-8">
                          {t("gameSettings.playVideoWithSound")}
                        </Text>
                        {/* Sound toggle – only flips the value, does NOT advance, so the user can pick. */}
                        <WiggleButton
                          title={playVideoWithSound ? t("gameSettings.withSound") : t("gameSettings.withoutSound")}
                          onPress={() => setPlayVideoWithSound(!playVideoWithSound)}
                          color={currentColor}
                          visible={true}
                        />
                        <WiggleButton
                          title={t("common.continue")}
                          onPress={() => setScreenState("create-duration")}
                          color={currentColor}
                          visible={true}
                        />
                      </>
                    ) : (
                      <>
                        <Text className="text-white text-3xl font-bold text-center mb-8">
                          {t("gameSettings.roundDuration")}
                        </Text>
                        {[5, 6, 8, 10].map((seconds) => (
                          <WiggleButton
                            key={seconds}
                            title={`${seconds} ${t("gameSettings.seconds")}`}
                            onPress={() => {
                              setTimer(seconds);
                              // Auto-continue when timer is selected
                              setTimeout(() => {
                                handleSettingsConfirm(seconds);
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
                  <View pointerEvents="auto">
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
                            handleSettingsConfirm(seconds);
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
                  <View pointerEvents="auto">
                    <Text className="text-white text-3xl font-bold text-center mb-8">
                      {t("join.title")}
                    </Text>

                    <Animated.View
                      style={{
                        transform: [{ translateX: inputShakeAnim }],
                      }}
                    >
                      <View className="relative mb-6">
                        <Input
                          value={pin}
                          onChangeText={(text) => {
                            const digitsOnly = text.replace(/\D/g, "").slice(0, 6);
                            setPin(digitsOnly);
                            setHasJoinError(false);
                          }}
                          placeholder={t("join.pinPlaceholder")}
                          autoFocus
                          keyboardType="number-pad"
                          error={hasJoinError ? " " : undefined}
                        />
                        <TouchableOpacity
                          onPress={() => setShowScanner(true)}
                          accessibilityRole="button"
                          accessibilityLabel={t("join.scanQr", { defaultValue: "Scan QR code" })}
                          disabled={!isConnected}
                          className="absolute right-3 top-3 p-2 items-center justify-center"
                          activeOpacity={0.7}
                        >
                          <View className="items-center justify-center">
                            {CameraIcon ? (
                              <CameraIcon size={24} color="#ffffff" />
                            ) : (
                              <Text className="text-2xl">📷</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    </Animated.View>

                    <WiggleButton
                      title={isJoining ? t("join.joining") : t("home.joinGame")}
                      onPress={() => handleJoin()}
                      color="#3b82f6"
                      disabled={!isValidPIN || isJoining || !isConnected}
                      visible={true}
                    />
                  </View>
                )}
              </View>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />

      {/* Media Error Dialog */}
      <CustomModal
        visible={showMediaError}
        onClose={() => setShowMediaError(false)}
        title={t("common.insufficientMedia")}
        showCloseButton={true}
      >
        <Text className="text-white text-base mb-4 whitespace-pre-line">
          {mediaErrorText}
        </Text>
        {mediaAccessLimited && (
          <View className="mb-3">
            <Text className="text-gray-300 text-sm mb-3">{t("permissionInfo.limitedAccess")}</Text>
            <Button
              title={t("permissionInfo.chooseMore")}
              onPress={() => {
                setShowMediaError(false);
                presentPermissionsPicker().catch(() => {});
              }}
              variant="secondary"
            />
          </View>
        )}
        <Button
          title={t("common.close")}
          onPress={() => setShowMediaError(false)}
          variant="primary"
        />
      </CustomModal>

      {/* Shown once, before the system photo permission prompt */}
      <CustomModal
        visible={showPermissionInfo}
        onClose={closePermissionInfo}
        title={t("permissionInfo.title")}
        showCloseButton={false}
      >
        <View className="gap-3 mb-5">
          <Text className="text-white text-base">• {t("permissionInfo.point1")}</Text>
          <Text className="text-white text-base">• {t("permissionInfo.point2")}</Text>
          <Text className="text-white text-base">• {t("permissionInfo.point3")}</Text>
          <Text className="text-white text-base">• {t("permissionInfo.point4")}</Text>
        </View>
        <Button title={t("common.continue")} onPress={closePermissionInfo} variant="primary" />
      </CustomModal>

      {/* Connection Error Dialog */}
      <CustomModal
        visible={showConnectionError}
        onClose={() => setShowConnectionError(false)}
        title={t("common.connectionError")}
        showCloseButton={true}
      >
        <Text className="text-white text-base mb-4">
          {t("common.connectionFailed")}
        </Text>
        <Button
          title={t("common.retry")}
          onPress={() => {
            setShowConnectionError(false);
            connect();
          }}
          variant="primary"
        />
        <View className="mt-3">
          <Button
            title={t("common.close")}
            onPress={() => setShowConnectionError(false)}
            variant="secondary"
          />
        </View>
      </CustomModal>
      </View>
    );
}
