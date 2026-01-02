import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

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
      />
    </>
  );
}

