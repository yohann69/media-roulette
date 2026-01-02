import { View, Text } from "react-native";

interface QRCodeProps {
  value: string;
  size?: number;
}

// Simple placeholder QR code using View components
// In production, you'd use a proper QR code library
export function QRCode({ value, size = 200 }: QRCodeProps) {
  const gridSize = 25;
  const cellSize = size / gridSize;

  // Generate a simple pattern based on the value
  const generatePattern = () => {
    const hash = value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const pattern: boolean[][] = [];
    
    for (let i = 0; i < gridSize; i++) {
      pattern[i] = [];
      for (let j = 0; j < gridSize; j++) {
        // Create a pattern based on hash
        const shouldFill = (i * gridSize + j + hash) % 3 === 0;
        pattern[i][j] = shouldFill;
      }
    }
    
    return pattern;
  };

  const pattern = generatePattern();

  return (
    <View className="bg-white p-4 rounded-xl items-center justify-center">
      <View className="flex-row flex-wrap" style={{ width: size, height: size }}>
        {pattern.map((row, i) =>
          row.map((filled, j) => (
            <View
              key={`${i}-${j}`}
              className={filled ? "bg-black" : "bg-white"}
              style={{ width: cellSize, height: cellSize }}
            />
          ))
        )}
      </View>
      <Text className="text-black text-xs mt-2 text-center" numberOfLines={1}>
        {value.substring(0, 20)}...
      </Text>
    </View>
  );
}
