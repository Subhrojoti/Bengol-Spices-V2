import { useState } from "react";

/**
 * The spinner of a list that is pulled down to refresh.
 *
 * Lists used to show it whenever their data was being read (`isFetching`).
 * The delivery and return lists re-read themselves on a timer, so the
 * spinner dropped into view, and pushed the list down, every time they did.
 * It now shows only for a pull, and for as long as that pull takes.
 *
 *   const { pulling, onPull } = usePullToRefresh(refetch);
 *   <FlatList refreshing={pulling} onRefresh={onPull} … />
 */
export function usePullToRefresh(...refetches: (() => Promise<unknown>)[]) {
  const [pulling, setPulling] = useState(false);

  const onPull = async () => {
    setPulling(true);
    try {
      await Promise.all(refetches.map((refetch) => refetch()));
    } finally {
      setPulling(false);
    }
  };

  return { pulling, onPull };
}
