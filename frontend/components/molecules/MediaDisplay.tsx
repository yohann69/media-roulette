import { View, useWindowDimensions, Animated, StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";

interface MediaItem {
  id: string;
  uri?: string;
  base64?: string;
  mediaType: "photo" | "video";
  width?: number;
  height?: number;
}

interface MediaDisplayProps {
  media: MediaItem;
  showAsBackground?: boolean;
  playVideoWithSound?: boolean;
}

function getSourceUri(media: MediaItem): string | null {
  if (media.base64) return `data:image/jpeg;base64,${media.base64}`;
  return media.uri ?? null;
}

function GameVideo({ uri, width, height, muted }: { uri: string; width: number; height: number; muted: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = muted;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);

  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export function MediaDisplay({ media, showAsBackground = false, playVideoWithSound = true }: MediaDisplayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = useWindowDimensions();
  const [aspectRatio, setAspectRatio] = useState<number>(
    media.width && media.height ? media.width / media.height : 1
  );
  const uri = getSourceUri(media);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [media.id, fadeAnim]);

  useEffect(() => {
    if (media.width && media.height) setAspectRatio(media.width / media.height);
  }, [media.id, media.width, media.height]);

  // Portrait media is framed 3:4, landscape (and square) 4:3.
  const targetAspectRatio = aspectRatio < 1 ? 3 / 4 : 4 / 3;
  const displayWidth = screenWidth - 48;
  const displayHeight = displayWidth / targetAspectRatio;

  if (showAsBackground) {
    // Videos have no still frame to blur; the dark screen background is used instead.
    if (!uri || media.mediaType !== "photo") return null;
    return (
      <View style={StyleSheet.absoluteFill}>
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: 0.3 }]}
          contentFit="cover"
          blurRadius={20}
          transition={0}
        />
      </View>
    );
  }

  return (
    <Animated.View style={{ opacity: fadeAnim }} className="mb-6">
      <View
        className="rounded-2xl overflow-hidden bg-gray-900"
        style={{ width: displayWidth, height: displayHeight }}
      >
        {uri && media.mediaType === "photo" && (
          <Image
            source={{ uri }}
            style={{ width: displayWidth, height: displayHeight }}
            contentFit="cover"
            transition={0}
            onLoad={(event) => {
              const { width, height } = event.source;
              if (width && height) setAspectRatio(width / height);
            }}
          />
        )}
        {uri && media.mediaType === "video" && (
          <GameVideo
            key={media.id}
            uri={uri}
            width={displayWidth}
            height={displayHeight}
            muted={!playVideoWithSound}
          />
        )}
      </View>
    </Animated.View>
  );
}
