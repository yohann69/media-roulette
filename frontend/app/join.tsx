import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { Input } from "../components/atoms/Input";
import { Button } from "../components/atoms/Button";
import { BackButton } from "../components/atoms/BackButton";
import { BackgroundSlideshow } from "../components/molecules/BackgroundSlideshow";
import { QRScanner } from "../components/molecules/QRScanner";
import { useSocket } from "../stores/useSocket";
import { useUsername } from "../hooks/useUsername";
import { useTranslation } from "../hooks/useTranslation";

export default function JoinScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { username } = useUsername();
  const { connect, joinGame, isConnected } = useSocket();
  const [pin, setPin] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const hasAutoJoinedRef = useRef(false);

  useEffect(() => {
    connect();
  }, [connect]);

  const handleJoin = async () => {
    if (pin.trim().length === 6 && /^\d{6}$/.test(pin) && !isJoining && isConnected) {
      setIsJoining(true);
      setJoinError("");
      hasAutoJoinedRef.current = true;

      const success = await joinGame(pin.trim(), username || "Player");

      if (success) {
        router.push({
          pathname: "/selection",
          params: { isHost: "false", pin: pin.trim() }
        });
      } else {
        setIsJoining(false);
        setJoinError(t("join.error"));
        hasAutoJoinedRef.current = false;
      }
    }
  };

  const handleQRScan = (scannedPin: string) => {
    setPin(scannedPin);
    setShowScanner(false);
    // Auto-join after scanning
    if (scannedPin.length === 6 && /^\d{6}$/.test(scannedPin)) {
      setTimeout(() => handleJoin(), 100);
    }
  };

  const isValidPIN = pin.trim().length === 6 && /^\d{6}$/.test(pin);

  // Auto-validate when 6 digits are entered
  useEffect(() => {
    if (isValidPIN && !isJoining && isConnected && pin.length === 6 && !hasAutoJoinedRef.current) {
      const timer = setTimeout(() => {
        handleJoin();
      }, 500); // Small delay to avoid immediate trigger
      return () => clearTimeout(timer);
    }
    // Reset the ref when PIN changes
    if (pin.length < 6) {
      hasAutoJoinedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, isConnected]); // Only trigger on pin or connection change

  return (
    <View className="flex-1 bg-black">
      <BackgroundSlideshow />
      <View className="flex-1" style={{ zIndex: 1 }}>
        <View className="pt-5 px-4">
          <BackButton onPress={() => router.push("/")} />
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 8 }}>
        <Text className="text-white text-3xl font-bold mb-2 text-center">
          {t("join.title")}
        </Text>
        <Text className="text-gray-400 text-center mb-8">
          {t("join.description")}
        </Text>

        {!isConnected && (
          <Text className="text-orange-400 text-sm text-center mb-4">
            {t("common.connecting")}
          </Text>
        )}

        {joinError && (
          <Text className="text-red-400 text-sm text-center mb-4">
            {joinError}
          </Text>
        )}

        <View className="relative">
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
        </ScrollView>

        <View className="px-6 py-3 pb-8 border-t border-gray-800 bg-black/80">
          <Button
            title={isJoining ? t("join.joining") : t("join.join")}
            onPress={handleJoin}
            disabled={!isValidPIN || isJoining || !isConnected}
            variant="primary"
          />
          <View className="mt-3">
            <Button
              title={t("join.backToHome")}
              onPress={() => router.back()}
              variant="secondary"
            />
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
