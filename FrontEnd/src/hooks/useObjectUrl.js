import { useMemo, useSyncExternalStore } from "react";

const empty = () => "";
export default function useObjectUrl(file) {
  const resource = useMemo(() => {
    let url = "", subscribers = 0;
    return {
      snapshot: () => url,
      subscribe: (changed) => {
        subscribers++;
        if (file && !url) { url = URL.createObjectURL(file); changed(); }
        return () => {
          subscribers--;
          if (!subscribers && url) { URL.revokeObjectURL(url); url = ""; }
        };
      },
    };
  }, [file]);
  return useSyncExternalStore(resource.subscribe, resource.snapshot, empty);
}
