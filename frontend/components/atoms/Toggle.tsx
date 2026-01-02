import { View, Text, TouchableOpacity } from "react-native";

interface ToggleProps {
  label: string;
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
}

export function Toggle({ label, options, value, onValueChange }: ToggleProps) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600", marginBottom: 12 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#1f2937",
          borderRadius: 12,
          padding: 4,
        }}
      >
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onValueChange(option)}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: value === option ? "#3b82f6" : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: value === option ? "#ffffff" : "#9ca3af",
                fontSize: 14,
                fontWeight: value === option ? "600" : "400",
              }}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

