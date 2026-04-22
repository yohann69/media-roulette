import { View } from "react-native";
import { Button } from "../../components/atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";

interface LobbyFooterProps {
  isHost: boolean;
  isStarting: boolean;
  canStart: boolean;
  allReady: boolean;
  isSyncing: boolean;
  syncStatus: string;
  hostName: string;
  onPrepareGame: () => void;
  onStartGame: () => void;
}

export function LobbyFooter({
  isHost,
  isStarting,
  canStart,
  allReady,
  isSyncing,
  syncStatus,
  hostName,
  onPrepareGame,
  onStartGame,
}: LobbyFooterProps) {
  const { t } = useTranslation();

  if (isHost) {
    return (
      <View className="px-6 py-3 pb-8 border-t border-gray-800 bg-black/80">
        <Button
          title={isStarting ? t("lobby.starting") : t("lobby.startGame")}
          onPress={allReady ? onStartGame : onPrepareGame}
          variant="primary"
          disabled={isStarting || !canStart}
        />
      </View>
    );
  }

  return (
    <View className="px-6 py-3 pb-8 border-t border-gray-800 bg-black/80">
      <Button
        title={isSyncing ? syncStatus : t("lobby.waitingForHost", { hostName })}
        onPress={() => {}}
        variant="secondary"
        disabled
      />
    </View>
  );
}
