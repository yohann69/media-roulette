import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useSocket } from "../stores/useSocket";

interface UseGameEventsProps {
  onNewRound: (data: any) => void;
  onRoundResult: (data: any) => void;
  onGameFinished: (data: any) => void;
  onShowMediaAgain?: (data: any) => void;
  onHideMediaAgain?: () => void;
}

export function useGameEvents({
  onNewRound,
  onRoundResult,
  onGameFinished,
  onShowMediaAgain,
  onHideMediaAgain,
}: UseGameEventsProps) {
  const router = useRouter();
  const { 
    onNewRound: socketOnNewRound, 
    onRoundResult: socketOnRoundResult, 
    onGameFinished: socketOnGameFinished, 
    onRoomDeleted,
    onShowMediaAgain: socketOnShowMediaAgain,
    onHideMediaAgain: socketOnHideMediaAgain
  } = useSocket();

  useEffect(() => {
    socketOnNewRound(onNewRound);
    socketOnRoundResult(onRoundResult);
    socketOnGameFinished(onGameFinished);
    
    if (onShowMediaAgain) {
        socketOnShowMediaAgain(onShowMediaAgain);
    }
    
    if (onHideMediaAgain) {
        socketOnHideMediaAgain(onHideMediaAgain);
    }

    onRoomDeleted(() => {
      router.push("/");
    });
  }, [
    socketOnNewRound, 
    socketOnRoundResult, 
    socketOnGameFinished, 
    socketOnShowMediaAgain,
    socketOnHideMediaAgain,
    onRoomDeleted, 
    router, 
    onNewRound, 
    onRoundResult, 
    onGameFinished,
    onShowMediaAgain,
    onHideMediaAgain
  ]);
}
