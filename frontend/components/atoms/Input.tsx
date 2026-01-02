import { TextInput, View, Text } from "react-native";
import { useState } from "react";

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  autoFocus?: boolean;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  autoFocus = false,
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="w-full mb-4">
      {label && (
        <Text className="text-white text-sm font-medium mb-2">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#666"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoFocus={autoFocus}
        className={`bg-gray-800 text-white px-4 py-3 rounded-xl border-2 ${
          isFocused ? "border-blue-500" : "border-gray-700"
        } ${error ? "border-red-500" : ""}`}
        style={{ fontSize: 16 }}
      />
      {error && <Text className="text-red-500 text-sm mt-1">{error}</Text>}
    </View>
  );
}

