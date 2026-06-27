import type { TraceRep } from "../data/schema";
import { getRep } from "../data/reps";

// Who's logged in. This is identity, not security — an internal sales tool. The
// chosen rep persists across sessions (localStorage) so it's picked once; the
// dashboard exposes a "Switch" control that clears it.

const KEY = "tf:rep-id";

export function saveRepId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode — identity just won't persist */
  }
}

export function loadRepId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function loadRep(): TraceRep | undefined {
  return getRep(loadRepId() ?? undefined);
}

export function clearRepId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
