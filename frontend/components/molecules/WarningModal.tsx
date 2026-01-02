import { View, Text } from "react-native";
import { CustomModal } from "./Modal";
import { Button } from "../atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";

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
  const { t } = useTranslation();

  return (
    <CustomModal
      visible={visible}
      onClose={onClose}
      title={t("warning.insufficientMedia")}
      showCloseButton={true}
    >
      <Text className="text-white text-base mb-6 text-center">
        {t("warning.notEnoughMedia", { rounds: requiredRounds })}
      </Text>
      <Text className="text-gray-400 text-sm mb-6 text-center">
        {t("warning.available", { total: totalMedia })}{"\n"}
        {t("warning.required", { rounds: requiredRounds })}
      </Text>
      <View className="gap-3">
        <Button
          title={t("warning.waitForMorePlayers")}
          onPress={onWait}
          variant="secondary"
        />
        <Button
          title={t("warning.proceedReduceRounds")}
          onPress={onProceed}
          variant="primary"
        />
      </View>
    </CustomModal>
  );
}
