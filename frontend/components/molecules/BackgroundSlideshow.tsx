import { View, Image, Animated, StyleSheet } from "react-native";
import { useEffect, useRef, useState } from "react";
import * as MediaLibrary from "expo-media-library";

interface BackgroundSlideshowProps {
  imageCount?: number;
  transitionDuration?: number;
  displayDuration?: number;
}

export function BackgroundSlideshow({
  imageCount = 10,
  transitionDuration = 2000,
  displayDuration = 10000, // 10 seconds per image
}: BackgroundSlideshowProps) {
  const [images, setImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const fadeAnim1 = useRef(new Animated.Value(1)).current; // Current image
  const fadeAnim2 = useRef(new Animated.Value(0)).current; // Next image
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Fetch random photos from camera/dcim folder
  useEffect(() => {
    const fetchBackgroundImages = async () => {
      try {
        // Request permission
        const { status } = await MediaLibrary.getPermissionsAsync();
        if (status !== "granted") {
          const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
          if (newStatus !== "granted") {
            return;
          }
        }
        setPermissionGranted(true);

        // Get all albums
        const albums = await MediaLibrary.getAlbumsAsync();
        
        // Find camera/dcim album
        const cameraAlbum = albums.find(
          (album) =>
            album.title.toLowerCase().includes("camera") ||
            album.title.toLowerCase().includes("dcim") ||
            album.title.toLowerCase().includes("photos")
        );

        // Fetch photos from camera album or all photos
        const fetchOptions: MediaLibrary.AssetsOptions = {
          mediaType: MediaLibrary.MediaType.photo,
          first: 500, // Fetch more to get good variety
          sortBy: MediaLibrary.SortBy.creationTime,
        };

        if (cameraAlbum) {
          const albumAssets = await MediaLibrary.getAssetsAsync({
            ...fetchOptions,
            album: cameraAlbum,
          });
          
          // Shuffle and select random images
          const shuffled = [...albumAssets.assets].sort(() => Math.random() - 0.5);
          const selected = shuffled.slice(0, imageCount);
          
          // Use asset URI directly - no need for getAssetInfoAsync which requires ACCESS_MEDIA_LOCATION
          const imageUris = selected.map((asset) => asset.uri).filter(Boolean);
          
          setImages(imageUris as string[]);
        } else {
          // Fallback: get all photos and filter by filename/path
          const allPhotos = await MediaLibrary.getAssetsAsync(fetchOptions);
          
          // Filter for camera/dcim photos (check URI)
          const cameraPhotos = allPhotos.assets.filter((asset) => {
            const uri = asset.uri.toLowerCase();
            return uri.includes("dcim") || uri.includes("camera") || uri.includes("100media");
          });
          
          const shuffled = [...cameraPhotos].sort(() => Math.random() - 0.5);
          const selected = shuffled.slice(0, imageCount);
          
          // Use asset URI directly - no need for getAssetInfoAsync which requires ACCESS_MEDIA_LOCATION
          const imageUris = selected.map((asset) => asset.uri).filter(Boolean);
          
          setImages(imageUris as string[]);
        }
      } catch (error) {
        console.error("Error fetching background images:", error);
      }
    };

    fetchBackgroundImages();
  }, [imageCount]);

  // Auto-advance slideshow with crossfade
  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      const newNextIndex = (currentIndex + 1) % images.length;
      setNextIndex(newNextIndex);
      
      // Crossfade: fade out current, fade in next simultaneously
      Animated.parallel([
        Animated.timing(fadeAnim1, {
          toValue: 0,
          duration: transitionDuration,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim2, {
          toValue: 1,
          duration: transitionDuration,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Swap: next becomes current, reset animations
        setCurrentIndex(newNextIndex);
        fadeAnim1.setValue(1);
        fadeAnim2.setValue(0);
      });
    }, displayDuration);

    return () => clearInterval(interval);
  }, [images, currentIndex, fadeAnim1, fadeAnim2, displayDuration, transitionDuration]);

  if (images.length === 0) {
    return <View style={StyleSheet.absoluteFillObject} className="bg-black" />;
  }

  const currentImage = images[currentIndex];
  const nextImage = images[nextIndex];

  return (
    <View style={StyleSheet.absoluteFillObject} className="bg-black">
      {/* Current image */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: fadeAnim1,
          },
        ]}
      >
        <Image
          source={{ uri: currentImage }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          blurRadius={20}
        />
      </Animated.View>
      
      {/* Next image (for crossfade) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            opacity: fadeAnim2,
          },
        ]}
      >
        <Image
          source={{ uri: nextImage }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          blurRadius={20}
        />
      </Animated.View>
      
      {/* Dark overlay - constant, not animated - slightly less darkened */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(0, 0, 0, 0.88)" },
        ]}
      />
    </View>
  );
}

