import type { ProposalSetup } from "../data/schema";

// The intro page (/new) writes the salesperson-private setup here; the flow
// generator (/) reads it on mount. sessionStorage survives the client-side
// navigation between the two but doesn't leak across browser sessions.

const KEY = "tf:proposal-setup";

export function saveSetup(setup: ProposalSetup): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(setup));
  } catch {
    /* private mode / quota — setup just won't carry over */
  }
}

export function loadSetup(): ProposalSetup | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProposalSetup) : null;
  } catch {
    return null;
  }
}

export function clearSetup(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Current month/year as the default title-slide date, e.g. "June 2026". */
export function defaultProposalDate(now = new Date()): string {
  return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
