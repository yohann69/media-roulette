import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { RevealView } from "../../components/organisms/RevealView";
import { ResultView } from "../../components/organisms/ResultView";
import { InterimLeaderboard } from "../../components/molecules/InterimLeaderboard";
import { Podium } from "../../components/molecules/Podium";
import { Button } from "../../components/atoms/Button";
import { MediaDisplay } from "../../components/molecules/MediaDisplay";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";
import { useGameScreenLogic } from "./useGameScreenLogic";

export function GameScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { room, currentPlayerId } = useSocket();

  const pin = params.pin || room?.pin || "";
  const isHost = params.isHost === "true" || room?.players.find((p) => p.socketId === currentPlayerId)?.isHost || false;

  const {
    gameState,
    currentRound,
    totalRounds,
    currentMedia,
    selectedPlayer,
    timerDuration,
    timerActive,
    players,
    showLeaderboard,
    roundResults,
    finalLeaderboard,
    actualOwnerId,
    isShowingMediaAgain,
    handlePlayerSelect,
    handleTimeExpired,
    handleContinue,
    handleShowAgainStart,
    handleShowAgainEnd,
    handleContinueFromLeaderboard,
    handlePlayAgain,
  } = useGameScreenLogic(pin, isHost);

  const isDisabled = isShowingMediaAgain || selectedPlayer !== null;
  const correctPlayerId = actualOwnerId || players[0]?.id;
  const isOwner = actualOwnerId === currentPlayerId;

  // Media Overlay when showing again
  if (isShowingMediaAgain && currentMedia) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <MediaDisplay media={currentMedia} />
      </View>
    );
  }

  if (gameState === "podium") {
    return (
      <View className="flex-1 bg-black">
        <Podium players={finalLeaderboard} />
        <View className="px-6 py-4 border-t border-gray-800 bg-black">
          <Button
            title={t("game.playAgain")}
            onPress={handlePlayAgain}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  if (gameState === "leaderboard" && roundResults) {
    return (
      <View className="flex-1 bg-black">
        <InterimLeaderboard
          visible={showLeaderboard}
          players={roundResults.leaderboard}
          onContinue={handleContinueFromLeaderboard}
        />
      </View>
    );
  }

  if (gameState === "reveal" && currentMedia) {
    return (
      <RevealView
        currentRound={currentRound}
        totalRounds={totalRounds}
        timerDuration={timerDuration}
        timerActive={timerActive}
        currentMedia={currentMedia}
        players={players}
        selectedPlayer={selectedPlayer}
        disabled={isDisabled}
        onPlayerSelect={handlePlayerSelect}
        onTimeExpired={handleTimeExpired}
      />
    );
  }

  if (gameState === "result" && currentMedia && roundResults) {
    const userResult = roundResults.results.find(
      (r: any) => r.playerId === currentPlayerId
    );

    return (
      <ResultView
        currentRound={currentRound}
        totalRounds={totalRounds}
        currentMedia={currentMedia}
        selectedPlayer={userResult?.guessedPlayerId || null}
        correctPlayerId={actualOwnerId || ""}
        players={players}
        isOwner={isOwner}
        onShowAgainStart={handleShowAgainStart}
        onShowAgainEnd={handleShowAgainEnd}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Button
        title={t("game.waitingRound")}
        onPress={() => {}}
        variant="secondary"
        disabled
      />
    </View>
  );
}
