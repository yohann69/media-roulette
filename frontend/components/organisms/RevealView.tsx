import { View, Text, ScrollView } from "react-native";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { CountdownTimer } from "../molecules/CountdownTimer";
import { MediaDisplay } from "../molecules/MediaDisplay";
import { PlayerSelection } from "../molecules/PlayerSelection";
import { useTranslation } from "../../hooks/useTranslation";

interface Player {
  id: string;
  name: string;
}

interface MediaItem {
  id: string;
  uri?: string;
  base64?: string;
  mediaType: "photo" | "video";
}

interface RevealViewProps {
  currentRound: number;
  totalRounds: number;
  timerDuration: number;
  timerActive: boolean;
  currentMedia: MediaItem | null;
  players: Player[];
  selectedPlayer: string | null;
  disabled: boolean;
  onPlayerSelect: (playerId: string) => void;
  onTimeExpired: () => void;
}

export function RevealView({
  currentRound,
  totalRounds,
  timerDuration,
  timerActive,
  currentMedia,
  players,
  selectedPlayer,
  disabled,
  onPlayerSelect,
  onTimeExpired,
}: RevealViewProps) {
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [currentMedia?.id, fadeAnim]);

  return (
    <View className="flex-1 bg-black">
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <View className="items-center mb-6">
            <Text className="text-white text-2xl font-bold mb-1">
              {t("game.round", { current: currentRound, total: totalRounds })}
            </Text>
            <Text className="text-gray-400 text-sm">{t("game.whoTookPhoto")}</Text>
          </View>

          <CountdownTimer
            duration={timerDuration}
            onComplete={onTimeExpired}
            isActive={timerActive}
          />

          {currentMedia && <MediaDisplay media={currentMedia} />}

          <PlayerSelection
            players={players}
            selectedPlayer={selectedPlayer}
            onSelect={onPlayerSelect}
            disabled={disabled}
          />
        </ScrollView>
      </Animated.View>
    </View>
  );
}
