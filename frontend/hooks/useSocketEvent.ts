import { useEffect, useRef } from "react";
import { useSocket } from "../stores/useSocket";

/**
 * Listens to a server event while the component is mounted.
 * The listener is registered once and always calls the latest `handler`,
 * so re-renders never stack up duplicate listeners.
 */
export function useSocketEvent<T = any>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const socket = useSocket((s) => s.socket);

  useEffect(() => {
    if (!socket) return;
    const listener = (data: T) => handlerRef.current(data);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
