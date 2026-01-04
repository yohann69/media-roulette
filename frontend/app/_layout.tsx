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
          headerShown: false,
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
      </Stack>
    </>
  );
}

