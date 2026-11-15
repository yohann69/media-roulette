import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect } from "react";
import { Directory, Paths } from "expo-file-system";
import "../utils/i18n"; // Initialize i18n
import { DisconnectedModal } from "../components/molecules/DisconnectedModal";

/**
 * Downloaded game media (other players' photos) normally gets deleted when a
 * game ends. If the app was killed mid-game, remove the leftovers on next launch.
 */
function clearLeftoverGameMedia() {
  try {
    for (const entry of Paths.cache.list()) {
      if (entry instanceof Directory && entry.name.startsWith("game_")) {
        entry.delete();
      }
    }
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
        <Stack.Screen
          name="lobby"
          options={{
            headerShown: false,
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

