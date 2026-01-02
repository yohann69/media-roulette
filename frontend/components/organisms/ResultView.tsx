import { View, Text, ScrollView } from "react-native";
import { MediaDisplay } from "../molecules/MediaDisplay";
import { ResultDisplay } from "../molecules/ResultDisplay";
import { Button } from "../atoms/Button";

interface Player {
  id: string;
  name: string;
}

interface MediaItem {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
}

interface ResultViewProps {
  currentRound: number;
  totalRounds: number;
  currentMedia: MediaItem | undefined;
  selectedPlayer: string | null;
  correctPlayerId: string;
  players: Player[];
  isOwner: boolean;
  onShowAgain: () => void;
  onContinue: () => void;
}

export function ResultView({
  currentRound,
  totalRounds,
  currentMedia,
  selectedPlayer,
  correctPlayerId,
  players,
  isOwner,
  onShowAgain,
  onContinue,
}: ResultViewProps) {
  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="items-center mb-6">
          <Text className="text-white text-2xl font-bold mb-1">
            Round {currentRound} of {totalRounds}
          </Text>
          <Text className="text-gray-400 text-sm">Result</Text>
        </View>

        {currentMedia && <MediaDisplay media={currentMedia} />}

        <ResultDisplay
          selectedPlayer={selectedPlayer}
          correctPlayerId={correctPlayerId}
          players={players}
        />
      </ScrollView>

      <View className="px-6 py-4 border-t border-gray-800 bg-black">
        {isOwner ? (
          <View className="gap-3">
            <Button
              title="Show Again"
              onPress={onShowAgain}
              variant="secondary"
            />
            <Button title="Continue" onPress={onContinue} variant="primary" />
          </View>
        ) : (
          <Button
            title={currentRound < totalRounds ? "Continue" : "View Results"}
            onPress={onContinue}
            variant="primary"
          />
        )}
      </View>
    </View>
  );
}

