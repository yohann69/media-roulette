import { View, Animated, StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { getPermissionsAsync } from "expo-media-library";
import { queryCandidates } from "../../utils/fetchRandomMedia";

interface BackgroundSlideshowProps {
  imageCount?: number;
  transitionDuration?: number;
  displayDuration?: number;
}

// The images sit under a heavy blur and a near-opaque overlay, so a small
// decode is visually identical to the full photo and far cheaper.
const BACKGROUND_DECODE_SIZE = 256;

export function BackgroundSlideshow({
  imageCount = 10,
  transitionDuration = 2000,
  displayDuration = 10000,
}: BackgroundSlideshowProps) {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const fadeAnim1 = useRef(new Animated.Value(1)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const fetchBackgroundImages = async () => {
      try {
        // Purely decorative: never prompt for access here. The permission is
        // requested in context, when the player creates or joins a game.
        const { status } = await getPermissionsAsync();
        if (status !== "granted") return;

        const recent = await queryCandidates("photo", 300);
        const selected = [...recent]
          .sort(() => Math.random() - 0.5)
          .slice(0, imageCount)
          .map((asset) => asset.id);
        if (!cancelled) setImages(selected);
      } catch (error) {
        console.error("Error fetching background images:", error);
      }
    };

    fetchBackgroundImages();
    return () => {
      cancelled = true;
    };
  }, [imageCount]);

  // Auto-advance slideshow with crossfade
  useEffect(() => {
    if (images.length < 2) return;

    const interval = setInterval(() => {
      const newNextIndex = (currentIndex + 1) % images.length;
      setNextIndex(newNextIndex);

      Animated.parallel([
        Animated.timing(fadeAnim1, { toValue: 0, duration: transitionDuration, useNativeDriver: true }),
        Animated.timing(fadeAnim2, { toValue: 1, duration: transitionDuration, useNativeDriver: true }),
      ]).start(() => {
        setCurrentIndex(newNextIndex);
        fadeAnim1.setValue(1);
        fadeAnim2.setValue(0);
      });
    }, displayDuration);

    return () => clearInterval(interval);
  }, [images, currentIndex, fadeAnim1, fadeAnim2, displayDuration, transitionDuration]);

  if (images.length === 0) {
    return <View style={StyleSheet.absoluteFill} className="bg-black" />;
  }

  const renderImage = (uri: string) => (
    <Image
      source={{ uri, width: BACKGROUND_DECODE_SIZE, height: BACKGROUND_DECODE_SIZE }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      blurRadius={20}
      cachePolicy="memory"
      transition={0}
    />
  );

  return (
    <View style={StyleSheet.absoluteFill} className="bg-black">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim1 }]}>
        {renderImage(images[currentIndex])}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim2 }]}>
        {renderImage(images[nextIndex % images.length])}
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0, 0, 0, 0.88)" }]} />
    </View>
  );
}
