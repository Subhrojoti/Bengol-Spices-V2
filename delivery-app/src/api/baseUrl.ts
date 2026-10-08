/**
 * Where the API lives, decided in one place.
 *
 * While developing, it is whatever EXPO_PUBLIC_API_URL in .env says, usually
 * this computer's address on the Wi-Fi (http://192.168.x.x:8000) so a phone
 * can reach the backend running here.
 *
 * In an installed build (an APK), that address is baked in when the app is
 * built. A Wi-Fi address left in .env would ship an app that can only work
 * on one office network, and that Android refuses to call anyway because it
 * is not https. So an installed build only accepts an https address; given
 * anything else, or nothing, it uses the live API.
 */
const LIVE_API_URL = "https://api.bengolspices.com";

const configured = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

function resolveApiUrl(): string {
  if (__DEV__) {
    if (!configured) {
      console.warn(
        "[api] EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set it. " +
          "Falling back to http://localhost:5000, which will NOT work on a physical device.",
      );
      return "http://localhost:5000";
    }
    return configured;
  }

  return /^https:\/\//i.test(configured) ? configured : LIVE_API_URL;
}

export const API_URL = resolveApiUrl();
