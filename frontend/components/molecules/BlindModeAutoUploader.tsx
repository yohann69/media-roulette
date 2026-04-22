import { useSelectionScreenLogic } from "../../features/selection/useSelectionScreenLogic";

interface BlindModeAutoUploaderProps {
  pin: string;
  isHost: boolean;
}

// Runs the existing selection logic (fetch photos, auto-compress, auto-upload)
// without rendering any UI. Used in blind mode so the selection modal never
// flashes on screen while the device silently prepares the media pool.
export function BlindModeAutoUploader({ pin, isHost }: BlindModeAutoUploaderProps) {
  useSelectionScreenLogic(
    { isHost: isHost ? "true" : "false", pin },
    // no-op onClose — we're already on the lobby route, no navigation needed
    () => {}
  );
  return null;
}
