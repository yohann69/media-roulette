import { useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { clearGameMedia, isPreparedUri } from "../../utils/gameMedia";
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

type GameState =
  | "reveal"
  | "result"
  | "leaderboard"
  | "podium"
  | "skipped"
  // Caption mode
  | "caption"
  | "captionVote"
  | "captionResults"
;

export interface CaptionChoice {
  id: string;
  text: string;
  mine: boolean;
}

export interface CaptionResult {
  authorId: string;
  authorName: string;
  text: string;
  votes: number;
  points: number;
}

/** Must match the server's MAX_DISPLAY_DELAY_CREDIT_MS. */
const MAX_DISPLAY_DELAY_CREDIT_MS = 1500;

export function useGameScreenLogic(pin: string, _isHost: boolean) {
  const router = useRouter();
  const {
    currentPlayerId,
    submitGuess,
    submitYear,
    continueGame,
    showMediaAgain,
    hideMediaAgain,
    skipMedia,
    submitCaption,
    voteCaption,
    rematch,
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
  /** Special rule of the current round, if any ("slowReveal"). */
  const [twist, setTwist] = useState<string | null>(null);
  /** Time Machine: years to pick from (null outside Time Machine rounds) and our pick. */
  const [yearRange, setYearRange] = useState<{ min: number; max: number } | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Caption mode
  /** When the current caption phase (writing or voting) ends, on this phone's clock. */
  const [extraEndsAt, setExtraEndsAt] = useState(0);
  const [myCaption, setMyCaption] = useState<string | null>(null);
  const [captionChoices, setCaptionChoices] = useState<CaptionChoice[]>([]);
  const [myCaptionVote, setMyCaptionVote] = useState<string | null>(null);
  const [captionResults, setCaptionResults] = useState<CaptionResult[]>([]);
  /** Another player started a rematch: its host's name (we can join it). */
  const [rematchHost, setRematchHost] = useState<string | null>(null);
  const [isJoiningRematch, setIsJoiningRematch] = useState(false);

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
    setTwist(data.twist ?? null);
    setYearRange(data.yearRange ?? null);
    setSelectedYear(null);
    setTimeExpired(data.duration <= 0);
    setTimerActive(false); // starts once the media is on screen (see handleMediaShown)
    setRoundResults(null);
    setIsShowingMediaAgain(false);
    setActualOwnerId(null);

    // Caption mode: no guessing, everyone writes a caption for the photo.
    if (data.captionEndsInMs != null) {
      setExtraEndsAt(Date.now() + data.captionEndsInMs);
      setMyCaption(null);
      setMyCaptionVote(null);
      setCaptionChoices([]);
      setGameState("caption");
      return;
    }
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
    const mine = data.results?.find((r: any) => r.playerId === useSocket.getState().currentPlayerId);
    if (mine && data.actualOwnerId !== mine.playerId) {
      const feedback = mine.isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : mine.tooSlow
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error;
      Haptics.notificationAsync(feedback).catch(() => {});
    }
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
    clearGameMedia(pin);
    setLocalMediaMap(new Map());
  });

  // The owner hid their media: the next one follows right after.
  useSocketEvent("round-skipped", () => {
    setTimerActive(false);
    setGameState("skipped");
  });

  // ── Caption mode ──
  useSocketEvent("caption-vote-start", ({ captions, endsInMs }: { captions: CaptionChoice[]; endsInMs: number }) => {
    setExtraEndsAt(Date.now() + endsInMs);
    setCaptionChoices(captions);
    setMyCaptionVote(null);
    setGameState("captionVote");
  });

  useSocketEvent("caption-results", ({ results }: { results: CaptionResult[] }) => {
    setCaptionResults(results);
    const top = results[0];
    if (top && top.votes > 0 && top.authorId === useSocket.getState().currentPlayerId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setGameState("captionResults");
  });

  const handleSubmitCaption = async (text: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!pin || !clean) return;
    if (await submitCaption(pin, clean)) {
      setMyCaption(clean);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const handleVoteCaption = (captionId: string) => {
    if (!pin) return;
    setMyCaptionVote(captionId);
    Haptics.selectionAsync().catch(() => {});
    voteCaption(pin, captionId);
  };

  useSocketEvent("show-media-again", () => setIsShowingMediaAgain(true));
  useSocketEvent("hide-media-again", () => setIsShowingMediaAgain(false));

  // Another player started a rematch: we can join it from the podium (or not).
  useSocketEvent("rematch-available", ({ hostName }: { hostName: string }) => setRematchHost(hostName));

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
    Haptics.selectionAsync().catch(() => {});
    const displayDelayMs = Math.max(0, (mediaShownAt.current ?? Date.now()) - roundReceivedAt.current);
    await submitGuess(pin, playerId, displayDelayMs);
  };

  /** Time Machine: the year can be changed while the round runs, like the vote. */
  const handleYearSelect = (year: number) => {
    if (timeExpired || !pin) return;
    setSelectedYear(year);
    Haptics.selectionAsync().catch(() => {});
    const displayDelayMs = Math.max(0, (mediaShownAt.current ?? Date.now()) - roundReceivedAt.current);
    submitYear(pin, year, displayDelayMs);
  };

  // The server ends the round on its own timer; locally we only stop voting.
  const handleTimeExpired = () => {
    setTimeExpired(true);
    setTimerActive(false);
  };

  /** Long-press on the media: if it's ours, hide it. Does nothing on others' media. */
  const handleMediaLongPress = () => {
    const hideable = gameState === "reveal" || gameState === "caption";
    if (!pin || !hideable || !isPreparedUri(currentMedia?.uri)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    skipMedia(pin);
  };

  const handleContinue = async () => {
    if (!pin) return;
    await continueGame(pin);
  };

  // Whether we're holding "Show again" (we own the photo).
  const holdingShowAgain = useRef(false);

  const handleShowAgainStart = () => {
    if (!pin) return;
    holdingShowAgain.current = true;
    showMediaAgain(pin);
  };

  const handleShowAgainEnd = () => {
    if (!pin || !holdingShowAgain.current) return;
    holdingShowAgain.current = false;
    hideMediaAgain(pin);
  };

  // Leaving the app while holding the button: the release may never come.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") handleShowAgainEnd();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  /** Only we go to the rematch: start it (and host it) or join the one already started. */
  const handlePlayAgain = async () => {
    if (!pin || isJoiningRematch) return;
    setIsJoiningRematch(true);
    const entered = await rematch(pin);
    setIsJoiningRematch(false);
    if (entered) {
      router.replace({ pathname: "/lobby", params: { pin: entered.pin, isHost: entered.isHost ? "true" : "false" } });
    }
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
    twist,
    yearRange,
    selectedYear,
    handleYearSelect,
    extraEndsAt,
    myCaption,
    captionChoices,
    myCaptionVote,
    captionResults,
    rematchHost,
    isJoiningRematch,
    handleSubmitCaption,
    handleVoteCaption,

    handlePlayerSelect,
    handleTimeExpired,
    handleMediaShown,
    handleMediaLongPress,
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
