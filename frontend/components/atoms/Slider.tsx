import { View, Text, TouchableOpacity } from "react-native";
import { useState } from "react";

interface SliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  options?: number[];
}

export function CustomSlider({
  label,
  value,
  onValueChange,
  minimumValue,
  maximumValue,
  step = 1,
  options,
}: SliderProps) {
  const [sliderWidth, setSliderWidth] = useState(0);

  const getPercentage = () => {
    return ((value - minimumValue) / (maximumValue - minimumValue)) * 100;
  };

  const handleLayout = (event: any) => {
    setSliderWidth(event.nativeEvent.layout.width);
  };

  const handlePress = (event: any) => {
    if (sliderWidth === 0) return;
    const x = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(100, (x / sliderWidth) * 100));
    const newValue =
      minimumValue + (percentage / 100) * (maximumValue - minimumValue);

    if (options) {
      const closest = options.reduce((prev, curr) =>
        Math.abs(curr - newValue) < Math.abs(prev - newValue) ? curr : prev
      );
      onValueChange(closest);
    } else {
      onValueChange(Math.round(newValue / step) * step);
    }
  };

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-white text-base font-semibold">{label}</Text>
        <Text className="text-gray-400 text-base font-medium">{value}</Text>
      </View>
      <TouchableOpacity
        activeOpacity={1}
        onLayout={handleLayout}
        onPress={handlePress}
        className="w-full h-10 justify-center"
      >
        <View className="h-1 bg-gray-700 rounded-sm relative">
          <View
            className="absolute left-0 h-1 bg-primary rounded-sm"
            style={{ width: `${getPercentage()}%` }}
          />
          <View
            className="absolute w-4 h-4 bg-primary rounded-full -top-1.5"
            style={{ left: `${getPercentage()}%`, marginLeft: -8 }}
          />
        </View>
      </TouchableOpacity>
      {options && (
        <View className="flex-row justify-between mt-2">
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => onValueChange(option)}
              className={`py-1 px-2 rounded ${
                value === option ? "bg-primary/20" : "bg-transparent"
              }`}
            >
              <Text
                className={`${
                  value === option ? "text-primary" : "text-gray-500"
                } text-xs ${value === option ? "font-semibold" : "font-normal"}`}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
