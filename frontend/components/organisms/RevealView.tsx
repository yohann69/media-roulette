import { View, Text, ScrollView } from "react-native";
import { CountdownTimer } from "../molecules/CountdownTimer";
import { MediaDisplay } from "../molecules/MediaDisplay";
import { PlayerSelection } from "../molecules/PlayerSelection";

interface Player {
  id: string;
  name: string;
}

interface MediaItem {
  id: string;
  uri: string;
  mediaType: "photo" | "video";
}

interface RevealViewProps {
  currentRound: number;
  totalRounds: number;
  timerDuration: number;
  timerActive: boolean;
  currentMedia: MediaItem | undefined;
  players: Player[];
  selectedPlayer: string | null;
  disabled: boolean;
  onPlayerSelect: (playerId: string) => void;
  onTimeExpired: () => void;
}

export function RevealView({
  currentRound,
  totalRounds,
  timerDuration,
  timerActive,
  currentMedia,
  players,
  selectedPlayer,
  disabled,
  onPlayerSelect,
  onTimeExpired,
}: RevealViewProps) {
  return (
    <View className="flex-1 bg-black">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="items-center mb-6">
          <Text className="text-white text-2xl font-bold mb-1">
            Round {currentRound} of {totalRounds}
          </Text>
          <Text className="text-gray-400 text-sm">Who took this photo?</Text>
        </View>

        <CountdownTimer
          duration={timerDuration}
          onComplete={onTimeExpired}
          isActive={timerActive}
        />

        {currentMedia && <MediaDisplay media={currentMedia} />}

        <PlayerSelection
          players={players}
          selectedPlayer={selectedPlayer}
          onSelect={onPlayerSelect}
          disabled={disabled}
        />
      </ScrollView>
    </View>
  );
}

