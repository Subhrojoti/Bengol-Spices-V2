import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

/** Update date-sensitive lists without refetching all orders or running a
 * clock on hidden tabs. Refresh immediately when the phone resumes. */
export function useVisibleClock() {
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    const update = () => { if (AppState.currentState === "active") setNow(Date.now()); };
    update();
    const timer = setInterval(update, 60000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") setNow(Date.now()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []));
  return now;
}
