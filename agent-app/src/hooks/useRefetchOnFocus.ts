import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Brings a screen's data up to date when the screen comes back into view.
 *
 * Tabs and the screens under them stay mounted, so going back to one does
 * not load anything by itself: it showed whatever it had when it was last
 * open. This re-reads the named data on return, but only what has gone
 * stale (30 seconds old by default), so flicking between tabs costs nothing.
 * The first time a screen opens its own queries load it; this does nothing
 * then.
 *
 *   useRefetchOnFocus(["orders"], ["stores"]);
 */
export function useRefetchOnFocus(...keys: QueryKey[]) {
  const queryClient = useQueryClient();
  const opened = useRef(false);
  // The keys are written inline by callers; their text is what identifies them
  const signature = JSON.stringify(keys);

  useFocusEffect(
    useCallback(() => {
      if (!opened.current) {
        opened.current = true;
        return;
      }
      for (const queryKey of JSON.parse(signature) as QueryKey[]) {
        queryClient.refetchQueries({ queryKey, stale: true, type: "active" });
      }
    }, [queryClient, signature]),
  );
}
