import { useState } from "react";
import { View } from "react-native";
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

export function GameSettingsModal({
  visible,
  onClose,
  onConfirm,
}: GameSettingsModalProps) {
  const [rounds, setRounds] = useState(25);
  const [timer, setTimer] = useState(5);
  const [mode, setMode] = useState<"Photo" | "Video" | "Mix">("Mix");

  const handleConfirm = () => {
    onConfirm({ rounds, timer, mode });
    onClose();
  };

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title="Game Settings"
    >
      <CustomSlider
        label="Rounds"
        value={rounds}
        onValueChange={setRounds}
        minimumValue={10}
        maximumValue={100}
        step={15}
        options={[10, 25, 50, 100]}
      />

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
        options={["Photo", "Video", "Mix"]}
        value={mode}
        onValueChange={(value) => setMode(value as "Photo" | "Video" | "Mix")}
      />

      <View style={{ marginTop: 8 }}>
        <Button
          title="Continue"
          onPress={handleConfirm}
          variant="primary"
        />
      </View>
    </CustomModal>
  );
}

