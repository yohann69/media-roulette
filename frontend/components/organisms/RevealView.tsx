import { View, Text } from "react-native";
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
  width?: number;
  height?: number;
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
      {/* Blurred background */}
      {currentMedia && <MediaDisplay media={currentMedia} showAsBackground />}
      
      <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
        <View className="flex-1 justify-between p-6">
          {/* Top section: Round info and timer */}
          <View className="items-center pt-4">
            <Text className="text-white text-2xl font-bold mb-1">
              {t("game.round", { current: currentRound, total: totalRounds })}
            </Text>
            <Text className="text-gray-300 text-sm mb-4">{t("game.whoTookPhoto")}</Text>
            <CountdownTimer
              duration={timerDuration}
              onComplete={onTimeExpired}
              isActive={timerActive}
            />
          </View>

          {/* Center: Media display */}
          <View className="items-center justify-center flex-1">
            {currentMedia && <MediaDisplay media={currentMedia} />}
          </View>

          {/* Bottom: Player selection - always at bottom */}
          <View className="pb-4">
            <PlayerSelection
              players={players}
              selectedPlayer={selectedPlayer}
              onSelect={onPlayerSelect}
              disabled={disabled}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
