import { useEffect } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { CustomModal } from "./Modal";
import { Button } from "../atoms/Button";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";

export function DisconnectedModal() {
  const router = useRouter();
  const { t } = useTranslation();
  const { wasKicked, clearKicked } = useSocket();

  // Navigate to home as soon as the disconnect is detected so the stale
  // lobby/game screen is replaced. The modal then sits on top of home.
  useEffect(() => {
    if (wasKicked) router.push("/");
  }, [wasKicked, router]);

  const handleClose = () => {
    clearKicked();
  };

  return (
    <CustomModal
      visible={wasKicked}
      onClose={handleClose}
      title={t("lobby.disconnectedTitle")}
      showCloseButton={false}
    >
      <View>
        <Text className="text-white text-base mb-4">
          {t("lobby.disconnectedMessage")}
        </Text>
        <Button title={t("common.close")} onPress={handleClose} variant="primary" />
      </View>
    </CustomModal>
  );
}
