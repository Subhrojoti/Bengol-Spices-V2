import * as SecureStore from "expo-secure-store";

/* The celebration shown when a sales target is achieved or an incentive is
   earned: a burst of confetti over whatever screen the agent is on.

   Anything can ask for one with celebrate(); the overlay that draws it
   (components/ui/Confetti) listens here. Kept as a tiny subscription rather
   than app-wide state because it is an event, not something to remember. */

type Listener = () => void;

const listeners = new Set<Listener>();

export function onCelebrate(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function celebrate(): void {
  listeners.forEach((listener) => listener());
}

// SecureStore keys may hold letters, digits, ".", "-" and "_" only
const flagKey = (key: string) => `bengol_agent_celebrated_${key.replace(/[^A-Za-z0-9._-]/g, "_")}`;

/**
 * Celebrates the first time this phone sees a given achievement, and not
 * again: without it the confetti would fall every time the Targets tab was
 * opened for the rest of the month. `key` names the achievement, e.g.
 * "BS2026-001_2026-10_target".
 *
 * Returns whether it celebrated. If the phone's storage cannot be read it
 * stays quiet rather than repeating itself.
 */
export async function celebrateOnce(key: string): Promise<boolean> {
  try {
    const stored = flagKey(key);
    if (await SecureStore.getItemAsync(stored)) return false;
    await SecureStore.setItemAsync(stored, "1");
    celebrate();
    return true;
  } catch {
    return false;
  }
}
