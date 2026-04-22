import { View, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { RevealView } from "../../components/organisms/RevealView";
import { RoundResultsPage } from "../../components/organisms/RoundResultsPage";
import { GameStatsPage } from "../../components/organisms/GameStatsPage";
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
    gameStats,
    actualOwnerId,
    isShowingMediaAgain,
    handlePlayerSelect,
    handleTimeExpired,
    handleContinue,
    handleShowAgainStart,
    handleShowAgainEnd,
    handleContinueFromLeaderboard,
    handlePlayAgain,
    handleExit,
  } = useGameScreenLogic(pin, isHost);

  const isOwner = actualOwnerId === currentPlayerId;
  // Only disable selection while the "show again" overlay is up. Players are
  // free to change their vote as long as there's time left in the round.
  const isDisabled = isShowingMediaAgain;
  const correctPlayerId = actualOwnerId || players[0]?.id;

  // Media Overlay when showing again
  if (isShowingMediaAgain && currentMedia) {
    const playVideoWithSound = room?.settings?.playVideoWithSound !== false; // Default to true
    return (
      <Pressable
        className="flex-1 bg-black items-center justify-center"
        onPressOut={handleShowAgainEnd}
        style={{ flex: 1 }}
      >
        <MediaDisplay media={currentMedia} playVideoWithSound={playVideoWithSound} />
      </Pressable>
    );
  }

  if (gameState === "podium") {
    return (
      <View className="flex-1 bg-black">
        {gameStats ? (
          <GameStatsPage
            leaderboard={finalLeaderboard}
            stats={gameStats}
            totalRounds={totalRounds}
            onPlayAgain={handlePlayAgain}
          />
        ) : (
          <Podium players={finalLeaderboard} />
        )}
        <View className="px-6 py-3 border-t border-gray-800 bg-black gap-3">
          <Button
            title={t("game.playAgain")}
            onPress={handlePlayAgain}
            variant="primary"
          />
          <Button
            title={t("common.goBack")}
            onPress={handleExit}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  if (gameState === "leaderboard" && roundResults) {
    // Find the owner's name - they might not be in results since they don't guess their own media
    const actualOwnerName = 
      players.find((p) => p.id === actualOwnerId)?.name || 
      roundResults.results.find((r: any) => r.playerId === actualOwnerId)?.playerName ||
      t("game.owner");

    // Media Overlay when showing again (also works in leaderboard state)
    if (isShowingMediaAgain && currentMedia) {
      const playVideoWithSound = room?.settings?.playVideoWithSound !== false; // Default to true
      return (
        <Pressable
          className="flex-1 bg-black items-center justify-center"
          onPressOut={handleShowAgainEnd}
          style={{ flex: 1 }}
        >
          <MediaDisplay media={currentMedia} playVideoWithSound={playVideoWithSound} />
        </Pressable>
      );
    }

    return (
      <RoundResultsPage
        currentRound={currentRound}
        totalRounds={totalRounds}
        roundResults={roundResults}
        actualOwnerName={actualOwnerName}
        isOwner={isOwner}
        onContinue={handleContinue}
        onShowAgainStart={handleShowAgainStart}
        onShowAgainEnd={handleShowAgainEnd}
        allPlayers={players}
        currentMedia={currentMedia}
      />
    );
  }

  if (gameState === "reveal" && currentMedia) {
    // All players can select from all players, including themselves
    const playVideoWithSound = room?.settings?.playVideoWithSound !== false; // Default to true
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
        playVideoWithSound={playVideoWithSound}
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
