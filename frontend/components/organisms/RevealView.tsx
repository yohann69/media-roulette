import { View, Text, Pressable } from "react-native";
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
  /** Called once the media is visible: the countdown starts from there. */
  onMediaShown?: () => void;
  /** Long-press on the media (owners use it to hide their own media). */
  onMediaLongPress?: () => void;
  playVideoWithSound?: boolean;
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
  onMediaShown,
  onMediaLongPress,
  playVideoWithSound = true,
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
        <View className="flex-1 justify-between p-6 pt-16">
          {/* Top section: Round info and timer */}
          <View className="items-center">
            <Text className="text-white text-2xl font-bold mb-1">
              {t("game.round", { current: currentRound, total: totalRounds })}
            </Text>
            <Text className="text-gray-300 text-sm mb-4">
              {currentMedia?.mediaType === "video" ? t("game.whoTookVideo") : t("game.whoTookPhoto")}
            </Text>
            <CountdownTimer
              duration={timerDuration}
              onComplete={onTimeExpired}
              isActive={timerActive}
              roundKey={`${currentRound}-${currentMedia?.id}`}
            />
          </View>

          {/* Center: Media display */}
          <View className="items-center justify-center flex-1">
            {currentMedia && (
              <Pressable onLongPress={onMediaLongPress} delayLongPress={700} accessible={false}>
                <MediaDisplay media={currentMedia} playVideoWithSound={playVideoWithSound} onReady={onMediaShown} />
              </Pressable>
            )}
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
