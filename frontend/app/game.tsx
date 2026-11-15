import { View } from "react-native";
import { GameScreen } from "../features/game/GameScreen";
import { ReactionLayer } from "../components/molecules/Reactions";

export default function Game() {
  return (
    <View style={{ flex: 1 }}>
      <GameScreen />
      <ReactionLayer />
    </View>
  );
}
