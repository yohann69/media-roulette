import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useSocket } from "../stores/useSocket";

interface UseGameEventsProps {
  onNewRound: (data: any) => void;
  onRoundResult: (data: any) => void;
  onGameFinished: (data: any) => void;
}

export function useGameEvents({
  onNewRound,
  onRoundResult,
  onGameFinished,
}: UseGameEventsProps) {
  const router = useRouter();
  const { onNewRound: socketOnNewRound, onRoundResult: socketOnRoundResult, onGameFinished: socketOnGameFinished, onRoomDeleted } = useSocket();

  useEffect(() => {
    socketOnNewRound(onNewRound);
    socketOnRoundResult(onRoundResult);
    socketOnGameFinished(onGameFinished);
    onRoomDeleted(() => {
      router.push("/");
    });
  }, [socketOnNewRound, socketOnRoundResult, socketOnGameFinished, onRoomDeleted, router, onNewRound, onRoundResult, onGameFinished]);
}

