import { useEffect } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { focusManager } from "@tanstack/react-query";

export function useReactQueryAppStateFocus() {
  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      if (Platform.OS !== "web") {
        focusManager.setFocused(status === "active");
      }
    };
    const subscription = AppState.addEventListener("change", onChange);
    return () => subscription.remove();
  }, []);
}
