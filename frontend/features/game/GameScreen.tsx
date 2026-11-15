import { useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { RevealView } from "../../components/organisms/RevealView";
import { RoundResultsPage } from "../../components/organisms/RoundResultsPage";
import { GameStatsPage } from "../../components/organisms/GameStatsPage";
import { Podium } from "../../components/molecules/Podium";
import { Button } from "../../components/atoms/Button";
import { MediaDisplay } from "../../components/molecules/MediaDisplay";
import { ReactionBar } from "../../components/molecules/Reactions";
import { useSocket } from "../../stores/useSocket";
import { useTranslation } from "../../hooks/useTranslation";
import { useGameScreenLogic } from "./useGameScreenLogic";

export function GameScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ isHost?: string; pin?: string }>();
  const { room, currentPlayerId } = useSocket();

  const pin = params.pin || room?.pin || "";
  const isHost = params.isHost === "true" || room?.players.find((p) => p.id === currentPlayerId)?.isHost || false;

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
    twist,
    yearRange,
    selectedYear,
    handleYearSelect,
    handlePlayerSelect,
    handleTimeExpired,
    handleMediaShown,
    handleMediaLongPress,
    timeExpired,
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
  const recapRef = useRef<any>(null);
  const [isSharing, setIsSharing] = useState(false);

  /** Captures the podium and awards as an image and opens the share sheet. */
  const handleShareRecap = async () => {
    if (!recapRef.current || isSharing) return;
    setIsSharing(true);
    try {
      const uri = await captureRef(recapRef, { format: "png", quality: 1, result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: t("game.shareRecap") });
    } catch (error) {
      console.warn("Could not share the recap:", error);
    } finally {
      setIsSharing(false);
    }
  };

  const series = (room?.players ?? []).map((p) => ({
    playerId: p.id,
    playerName: p.name,
    wins: p.seriesWins ?? 0,
    score: p.seriesScore ?? 0,
  }));

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
            series={series}
            gamesPlayed={room?.gamesPlayed ?? 0}
            recapRef={recapRef}
          />
        ) : (
          <Podium players={finalLeaderboard} />
        )}
        <View className="px-6 py-3 border-t border-gray-800 bg-black gap-3">
          {!!pin && <ReactionBar pin={pin} />}
          <Button
            title={t("game.playAgain")}
            onPress={handlePlayAgain}
            variant="primary"
          />
          <View className="flex-row gap-3">
            {gameStats && (
              <View className="flex-1">
                <Button
                  title={t("game.shareRecap")}
                  onPress={handleShareRecap}
                  variant="secondary"
                  disabled={isSharing}
                />
              </View>
            )}
            <View className="flex-1">
              <Button
                title={t("common.goBack")}
                onPress={handleExit}
                variant="secondary"
              />
            </View>
          </View>
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
        pin={pin}
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
        disabled={isDisabled || timeExpired}
        onPlayerSelect={handlePlayerSelect}
        onTimeExpired={handleTimeExpired}
        onMediaShown={handleMediaShown}
        onMediaLongPress={handleMediaLongPress}
        playVideoWithSound={playVideoWithSound}
        slowReveal={twist === "slowReveal"}
        yearRange={yearRange}
        selectedYear={selectedYear}
        onYearSelect={handleYearSelect}
      />
    );
  }


  return (
    <View className="flex-1 bg-black items-center justify-center">
      <Button
        title={gameState === "skipped" ? t("game.skipped") : t("game.waitingRound")}
        onPress={() => {}}
        variant="secondary"
        disabled
      />
    </View>
  );
}
