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
      <Text
        style={{
          color: "#ffffff",
          fontSize: 16,
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        You don't have enough media for {requiredRounds} rounds.
      </Text>
      <Text
        style={{
          color: "#9ca3af",
          fontSize: 14,
          marginBottom: 24,
          textAlign: "center",
        }}
      >
        Available: {totalMedia} media items {"\n"}
        Required: {requiredRounds} rounds
      </Text>
      <View style={{ gap: 12 }}>
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

