import { useState } from "react";

/**
 * The spinner of a list that is pulled down to refresh.
 *
 * Lists used to show it whenever their data was being read (`isFetching`),
 * so it also dropped into view, and pushed the list down, each time the app
 * quietly brought something up to date: after an order, on coming back to a
 * tab, on the timed refresh of an order on its way. It now shows only for a
 * pull, and for as long as that pull takes.
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
