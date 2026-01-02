import { View, Text } from "react-native";
import Slider from "@react-native-community/slider";

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
  const handleValueChange = (newValue: number) => {
    if (options) {
      // Snap to nearest option
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
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        value={value}
        onValueChange={handleValueChange}
        step={step}
        minimumTrackTintColor="#3b82f6"
        maximumTrackTintColor="#374151"
        thumbTintColor="#3b82f6"
      />
      {options && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          {options.map((option) => (
            <Text
              key={option}
              style={{
                color: value === option ? "#3b82f6" : "#6b7280",
                fontSize: 12,
                fontWeight: value === option ? "600" : "400",
              }}
            >
              {option}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

