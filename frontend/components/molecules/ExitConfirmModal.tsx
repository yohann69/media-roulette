import { View, Text } from "react-native";
import { CustomModal } from "./Modal";
import { Button } from "../atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";

interface ExitConfirmModalProps {
  visible: boolean;
  isHost: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ExitConfirmModal({
  visible,
  isHost,
  onCancel,
  onConfirm,
}: ExitConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <CustomModal
      visible={visible}
      onClose={onCancel}
      title={t("lobby.exitWarningTitle")}
      showCloseButton={true}
    >
      <Text className="text-white text-base mb-6 text-center">
        {isHost
          ? t("lobby.exitWarningHostMessage")
          : t("lobby.exitWarningMessage")}
      </Text>
      <View className="gap-3">
        <Button
          title={t("lobby.stayInGame")}
          onPress={onCancel}
          variant="secondary"
        />
        <Button
          title={t("lobby.confirmLeave")}
          onPress={onConfirm}
          variant="primary"
        />
      </View>
    </CustomModal>
  );
}
