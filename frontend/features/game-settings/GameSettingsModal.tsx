import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { CustomModal } from "../../components/molecules/Modal";
import { CustomSlider } from "../../components/atoms/Slider";
import { Toggle } from "../../components/atoms/Toggle";
import { Button } from "../../components/atoms/Button";

interface GameSettings {
  rounds: number;
  timer: number;
  mode: "Photo" | "Video" | "Mix";
}

interface GameSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (settings: GameSettings) => void;
}

const ROUND_OPTIONS = [10, 25, 50, 100];

export function GameSettingsModal({
  visible,
  onClose,
  onConfirm,
}: GameSettingsModalProps) {
  const [rounds, setRounds] = useState(25);
  const [timer, setTimer] = useState(5);
  const [mode, setMode] = useState<"Photo" | "Video" | "Mix">("Photo");

  const handleConfirm = () => {
    onConfirm({ rounds, timer, mode });
    onClose();
  };

  const modeOptions = ["📸 Photos", "🎞️ Videos", "🎉 Mix"];
  const modeValues: ("Photo" | "Video" | "Mix")[] = ["Photo", "Video", "Mix"];

  const getModeLabel = (modeValue: "Photo" | "Video" | "Mix") => {
    const index = modeValues.indexOf(modeValue);
    return modeOptions[index];
  };

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title="Game Settings"
    >
      <View className="mb-6">
        <Text className="text-white text-base font-semibold mb-3">Rounds</Text>
        <View className="flex-row flex-wrap gap-2">
          {ROUND_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setRounds(option)}
              className={`flex-1 min-w-[80px] py-4 px-4 rounded-xl ${
                rounds === option ? "bg-primary" : "bg-gray-700"
              } items-center`}
            >
              <Text
                className={`${
                  rounds === option ? "text-white" : "text-gray-400"
                } text-base ${rounds === option ? "font-bold" : "font-medium"}`}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <CustomSlider
        label="Timer (seconds)"
        value={timer}
        onValueChange={setTimer}
        minimumValue={1}
        maximumValue={15}
        step={1}
      />

      <Toggle
        label="Mode"
        options={modeOptions}
        value={getModeLabel(mode)}
        onValueChange={(value) => {
          const index = modeOptions.indexOf(value);
          setMode(modeValues[index]);
        }}
      />

      <View className="mt-4">
        <Button
          title="Continue"
          onPress={handleConfirm}
          variant="primary"
        />
      </View>
    </CustomModal>
  );
}
