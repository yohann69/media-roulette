import { View, Text, Animated, TouchableOpacity } from "react-native";
import { useEffect, useRef } from "react";

interface PlayerScore {
  playerId: string;
  playerName: string;
  totalScore: number;
  roundScore: number;
  timeTaken: number | null; // in ms, null if wrong/no answer
}

interface InterimLeaderboardProps {
  visible: boolean;
  players: PlayerScore[];
  onContinue: () => void;
}

export function InterimLeaderboard({
  visible,
  players,
  onContinue,
}: InterimLeaderboardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [visible, fadeAnim, slideAnim]);

  // Sort players by total score (descending)
  const sortedPlayers = [...players].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  // Find fastest correct answer
  const fastestPlayer = sortedPlayers
    .filter((p) => p.timeTaken !== null && p.roundScore > 0)
    .sort((a, b) => (a.timeTaken || Infinity) - (b.timeTaken || Infinity))[0];

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
      className="absolute inset-0 bg-black/90 justify-center items-center z-50"
    >
      <View className="bg-gray-800 rounded-3xl p-6 w-full max-w-md mx-4">
        <Text className="text-white text-3xl font-bold mb-6 text-center">
          Round Results
        </Text>

        <View className="gap-3 mb-6">
          {sortedPlayers.map((player, index) => {
            const isFastest =
              fastestPlayer && player.playerId === fastestPlayer.playerId;
            const showScoreAnimation = player.roundScore > 0;

            return (
              <View
                key={player.playerId}
                className={`flex-row items-center justify-between py-3 px-4 rounded-xl ${
                  index === 0
                    ? "bg-primary/20 border-2 border-primary"
                    : "bg-gray-700"
                }`}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-8 items-center mr-3">
                    {index === 0 && (
                      <Text className="text-primary text-xl">🥇</Text>
                    )}
                    {index === 1 && (
                      <Text className="text-gray-400 text-xl">🥈</Text>
                    )}
                    {index === 2 && (
                      <Text className="text-orange-600 text-xl">🥉</Text>
                    )}
                    {index > 2 && (
                      <Text className="text-gray-500 text-sm">
                        #{index + 1}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-white text-lg font-semibold">
                        {player.playerName}
                      </Text>
                      {isFastest && (
                        <Text className="text-yellow-400 text-sm ml-2">
                          ⚡ Fastest
                        </Text>
                      )}
                    </View>
                    <Text className="text-gray-400 text-sm">
                      {player.totalScore.toLocaleString()} pts
                    </Text>
                  </View>
                </View>
                {showScoreAnimation && (
                  <ScoreAnimation score={player.roundScore} />
                )}
              </View>
            );
          })}
        </View>

        <View className="mt-4">
          <TouchableOpacity
            className="bg-primary py-4 px-6 rounded-xl items-center"
            onPress={onContinue}
          >
            <Text className="text-white text-lg font-bold">Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

function ScoreAnimation({ score }: { score: number }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      <Text className="text-green-400 text-lg font-bold">
        +{score.toLocaleString()}
      </Text>
    </Animated.View>
  );
}

