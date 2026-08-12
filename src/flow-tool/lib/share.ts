import type { FlowConfig } from "../data/schema";
import { loadRepKey } from "./rep-session";

// Client-side share API. All privileged work (create / list / delete) is
// mediated by server routes under /api that hold the Supabase service-role key
// and require the shared rep password; the browser never sees the service key
// and no longer bundles the Supabase SDK. The only anonymous path is reading a
// single flow by its unguessable code (/api/flow/<code>), used by /f/<code>.

const REP_KEY_HEADER = "x-tf-key";

/** Sharing UI is offered when the deploy advertises it (server holds the keys). */
export function isShareConfigured(): boolean {
  return process.env.NEXT_PUBLIC_SHARE_ENABLED === "1";
}

/** Validate a rep password against the server (login screen). */
export async function checkRepKey(key: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/check", { headers: { [REP_KEY_HEADER]: key }, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

function authHeaders(): HeadersInit {
  const key = loadRepKey();
  return key ? { [REP_KEY_HEADER]: key } : {};
}

async function asError(res: Response, fallback: string): Promise<Error> {
  if (res.status === 401) return new Error("Your rep password is missing or incorrect. Sign in again.");
  if (res.status === 503) return new Error("Sharing is not configured on the server.");
  let msg = fallback;
  try {
    const body = await res.json();
    if (body?.error && typeof body.error === "string") msg = body.error;
  } catch {
    /* keep fallback */
  }
  return new Error(msg);
}

/** Persist the drafted config server-side and return its share code plus the
 *  client-named slug alias ("nuvera-k4x2") the pretty link uses. */
export async function createShareLink(config: FlowConfig): Promise<{ code: string; slug?: string | null }> {
  const res = await fetch("/api/proposals", {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw await asError(res, "Could not create the share link.");
  return res.json();
}

/** The public URL a proposal is shared on: the branded origin when configured
 *  (NEXT_PUBLIC_SHARE_ORIGIN, e.g. https://flow.trace.finance), else wherever
 *  the app runs; the client-named slug at the root when the row has one, else
 *  the classic /f/<code>. Old /f/ links keep working either way. */
export function shareUrl(row: { code: string; slug?: string | null }): string {
  const origin =
    process.env.NEXT_PUBLIC_SHARE_ORIGIN?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return row.slug ? `${origin}/${row.slug}` : `${origin}/f/${row.code}`;
}

/** Update an existing proposal's config in place — the code, the slug and the
 *  link the client already holds stay the same; they see the edit on next
 *  open. Returns the row's slug so callers can re-surface the pretty URL. */
export async function updateShareLink(code: string, config: FlowConfig): Promise<{ slug?: string | null }> {
  const res = await fetch(`/api/proposals/${encodeURIComponent(code)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...authHeaders() },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw await asError(res, "Could not update the proposal.");
  return res.json();
}

/** Outcome of a public flow read — the /f/ page renders each state distinctly. */
export type SharedFlowResult =
  | { status: "ok"; config: FlowConfig }
  | { status: "notfound" }
  | { status: "locked" } // gate present, no password supplied yet
  | { status: "wrong-password" }
  | { status: "expired" };

/** Load a shared flow by its code. Sends the rep key when present (rep opens
 *  bypass the gate/expiry and are excluded from view analytics). */
export async function loadSharedFlowGated(code: string, pw?: string): Promise<SharedFlowResult> {
  const q = pw ? `?pw=${encodeURIComponent(pw)}` : "";
  const res = await fetch(`/api/flow/${encodeURIComponent(code)}${q}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (res.status === 404) return { status: "notfound" };
  if (res.status === 401) return { status: "locked" };
  if (res.status === 403) return { status: "wrong-password" };
  if (res.status === 410) return { status: "expired" };
  if (res.status === 503) throw new Error("Sharing is not configured.");
  if (!res.ok) throw await asError(res, "Could not load this flow.");
  const body = await res.json();
  return { status: "ok", config: body.config as FlowConfig };
}

/** Back-compat convenience for internal callers (dashboard PDF rebuild). */
export async function loadSharedFlow(code: string): Promise<FlowConfig | null> {
  const r = await loadSharedFlowGated(code);
  return r.status === "ok" ? r.config : null;
}

// ── Dashboard: list + delete past proposals ─────────────────────────────────

export interface ViewStats {
  views: number;
  uniqueDevices: number;
  lastViewedAt: string | null;
  firstViewedAt: string | null;
  locations: { country: string; cities: string[] }[];
}

export interface ProposalRecord {
  code: string;
  /** Client-named link alias ("nuvera-k4x2") — the URL that ships to clients. */
  slug?: string | null;
  clientName: string;
  clientRep: string | null;
  clientLogoUrl?: string;
  clientLogoPlate?: "light" | "none";
  proposalType?: string;
  date?: string;
  traceRepId?: string;
  createdAt: string;
  /** Pipeline status derived server-side data: draft (no link opens), shared, viewed. */
  stats?: ViewStats;
  /** Sandbox links stay off the pipeline (separate dashboard tab). */
  sandbox?: boolean;
}

// The list endpoint projects config fields server-side (logo/plate/type/date/
// rep) instead of shipping whole configs — see /api/proposals.
type RawRow = {
  code: string;
  slug?: string | null;
  client_name?: string | null;
  client_rep?: string | null;
  created_at: string;
  logo?: string | null;
  plate?: string | null;
  ptype?: string | null;
  pdate?: string | null;
  rep_id?: string | null;
  sandbox?: string | null; // jsonb boolean arrives as "true"
};

/** All saved proposals, newest first. Optionally scoped to one Trace rep. */
export async function listProposals(traceRepId?: string): Promise<ProposalRecord[]> {
  const res = await fetch("/api/proposals", { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw await asError(res, "Could not load proposals.");
  const body = await res.json();
  const analytics = (body.analytics ?? {}) as Record<string, ViewStats>;
  const rows = ((body.rows ?? []) as RawRow[]).map(
    (r): ProposalRecord => ({
      code: r.code,
      slug: r.slug ?? null,
      clientName: r.client_name || "Untitled",
      clientRep: r.client_rep ?? null,
      clientLogoUrl: r.logo ?? undefined,
      clientLogoPlate: (r.plate as "light" | "none" | null) ?? undefined,
      proposalType: r.ptype ?? undefined,
      date: r.pdate ?? undefined,
      traceRepId: r.rep_id ?? undefined,
      createdAt: r.created_at,
      stats: analytics[r.code],
      sandbox: r.sandbox === "true",
    }),
  );
  return traceRepId ? rows.filter((r) => r.traceRepId === traceRepId) : rows;
}

/** Delete one proposal by its code (rep-key gated). */
export async function deleteProposal(code: string): Promise<void> {
  const res = await fetch(`/api/proposals/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw await asError(res, "Could not delete this proposal.");
}
