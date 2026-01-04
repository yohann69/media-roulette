import { Modal, View, Image, TouchableOpacity, Text } from "react-native";
import { Video } from "expo-av";
import { useState, useRef, useEffect } from "react";

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
    if (visible && media?.mediaType === "video" && videoRef.current) {
      videoRef.current.playAsync().catch(() => {});
    }
    return () => {
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
      }
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

