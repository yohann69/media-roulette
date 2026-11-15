import { View, Text, Pressable } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { CountdownTimer } from "../molecules/CountdownTimer";
import { MediaDisplay } from "../molecules/MediaDisplay";
import { PlayerSelection } from "../molecules/PlayerSelection";
import { YearPicker } from "../molecules/YearPicker";
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
  /** Slow Reveal round: the photo starts pixelated and sharpens as time runs out. */
  slowReveal?: boolean;
  /** Time Machine: years to pick from, the year picked, and the handler. */
  yearRange?: { min: number; max: number } | null;
  selectedYear?: number | null;
  onYearSelect?: (year: number) => void;
}

/**
 * Slow Reveal: block sizes (in points) the photo goes through, from very coarse
 * to sharp, reached at SHARP_AT of the round.
 */
const SLOW_REVEAL_STEPS = [48, 32, 24, 16, 12, 8, 5, 3, 1];
const SLOW_REVEAL_SHARP_AT = 0.8;

/** Current block size for a Slow Reveal round (undefined in normal rounds). */
function useSlowRevealPixelSize(enabled: boolean, running: boolean, durationSeconds: number, roundKey: string) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [enabled, roundKey]);

  useEffect(() => {
    if (!enabled || !running) return;
    const startedAt = Date.now();
    const stepMs = Math.max(1, (durationSeconds * 1000 * SLOW_REVEAL_SHARP_AT) / (SLOW_REVEAL_STEPS.length - 1));
    const timer = setInterval(() => {
      const next = Math.min(SLOW_REVEAL_STEPS.length - 1, Math.floor((Date.now() - startedAt) / stepMs));
      setStep(next);
      if (next >= SLOW_REVEAL_STEPS.length - 1) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [enabled, running, durationSeconds, roundKey]);

  return enabled ? SLOW_REVEAL_STEPS[step] : undefined;
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
  slowReveal = false,
  yearRange,
  selectedYear = null,
  onYearSelect,
}: RevealViewProps) {
  const { t } = useTranslation();
  const roundKey = `${currentRound}-${currentMedia?.id}`;
  const pixelSize = useSlowRevealPixelSize(slowReveal, timerActive, timerDuration, roundKey);
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
      {/* Blurred background (hidden in Slow Reveal rounds: it would give the photo away) */}
      {currentMedia && !slowReveal && <MediaDisplay media={currentMedia} showAsBackground />}
      
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
            {slowReveal && (
              <Text className="text-amber-300 text-sm font-semibold mb-3" accessibilityLiveRegion="polite">
                {t("game.slowReveal")}
              </Text>
            )}
            <CountdownTimer
              duration={timerDuration}
              onComplete={onTimeExpired}
              isActive={timerActive}
              roundKey={roundKey}
            />
          </View>

          {/* Center: Media display */}
          <View className="items-center justify-center flex-1">
            {currentMedia && (
              <Pressable onLongPress={onMediaLongPress} delayLongPress={700} accessible={false}>
                <MediaDisplay
                  media={currentMedia}
                  playVideoWithSound={playVideoWithSound}
                  onReady={onMediaShown}
                  pixelSize={pixelSize}
                />
              </Pressable>
            )}
          </View>

          {/* Bottom: Player selection - always at bottom */}
          <View className="pb-4">
            {yearRange && onYearSelect && (
              <YearPicker
                min={yearRange.min}
                max={yearRange.max}
                selected={selectedYear}
                disabled={disabled}
                onSelect={onYearSelect}
              />
            )}
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
