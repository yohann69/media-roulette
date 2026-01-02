import { View, Text } from "react-native";
import { CustomModal } from "./Modal";
import { Button } from "../atoms/Button";

interface WarningModalProps {
  visible: boolean;
  onClose: () => void;
  onWait: () => void;
  onProceed: () => void;
  totalMedia: number;
  requiredRounds: number;
}

export function WarningModal({
  visible,
  onClose,
  onWait,
  onProceed,
  totalMedia,
  requiredRounds,
}: WarningModalProps) {
  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title="Insufficient Media"
      showCloseButton={true}
    >
      <Text className="text-white text-base mb-6 text-center">
        You don't have enough media for {requiredRounds} rounds.
      </Text>
      <Text className="text-gray-400 text-sm mb-6 text-center">
        Available: {totalMedia} media items {"\n"}
        Required: {requiredRounds} rounds
      </Text>
      <View className="gap-3">
        <Button
          title="Wait for More Players"
          onPress={onWait}
          variant="secondary"
        />
        <Button
          title="Proceed (Reduce Rounds)"
          onPress={onProceed}
          variant="primary"
        />
      </View>
    </CustomModal>
  );
}
