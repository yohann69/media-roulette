import { useState, useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { Directory, Paths } from "expo-file-system";
import { useSocket } from "../../stores/useSocket";
import { useSocketEvent } from "../../hooks/useSocketEvent";

interface Player {
  id: string;
  name: string;
}

interface MediaItem {
  id: string;
  uri?: string;
  base64?: string;
  mediaType: "photo" | "video";
}

type GameState = "reveal" | "result" | "leaderboard" | "podium";

/** Must match the server's MAX_DISPLAY_DELAY_CREDIT_MS. */
const MAX_DISPLAY_DELAY_CREDIT_MS = 1500;

export function useGameScreenLogic(pin: string, _isHost: boolean) {
  const router = useRouter();
  const {
    currentPlayerId,
    submitGuess,
    continueGame,
    showMediaAgain,
    hideMediaAgain,
    playAgain,
    leaveGame,
    setLocalMediaMap,
  } = useSocket();

  const [gameState, setGameState] = useState<GameState>("reveal");
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerDuration, setTimerDuration] = useState(5);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [roundResults, setRoundResults] = useState<any>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<any[]>([]);
  const [gameStats, setGameStats] = useState<any>(null);
  const [actualOwnerId, setActualOwnerId] = useState<string | null>(null);
  const [isShowingMediaAgain, setIsShowingMediaAgain] = useState(false);

  // When the round arrived and when its media became visible on this phone.
  // The difference is sent with the guess so slow loading isn't penalized.
  const roundReceivedAt = useRef(0);
  const mediaShownAt = useRef<number | null>(null);
  const roundRemainingMs = useRef(0);

  const handleNewRound = (data: any) => {
    const localMediaMap = useSocket.getState().localMediaMap;
    const uri =
      data.mediaData.index !== undefined && localMediaMap.has(data.mediaData.index)
        ? localMediaMap.get(data.mediaData.index)
        : data.mediaData.uri;

    roundReceivedAt.current = data.receivedAt ?? Date.now();
    mediaShownAt.current = null;
    roundRemainingMs.current = data.remainingMs ?? data.duration * 1000;

    setCurrentRound(data.round);
    setTotalRounds(data.totalRounds);
    setCurrentMedia({ ...data.mediaData, uri });
    setTimerDuration(Math.max(0, data.duration));
    setPlayers(data.options);
    setSelectedPlayer(null);
    setTimeExpired(data.duration <= 0);
    setTimerActive(false); // starts once the media is on screen (see handleMediaShown)
    setGameState("reveal");
    setRoundResults(null);
    setIsShowingMediaAgain(false);
    // The owner is only revealed with the round result.
    setActualOwnerId(null);
  };

  // The first round can arrive before this screen mounts (the server sends it
  // right after "game-started"), and a resumed session replays it: pick it up.
  useEffect(() => {
    const pending = useSocket.getState().lastNewRound;
    if (pending) handleNewRound(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSocketEvent("new-round", handleNewRound);

  useSocketEvent("round-result", (data: any) => {
    setActualOwnerId(data.actualOwnerId);
    setRoundResults(data);
    setTimerActive(false);
    setTimeExpired(false);
    setShowLeaderboard(true);
    setGameState("leaderboard");
    setIsShowingMediaAgain(false);
  });

  useSocketEvent("game-finished", (data: any) => {
    setFinalLeaderboard(data.leaderboard);
    setGameStats(data.stats || null);
    setGameState("podium");
    setIsShowingMediaAgain(false);

    // Other players' media is no longer needed on this phone.
    try {
      const gameDir = new Directory(Paths.cache, `game_${pin}`);
      if (gameDir.exists) gameDir.delete();
      setLocalMediaMap(new Map());
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });

  useSocketEvent("show-media-again", () => setIsShowingMediaAgain(true));
  useSocketEvent("hide-media-again", () => setIsShowingMediaAgain(false));

  // Whoever taps "Play again" first sends everyone back to the lobby.
  useSocketEvent("play-again-initiated", () => {
    router.replace({ pathname: "/lobby", params: { pin } });
  });

  /** Called by the media view once the photo or video is actually visible. */
  const handleMediaShown = () => {
    if (mediaShownAt.current !== null) return;
    mediaShownAt.current = Date.now();
    // The server credits at most this much display delay; anything beyond it is
    // taken off the local countdown so it never shows time the server won't accept.
    const uncredited = Math.max(0, mediaShownAt.current - roundReceivedAt.current - MAX_DISPLAY_DELAY_CREDIT_MS);
    const seconds = Math.floor((roundRemainingMs.current - uncredited) / 1000);
    setTimerDuration(Math.max(0, seconds));
    if (seconds <= 0) {
      setTimeExpired(true);
      return;
    }
    if (!timeExpired) setTimerActive(true);
  };

  // If the media never loads (e.g. a failed download), don't block the round.
  useEffect(() => {
    if (gameState !== "reveal" || !currentMedia) return;
    const fallback = setTimeout(handleMediaShown, 1500);
    return () => clearTimeout(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, currentMedia?.id, currentRound]);

  const handlePlayerSelect = async (playerId: string) => {
    if (timeExpired || !pin) return;
    // Players can change their mind while the round runs; the last guess counts.
    setSelectedPlayer(playerId);
    const displayDelayMs = Math.max(0, (mediaShownAt.current ?? Date.now()) - roundReceivedAt.current);
    await submitGuess(pin, playerId, displayDelayMs);
  };

  // The server ends the round on its own timer; locally we only stop voting.
  const handleTimeExpired = () => {
    setTimeExpired(true);
    setTimerActive(false);
  };

  const handleContinue = async () => {
    if (!pin) return;
    await continueGame(pin);
  };

  const handleShowAgainStart = () => {
    if (pin) showMediaAgain(pin);
  };

  const handleShowAgainEnd = () => {
    if (pin) hideMediaAgain(pin);
  };

  const handlePlayAgain = async () => {
    if (!pin) return;
    // Navigation for everyone (including us) happens on "play-again-initiated".
    await playAgain(pin);
  };

  const handleExit = async () => {
    if (pin) await leaveGame(pin);
    router.replace("/");
  };

  return {
    gameState,
    currentRound,
    totalRounds,
    currentMedia,
    selectedPlayer,
    timerDuration,
    timerActive,
    timeExpired,
    players,
    showLeaderboard,
    roundResults,
    finalLeaderboard,
    gameStats,
    actualOwnerId,
    isShowingMediaAgain,
    currentPlayerId,
    handlePlayerSelect,
    handleTimeExpired,
    handleMediaShown,
    handleContinue,
    handleShowAgainStart,
    handleShowAgainEnd,
    handleContinueFromLeaderboard: handleContinue,
    handlePlayAgain,
    handleExit,
    setShowLeaderboard,
    setGameState,
  };
}
