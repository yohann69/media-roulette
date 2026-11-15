import { Modal, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Asset } from "expo-media-library";

interface MediaItem {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
}

interface FullScreenMediaViewerProps {
  visible: boolean;
  media: MediaItem | null;
  onClose: () => void;
}

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />;
}

export function FullScreenMediaViewer({ visible, media, onClose }: FullScreenMediaViewerProps) {
  // Library ids (ph:// on iOS) can't be played directly: resolve a playable file URI.
  const [videoUri, setVideoUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVideoUri(null);
    if (!visible || !media || media.mediaType !== "video") return;

    new Asset(media.id)
      .getUri()
      .then((uri) => !cancelled && setVideoUri(uri))
      .catch(() => !cancelled && setVideoUri(media.uri));

    return () => {
      cancelled = true;
    };
  }, [visible, media]);

  if (!media) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/95 items-center justify-center"
      >
        {media.mediaType === "photo" ? (
          <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : videoUri ? (
          <PreviewVideo uri={videoUri} />
        ) : (
          <ActivityIndicator size="large" color="#ffffff" />
        )}
      </TouchableOpacity>
    </Modal>
  );
}
