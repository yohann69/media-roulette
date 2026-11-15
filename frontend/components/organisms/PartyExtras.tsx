import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../atoms/Button";
import { MediaDisplay } from "../molecules/MediaDisplay";
import { useTranslation } from "../../hooks/useTranslation";
import type { CaptionChoice, CaptionResult } from "../../features/game/useGameScreenLogic";

/** Must match the server's MAX_CAPTION_LENGTH. */
const MAX_CAPTION_LENGTH = 80;

interface MediaItem {
  id: string;
  uri?: string;
  mediaType: "photo" | "video";
}

/** Whole seconds left until `endsAt` (this phone's clock), updated every half second. */
function useSecondsLeft(endsAt: number) {
  const compute = () => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(compute);
  useEffect(() => {
    setSeconds(compute());
    const timer = setInterval(() => setSeconds(compute()), 500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt]);
  return seconds;
}

function Header({ title, subtitle, endsAt }: { title: string; subtitle?: string; endsAt?: number }) {
  const { t } = useTranslation();
  const seconds = useSecondsLeft(endsAt ?? 0);
  return (
    <View className="items-center mb-5">
      <Text className="text-white text-3xl font-bold mb-2 text-center">{title}</Text>
      {!!subtitle && <Text className="text-gray-300 text-base text-center">{subtitle}</Text>}
      {!!endsAt && (
        <Text className="text-amber-300 text-sm font-semibold mt-2" accessibilityLiveRegion="polite">
          {t("extras.secondsLeft", { seconds })}
        </Text>
      )}
    </View>
  );
}

function Screen({ media, children, footer }: { media?: MediaItem | null; children: React.ReactNode; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView className="flex-1 bg-black" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {media && <MediaDisplay media={media} showAsBackground />}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer && (
        <View className="px-6 py-3 border-t border-gray-800 bg-black gap-3" style={{ paddingBottom: Math.max(12, insets.bottom) }}>
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Caption This ──────────────────────────────────────────────────────────

export function CaptionWriteView({
  media,
  endsAt,
  submitted,
  onSubmit,
}: {
  media: MediaItem | null;
  endsAt: number;
  submitted: string | null;
  onSubmit: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && text.trim() !== submitted;

  return (
    <Screen
      media={media}
      footer={
        <Button
          title={submitted ? t("extras.updateCaption") : t("extras.sendCaption")}
          onPress={() => onSubmit(text)}
          variant="primary"
          disabled={!canSend}
        />
      }
    >
      <Header title={t("extras.captionTitle")} subtitle={t("extras.captionPrompt")} endsAt={endsAt} />
      {media && (
        <View className="items-center">
          <MediaDisplay media={media} />
        </View>
      )}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t("extras.captionPlaceholder")}
        placeholderTextColor="#6b7280"
        maxLength={MAX_CAPTION_LENGTH}
        returnKeyType="send"
        onSubmitEditing={() => canSend && onSubmit(text)}
        accessibilityLabel={t("extras.captionPrompt")}
        className="bg-gray-800 text-white text-lg rounded-xl px-4 py-4 border-2 border-gray-700"
      />
      {!!submitted && (
        <Text className="text-green-400 text-sm text-center mt-3">{t("extras.captionSent", { text: submitted })}</Text>
      )}
    </Screen>
  );
}

export function CaptionVoteView({
  endsAt,
  choices,
  myVote,
  onVote,
}: {
  endsAt: number;
  choices: CaptionChoice[];
  myVote: string | null;
  onVote: (captionId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Screen>
      <Header title={t("extras.voteTitle")} subtitle={t("extras.votePrompt")} endsAt={endsAt} />
      <View className="gap-3">
        {choices.map((choice) => {
          const selected = choice.id === myVote;
          return (
            <Pressable
              key={choice.id}
              onPress={() => onVote(choice.id)}
              disabled={choice.mine}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: choice.mine }}
              className={`rounded-xl border-2 px-5 py-4 ${
                selected ? "bg-primary/30 border-primary" : "bg-gray-800 border-gray-700"
              } ${choice.mine ? "opacity-50" : ""}`}
            >
              <Text className="text-white text-lg">“{choice.text}”</Text>
              {choice.mine && <Text className="text-gray-400 text-xs mt-1">{t("extras.yourCaption")}</Text>}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

export function CaptionResultsView({
  media,
  results,
  isOwner,
  ownerName,
  onContinue,
}: {
  media: MediaItem | null;
  results: CaptionResult[];
  isOwner: boolean;
  ownerName: string;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const topVotes = results[0]?.votes ?? 0;
  return (
    <Screen
      media={media}
      footer={
        isOwner ? (
          <Button title={t("common.continue")} onPress={onContinue} variant="primary" />
        ) : (
          <Button title={t("leaderboard.waitingForOwner", { ownerName })} onPress={() => {}} variant="secondary" disabled />
        )
      }
    >
      <Header title={t("extras.captionResultsTitle")} />
      {results.length === 0 && <Text className="text-gray-400 text-center">{t("extras.noCaptions")}</Text>}
      <View className="gap-3">
        {results.map((r) => {
          const winner = topVotes > 0 && r.votes === topVotes;
          return (
            <View
              key={r.authorId}
              className={`rounded-xl border-2 px-5 py-4 ${winner ? "bg-yellow-900/30 border-yellow-500" : "bg-gray-800 border-gray-700"}`}
            >
              <Text className="text-white text-lg mb-2">
                {winner ? "🏆 " : ""}“{r.text}”
              </Text>
              <View className="flex-row justify-between">
                <Text className="text-gray-300 text-sm font-semibold">{r.authorName}</Text>
                <Text className={r.points > 0 ? "text-green-400 text-sm font-semibold" : "text-gray-500 text-sm"}>
                  {t("extras.votes", { count: r.votes })} · +{r.points} {t("common.pts")}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

// ── Story Time ────────────────────────────────────────────────────────────

export function StoryView({
  media,
  endsAt,
  ownerName,
  isOwner,
  hasApplauded,
  applauseCount,
  result,
  onApplaud,
  onEnd,
}: {
  media: MediaItem | null;
  endsAt: number;
  ownerName: string;
  isOwner: boolean;
  hasApplauded: boolean;
  /** Applause so far (live). */
  applauseCount: number;
  /** Set once the story is over. */
  result: { applause: number; points: number } | null;
  onApplaud: () => void;
  onEnd: () => void;
}) {
  const { t } = useTranslation();
  const footer = result ? null : isOwner ? (
    <Button title={t("extras.storyDone")} onPress={onEnd} variant="primary" />
  ) : (
    <Button
      title={hasApplauded ? t("extras.applauded") : t("extras.applaud")}
      onPress={onApplaud}
      variant="primary"
      disabled={hasApplauded}
    />
  );

  return (
    <Screen media={media} footer={footer}>
      <Header
        title={t("extras.storyTitle")}
        subtitle={isOwner ? t("extras.storyYourTurn") : t("extras.storyPrompt", { name: ownerName })}
        endsAt={result ? undefined : endsAt}
      />
      {media && (
        <View className="items-center">
          <MediaDisplay media={media} />
        </View>
      )}
      {!result && applauseCount > 0 && (
        <Text className="text-white text-3xl font-bold text-center" accessibilityLiveRegion="polite">
          👏 ×{applauseCount}
        </Text>
      )}
      {result && (
        <View className="bg-gray-800 border-2 border-primary rounded-xl p-4">
          <Text className="text-white text-lg font-semibold text-center">
            {t("extras.storyResult", { name: ownerName, count: result.applause, points: result.points })}
          </Text>
        </View>
      )}
    </Screen>
  );
}
