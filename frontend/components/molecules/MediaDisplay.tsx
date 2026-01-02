import { View, Image } from "react-native";

interface MediaItem {
  id: string;
  uri?: string;
  base64?: string;
  mediaType: "photo" | "video";
}

interface MediaDisplayProps {
  media: MediaItem;
}

export function MediaDisplay({ media }: MediaDisplayProps) {
  // Determine image source - prefer base64 if available, otherwise use URI
  const imageSource = media.base64
    ? { uri: `data:image/jpeg;base64,${media.base64}` }
    : media.uri
    ? { uri: media.uri }
    : null;

  return (
    <View className="mb-6">
      {media.mediaType === "photo" ? (
        <View className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-900 mb-4">
          {imageSource && (
            <Image
              source={imageSource}
              className="w-full h-full"
              resizeMode="cover"
            />
          )}
        </View>
      ) : (
        <View className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-900 items-center justify-center mb-4">
          <View className="w-20 h-20 rounded-full bg-secondary items-center justify-center">
            <View className="w-0 h-0 border-l-[20px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
          </View>
        </View>
      )}
    </View>
  );
}
