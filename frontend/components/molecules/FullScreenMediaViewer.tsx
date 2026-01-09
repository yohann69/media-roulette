import { Modal, View, Image, TouchableOpacity } from "react-native";
import { Video } from "expo-av";
import { useRef, useEffect } from "react";

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

export function FullScreenMediaViewer({
  visible,
  media,
  onClose,
}: FullScreenMediaViewerProps) {
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    const playVideo = async () => {
      try {
        if (visible && media?.mediaType === "video" && videoRef.current) {
          await videoRef.current.playAsync();
        }
      } catch {
        // Ignore playback errors
      }
    };

    playVideo();

    return () => {
      const cleanup = async () => {
        if (!videoRef.current) return;
        try {
          await videoRef.current.pauseAsync();
        } catch {
          // ignore
        }
        try {
          await videoRef.current.unloadAsync();
        } catch {
          // ignore
        }
      };
      cleanup();
    };
  }, [visible, media]);

  if (!media) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/95 items-center justify-center"
      >
        {media.mediaType === "photo" ? (
          <Image
            source={{ uri: media.uri }}
            className="w-full h-full"
            resizeMode="contain"
          />
        ) : (
          <Video
            ref={videoRef}
            source={{ uri: media.uri }}
            className="w-full h-full"
            resizeMode="contain"
            shouldPlay={true}
            isLooping
            isMuted={false}
          />
        )}
      </TouchableOpacity>
    </Modal>
  );
}

