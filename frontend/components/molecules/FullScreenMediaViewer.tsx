import { Modal, View, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import { useRef, useEffect, useState } from "react";

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
  // Resolved playable URI for videos – on iOS the raw `ph://` asset URI
  // from MediaLibrary cannot be played by expo-av; we need the file:// path
  // returned by getAssetInfoAsync.
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!visible || !media || media.mediaType !== "video") {
        setVideoUri(null);
        return;
      }
      setResolving(true);
      try {
        const info = await MediaLibrary.getAssetInfoAsync(media.id);
        if (cancelled) return;
        setVideoUri(info.localUri || media.uri);
      } catch {
        if (!cancelled) setVideoUri(media.uri);
      } finally {
        if (!cancelled) setResolving(false);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [visible, media]);

  useEffect(() => {
    const playVideo = async () => {
      try {
        if (visible && media?.mediaType === "video" && videoUri && videoRef.current) {
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
  }, [visible, media, videoUri]);

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
        ) : videoUri ? (
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={true}
            isLooping
            isMuted={false}
          />
        ) : (
          <ActivityIndicator size="large" color="#ffffff" />
        )}
      </TouchableOpacity>
    </Modal>
  );
}
