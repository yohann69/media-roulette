import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../utils/i18n"; // Initialize i18n

export default function RootLayout() {
  // Force dark mode - app is always in dark mode

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#000000",
          },
          headerTintColor: "#ffffff",
          contentStyle: {
            backgroundColor: "#000000",
          },
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
            title: "Create Game",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="join"
          options={{
            title: "Join Game",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="selection"
          options={{
            title: "Select Media",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="game"
          options={{
            title: "Game",
            headerBackTitle: "Back",
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

