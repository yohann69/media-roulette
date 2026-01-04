import { View, Text, ScrollView, TouchableOpacity, BackHandler, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { Input } from "../components/atoms/Input";
import { Button } from "../components/atoms/Button";
import { BackgroundSlideshow } from "../components/molecules/BackgroundSlideshow";
import { QRScanner } from "../components/molecules/QRScanner";
import { CustomModal } from "../components/molecules/Modal";
import { SelectionScreen } from "../features/selection/SelectionScreen";
import { useSocket } from "../stores/useSocket";
import { useUsername } from "../hooks/useUsername";
import { useTranslation } from "../hooks/useTranslation";
import { checkMediaAvailability } from "../utils/checkMediaAvailability";

export default function JoinScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { username } = useUsername();
  const { connect, joinGame, isConnected, connectionFailed, room } = useSocket();
  const [pin, setPin] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const hasAutoJoinedRef = useRef(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [showMediaError, setShowMediaError] = useState(false);
  const [mediaErrorText, setMediaErrorText] = useState("");
  const [showConnectionError, setShowConnectionError] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  // Listen for connection errors
  useEffect(() => {
    if (connectionFailed) {
      setShowConnectionError(true);
    }
  }, [connectionFailed]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      router.push("/");
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [router]);

  const handleJoin = async () => {
    if (pin.trim().length === 6 && /^\d{6}$/.test(pin) && !isJoining && isConnected) {
      setIsJoining(true);
      setJoinError("");
      hasAutoJoinedRef.current = true;

      const success = await joinGame(pin.trim(), username || "Player");

      if (success) {
        // Get the room mode from socket store
        const roomMode = room?.settings?.mode || "Photo";
        const blindMode = room?.settings?.blindMode || false;
        const modeToCheck = blindMode ? "Blind" : (roomMode === "Photo" ? "Photo" : roomMode === "Video" ? "Video" : "Mix");
        
        // Check media availability
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
          
          setMediaErrorText(t("common.notEnoughMediaForMode", { required, available }));
          setShowMediaError(true);
          setIsJoining(false);
          hasAutoJoinedRef.current = false;
          return;
        }
        
        setShowSelectionModal(true);
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
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <Pressable style={{ flex: 1, padding: 24, paddingTop: 44 }} onPress={() => router.push("/")}>
        <Text className="text-white text-3xl font-bold mb-2 text-center">
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

         <View className="relative" pointerEvents="box-none">
           <View pointerEvents="auto">
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
         </View>
         </Pressable>
        </ScrollView>

         <View className="px-6 py-3 pb-8 border-t border-gray-800 bg-black/80" pointerEvents="box-none">
           <View pointerEvents="auto">
             <Button
               title={isJoining ? t("join.joining") : t("join.join")}
               onPress={handleJoin}
               disabled={!isValidPIN || isJoining || !isConnected}
               variant="primary"
             />
           </View>
         </View>
      </View>

      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />

      {/* Media Selection Modal */}
      {pin && (
        <CustomModal
          visible={showSelectionModal}
          onClose={() => {
            setShowSelectionModal(false);
            setIsJoining(false);
            hasAutoJoinedRef.current = false;
          }}
          title={t("selection.title")}
          showCloseButton={true}
        >
          <View style={{ maxHeight: 600 }}>
            <SelectionScreen
              isHost="false"
              pin={pin.trim()}
              onClose={() => {
                setShowSelectionModal(false);
                setIsJoining(false);
                hasAutoJoinedRef.current = false;
              }}
            />
          </View>
        </CustomModal>
      )}

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
        <Button
          title={t("common.close")}
          onPress={() => setShowMediaError(false)}
          variant="primary"
        />
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
