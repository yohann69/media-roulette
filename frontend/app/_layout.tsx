import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { clearAllGameMedia } from "../utils/gameMedia";
import "../utils/i18n"; // Initialize i18n
import { DisconnectedModal } from "../components/molecules/DisconnectedModal";

/**
 * Game media (other players' decrypted photos, our prepared copies) is deleted
 * when a game ends. If the app was killed mid-game, remove the leftovers on launch.
 */
function clearLeftoverGameMedia() {
  try {
    clearAllGameMedia();
  } catch (error) {
    console.warn("Could not clear leftover game media:", error);
  }
}

export default function RootLayout() {
  // Force dark mode - app is always in dark mode
  // Keep the screen awake app-wide so a locked phone doesn't kick players out mid-game.
  useKeepAwake();

  useEffect(() => {
    clearLeftoverGameMedia();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: "#000000" },
          headerTintColor: "#ffffff",
          contentStyle: { backgroundColor: "#000000" },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        {/* No swipe-back out of a lobby or a running game: leaving goes through a confirmation. */}
        <Stack.Screen
          name="lobby"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="selection"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="game"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{}}
        />
        <Stack.Screen
          name="terms"
          options={{}}
        />
        <Stack.Screen
          name="privacy"
          options={{}}
        />
      </Stack>
      <DisconnectedModal />
    </>
  );
}

