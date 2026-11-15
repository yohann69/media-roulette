import { Redirect, useLocalSearchParams } from "expo-router";

// Deep link target for the lobby QR code (mediaroulette://join?pin=123456).
// Sends the player to the home screen with the join form prefilled.
export default function JoinRoute() {
  const { pin } = useLocalSearchParams<{ pin?: string }>();
  const validPin = pin && /^\d{6}$/.test(pin) ? pin : undefined;
  return <Redirect href={validPin ? { pathname: "/", params: { joinPin: validPin } } : "/"} />;
}
