import { View, Image, ActivityIndicator, TouchableOpacity, Pressable, DimensionValue } from "react-native";
import { useEffect, useRef, useState } from "react";
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
  onItemLongPressStart?: (item: MediaItem) => void;
  onItemLongPressEnd?: () => void;
  expectedCount?: number;
}

export function MediaGrid({
  items,
  columns = 4,
  onItemPress,
  onItemLongPressStart,
  onItemLongPressEnd,
  expectedCount,
}: MediaGridProps) {
  const itemSize = `${100 / columns}%` as DimensionValue;
  const [displayItems, setDisplayItems] = useState<Array<MediaItem | null>>([]);
  const fadeAnims = useRef<Map<string, Animated.Value>>(new Map()).current;

  // Initialize grid with expected count or items length
  useEffect(() => {
    const count = expectedCount || items.length;
    if (displayItems.length !== count) {
      // Initialize with nulls or existing items
      const newDisplayItems: Array<MediaItem | null> = Array(count).fill(null);
      items.forEach((item, index) => {
        if (index < count) {
          newDisplayItems[index] = item;
        }
      });
      setDisplayItems(newDisplayItems);
    }
  }, [expectedCount, items.length]);

  // Update items incrementally
  useEffect(() => {
    if (displayItems.length === 0) return;

    items.forEach((newItem, index) => {
      if (index >= displayItems.length) return;
      
      const currentItem = displayItems[index];
      // Only update if the item changed
      if (!currentItem || currentItem.id !== newItem.id) {
        // Create fade animation for this item
        if (!fadeAnims.has(newItem.id)) {
          fadeAnims.set(newItem.id, new Animated.Value(0));
        }
        const anim = fadeAnims.get(newItem.id)!;
        
        // Update the item
        setDisplayItems(prev => {
          const updated = [...prev];
          updated[index] = newItem;
          return updated;
        });

        // Animate fade in
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [items, displayItems.length]);

  return (
    <View className="flex-row flex-wrap">
      {displayItems.map((item, index) => {
        const anim = item ? fadeAnims.get(item.id) : null;
        const opacity = anim || new Animated.Value(item ? 1 : 0);
        const itemKey = item?.id || `placeholder-${index}`;

        return (
          <Pressable
            key={itemKey}
            onPress={() => item && onItemPress?.(item)}
            onPressIn={() => {
              if (item) {
                onItemLongPressStart?.(item);
              }
            }}
            onPressOut={() => {
              onItemLongPressEnd?.();
            }}
            style={{ width: itemSize, aspectRatio: 1 }}
            className="p-1"
          >
            <Animated.View 
              className="flex-1 bg-gray-800 rounded-lg overflow-hidden"
              style={{ opacity }}
            >
              {item ? (
                item.mediaType === "photo" ? (
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
                )
              ) : (
                <View className="w-full h-full items-center justify-center bg-gray-800">
                  <ActivityIndicator size="small" color="#666" />
                </View>
              )}
            </Animated.View>
          </Pressable>
        );
      })}
    </View>
  );
}
