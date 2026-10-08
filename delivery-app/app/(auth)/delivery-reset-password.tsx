import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * The backend's reset email links to `<FRONTEND_URL>/delivery-reset-password?token=…`.
 * When that URL opens the app (universal/app link or the app scheme), land on
 * the reset screen with the token intact.
 */
export default function DeliveryResetPasswordRedirect() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <Redirect href={{ pathname: "/(auth)/reset-password", params: token ? { token } : {} }} />;
}
