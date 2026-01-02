import { View, Image, ActivityIndicator, TouchableOpacity, DimensionValue } from "react-native";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

interface MediaItem {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
}

interface MediaGridProps {
  items: MediaItem[];
  columns?: number;
  onItemPress?: (item: MediaItem) => void;
}

export function MediaGrid({
  items,
  columns = 4,
  onItemPress,
}: MediaGridProps) {
  const itemSize = `${100 / columns}%` as DimensionValue;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [items.length, fadeAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim }} className="flex-row flex-wrap">
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onItemPress?.(item)}
          style={{ width: itemSize, aspectRatio: 1 }}
          className="p-1"
          activeOpacity={0.7}
        >
          <View className="flex-1 bg-gray-800 rounded-lg overflow-hidden">
            {item.mediaType === "photo" ? (
              <Image
                source={{ uri: item.uri }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center bg-gray-900">
                <View className="w-12 h-12 rounded-full bg-secondary items-center justify-center">
                  <View className="w-0 h-0 border-l-[12px] border-l-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1" />
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}
