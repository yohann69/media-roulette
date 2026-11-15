import { useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "../../hooks/useTranslation";

interface YearPickerProps {
  min: number;
  max: number;
  selected: number | null;
  disabled?: boolean;
  onSelect: (year: number) => void;
}

/** Time Machine: a row of years to pick from, most recent on the right. */
export function YearPicker({ min, max, selected, disabled, onSelect }: YearPickerProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<any>(null);
  const years = Array.from({ length: Math.max(0, max - min) + 1 }, (_, i) => min + i);

  return (
    <View className="mb-3">
      <Text className="text-gray-300 text-sm text-center mb-2">{t("game.whenWasItTaken")}</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("game.whenWasItTaken")}
      >
        {years.map((year) => {
          const isSelected = year === selected;
          return (
            <Pressable
              key={year}
              onPress={() => onSelect(year)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled }}
              className={`px-4 py-2 rounded-full border-2 ${
                isSelected ? "bg-teal-500 border-teal-300" : "bg-gray-800/90 border-gray-700"
              } ${disabled ? "opacity-50" : ""}`}
            >
              <Text className={`text-base font-semibold ${isSelected ? "text-white" : "text-gray-200"}`}>{year}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
