import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { Input } from "../components/atoms/Input";
import { Button } from "../components/atoms/Button";
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

  useEffect(() => {
    connect();
  }, [connect]);

  const handleJoin = async () => {
    if (pin.trim().length === 6 && /^\d{6}$/.test(pin)) {
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
  };

  const isValidPIN = pin.trim().length === 6 && /^\d{6}$/.test(pin);

  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
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
        />

        <View className="mt-4">
          <Button
            title={t("join.scanQR")}
            onPress={() => setShowScanner(true)}
            variant="secondary"
            disabled={!isConnected}
          />
        </View>
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800 bg-black">
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

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
    </View>
  );
}
