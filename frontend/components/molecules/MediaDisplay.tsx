import { View, Image, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { Video, ResizeMode } from "expo-av";

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

export function MediaDisplay({ media, showAsBackground = false, playVideoWithSound = true }: MediaDisplayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<Video>(null);
  const { width: screenWidth } = useWindowDimensions();
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1);

  const imageSource = media.base64
    ? { uri: `data:image/jpeg;base64,${media.base64}` }
    : media.uri
    ? { uri: media.uri }
    : null;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [media.id, fadeAnim]);

  // Cleanup video on unmount or media change
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync().catch(() => {
          // Ignore cleanup errors
        });
      }
    };
  }, [media.id]);

  useEffect(() => {
    if (imageSource && media.mediaType === "photo" && !showAsBackground) {
      Image.getSize(
        imageSource.uri,
        (width, height) => {
          setImageDimensions({ width, height });
          // Calculate aspect ratio: width/height
          // If height > width, it's portrait (aspectRatio < 1)
          // If height < width, it's landscape (aspectRatio > 1)
          setAspectRatio(width / height);
        },
        () => {
          // Fallback to provided dimensions or default
          if (media.width && media.height) {
            setAspectRatio(media.width / media.height);
          } else {
            setAspectRatio(1);
          }
        }
      );
    } else if (media.width && media.height) {
      setAspectRatio(media.width / media.height);
    }
  }, [imageSource, media, showAsBackground]);

  // Determine if portrait (height > width) or landscape (height < width)
  // aspectRatio = width/height, so:
  // - If height > width: aspectRatio < 1 (portrait)
  // - If height < width: aspectRatio > 1 (landscape)
  // - If height = width: aspectRatio = 1 (square, treat as landscape)
  const isPortrait = aspectRatio < 1;
  
  // Portrait: 3:4 aspect ratio (width:height = 3:4)
  // Landscape: 4:3 aspect ratio (width:height = 4:3)
  const targetAspectRatio = isPortrait ? 3 / 4 : 4 / 3;
  
  // Calculate display dimensions based on target aspect ratio
  // Ensure the container maintains the correct aspect ratio for cropping
  const maxWidth = screenWidth - 48; // Account for padding
  const displayWidth = maxWidth;
  // Calculate height to maintain target aspect ratio (3:4 for portrait, 4:3 for landscape)
  const displayHeight = displayWidth / targetAspectRatio;

  if (showAsBackground) {
    // Blurred/darkened background version
    return (
      <View className="absolute inset-0">
        {imageSource && (
          <Image
            source={imageSource}
            className="w-full h-full"
            resizeMode="cover"
            blurRadius={20}
            style={{ opacity: 0.3 }}
          />
        )}
      </View>
    );
  }

  return (
    <Animated.View style={{ opacity: fadeAnim }} className="mb-6">
      {media.mediaType === "photo" ? (
        <View 
          className="rounded-2xl overflow-hidden bg-gray-900"
          style={{ width: displayWidth, height: displayHeight }}
        >
          {imageSource && (
            <Image
              source={imageSource}
              style={{ 
                width: displayWidth, 
                height: displayHeight,
                // Ensure image fills container and crops without deformation
              }}
              resizeMode="cover"
            />
          )}
        </View>
      ) : (
        <View 
          className="rounded-2xl overflow-hidden bg-gray-900"
          style={{ width: displayWidth, height: displayHeight }}
        >
          {imageSource ? (
            <Video
              ref={videoRef}
              source={{ uri: imageSource.uri }}
              style={{ width: displayWidth, height: displayHeight }}
              resizeMode={ResizeMode.COVER}
              shouldPlay={true}
              isLooping={true}
              isMuted={!playVideoWithSound}
              volume={playVideoWithSound ? 1.0 : 0.0}
              onLoad={() => {
                // Video loaded, start playing
                videoRef.current?.playAsync();
              }}
            />
          ) : (
            <View className="w-full h-full items-center justify-center">
              <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center">
                <View className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
              </View>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}
