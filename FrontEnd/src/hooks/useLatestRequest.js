import { useCallback, useEffect, useRef } from "react";

// A component owns its read lifecycle. Abort superseded/unmounted requests and
// gate state changes, including adapters which finish after cancellation.
export default function useLatestRequest() {
  const active = useRef(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  return useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    return { signal: controller.signal, current: () => active.current === controller && !controller.signal.aborted };
  }, []);
}
