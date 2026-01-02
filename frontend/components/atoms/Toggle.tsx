import { View, Text, TouchableOpacity } from "react-native";

interface ToggleProps {
  label: string;
  options: string[];
  value: string;
  onValueChange: (value: string) => void;
}

export function Toggle({ label, options, value, onValueChange }: ToggleProps) {
  return (
    <View className="mb-6">
      <Text className="text-white text-base font-semibold mb-3">{label}</Text>
      <View className="flex-row bg-gray-700 rounded-xl p-1">
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onValueChange(option)}
            className={`flex-1 py-3 px-4 rounded-lg ${
              value === option ? "bg-primary" : "bg-transparent"
            } items-center`}
          >
            <Text
              className={`${
                value === option ? "text-white" : "text-gray-400"
              } text-sm ${value === option ? "font-semibold" : "font-normal"}`}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
