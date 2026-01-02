import { View, Text, TouchableOpacity, PanResponder } from "react-native";
import { useRef, useState } from "react";

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
    <View style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
          {label}
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 16, fontWeight: "500" }}>
          {value}
        </Text>
      </View>
      <TouchableOpacity
        activeOpacity={1}
        onLayout={handleLayout}
        onPress={handlePress}
        style={{
          width: "100%",
          height: 40,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            height: 4,
            backgroundColor: "#374151",
            borderRadius: 2,
            position: "relative",
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              width: `${getPercentage()}%`,
              height: 4,
              backgroundColor: "#3b82f6",
              borderRadius: 2,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: `${getPercentage()}%`,
              marginLeft: -8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#3b82f6",
              top: -6,
            }}
          />
        </View>
      </TouchableOpacity>
      {options && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => onValueChange(option)}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 8,
                borderRadius: 4,
                backgroundColor:
                  value === option ? "rgba(59, 130, 246, 0.2)" : "transparent",
              }}
            >
              <Text
                style={{
                  color: value === option ? "#3b82f6" : "#6b7280",
                  fontSize: 12,
                  fontWeight: value === option ? "600" : "400",
                }}
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
