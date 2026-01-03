import { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { CustomModal } from "../../components/molecules/Modal";
import { CustomSlider } from "../../components/atoms/Slider";
import { Toggle } from "../../components/atoms/Toggle";
import { Button } from "../../components/atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";

interface GameSettings {
  rounds: number;
  timer: number;
  mode: "Photo" | "Video" | "Mix";
  playVideoWithSound?: boolean;
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
  const { t } = useTranslation();
  const [rounds, setRounds] = useState(10);
  const [timer, setTimer] = useState(5);
  const [mode, setMode] = useState<"Photo" | "Video" | "Mix">("Photo");
  const [playVideoWithSound, setPlayVideoWithSound] = useState(true);

  const handleConfirm = () => {
    onConfirm({ 
      rounds, 
      timer, 
      mode,
      playVideoWithSound: (mode === "Video" || mode === "Mix") ? playVideoWithSound : undefined
    });
    onClose();
  };

  const modeOptions = [
    t("gameSettings.photo"),
    t("gameSettings.video"),
    t("gameSettings.mix"),
  ];
  const modeValues: ("Photo" | "Video" | "Mix")[] = ["Photo", "Video", "Mix"];

  const getModeLabel = (modeValue: "Photo" | "Video" | "Mix") => {
    const index = modeValues.indexOf(modeValue);
    return modeOptions[index];
  };

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title={t("gameSettings.title")}
    >
      <View className="mb-6">
        <Text className="text-white text-base font-semibold mb-3">{t("gameSettings.rounds")}</Text>
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
        label={t("gameSettings.timer")}
        value={timer}
        onValueChange={setTimer}
        minimumValue={1}
        maximumValue={15}
        step={1}
      />

      <Toggle
        label={t("gameSettings.mode")}
        options={modeOptions}
        value={getModeLabel(mode)}
        onValueChange={(value) => {
          const index = modeOptions.indexOf(value);
          setMode(modeValues[index]);
        }}
      />

      {(mode === "Video" || mode === "Mix") && (
        <View className="mt-6">
          <Text className="text-white text-base font-semibold mb-3">
            {t("gameSettings.playVideoWithSound")}
          </Text>
          <View className="flex-row items-center justify-between bg-gray-800 rounded-xl p-4">
            <Text className="text-gray-300 text-sm flex-1">
              {t("gameSettings.playVideoWithSoundDescription")}
            </Text>
            <TouchableOpacity
              onPress={() => setPlayVideoWithSound(!playVideoWithSound)}
              className={`w-14 h-8 rounded-full ${
                playVideoWithSound ? "bg-primary" : "bg-gray-600"
              } justify-center`}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white ${
                  playVideoWithSound ? "ml-7" : "ml-1"
                }`}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View className="mt-4">
        <Button
          title={t("common.continue")}
          onPress={handleConfirm}
          variant="primary"
        />
      </View>
    </CustomModal>
  );
}
