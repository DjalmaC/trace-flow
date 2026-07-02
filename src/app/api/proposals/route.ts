import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { admin, TABLE, isServerShareConfigured } from "@/flow-tool/lib/supabase-server";
import { hasRepKey, isRepKeyConfigured } from "@/flow-tool/lib/api-auth";

// Privileged proposal collection: list (GET) + create a share link (POST).
// Both require the shared rep key. Anonymous clients never reach this route;
// they only read a single flow via /api/flow/[code].
export const dynamic = "force-dynamic";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars
function makeCode(len = 9): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function guard(req: Request): NextResponse | null {
  if (!isServerShareConfigured() || !isRepKeyConfigured())
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  if (!hasRepKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

/** Per-code view analytics, aggregated for the dashboard (design handoff 1b). */
export interface ViewStats {
  views: number;
  uniqueDevices: number;
  lastViewedAt: string | null;
  firstViewedAt: string | null;
  locations: { country: string; cities: string[] }[];
}

export async function GET(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const sb = admin()!;

  // Project ONLY what the dashboard renders. Pulling whole configs dragged
  // every logo data URI, variant list, and pricing object (and the gate
  // password) out of Supabase and into the browser — multi-MB and ~5s for a
  // few dozen rows. The logo is still needed for the client plate; the rest of
  // the config stays in the database until a row is actually opened.
  const { data, error } = await sb
    .from(TABLE)
    .select(
      "code, client_name, client_rep, created_at, " +
        "logo:config->>clientLogoUrl, plate:config->>clientLogoPlate, " +
        "ptype:config->>proposalType, pdate:config->>date, rep_id:config->>traceRepId, " +
        "sandbox:config->>sandbox",
    )
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Legacy rows carry uncapped logo data URIs (up to ~2MB each — 19MB for one
  // list load). New uploads are capped client-side (lib/logo cappedDataUrl);
  // for old rows we drop the logo here and let the dashboard fall back to
  // initials rather than ship megabytes for a 44×34 plate.
  const MAX_LIST_LOGO = 400_000;
  for (const r of (data ?? []) as { logo?: string | null }[]) {
    if (r.logo && r.logo.length > MAX_LIST_LOGO) r.logo = null;
  }

  // View analytics are best-effort: if flow_views doesn't exist yet the
  // dashboard simply renders without them.
  const analytics: Record<string, ViewStats> = {};
  const { data: views } = await sb
    .from("flow_views")
    .select("code, viewed_at, device_hash, country, city")
    .order("viewed_at", { ascending: false })
    .limit(5000);
  for (const v of views ?? []) {
    const a = (analytics[v.code] ??= {
      views: 0,
      uniqueDevices: 0,
      lastViewedAt: null,
      firstViewedAt: null,
      locations: [],
    });
    a.views++;
    a.lastViewedAt = a.lastViewedAt ?? v.viewed_at; // rows arrive newest-first
    a.firstViewedAt = v.viewed_at;
    if (v.country) {
      let loc = a.locations.find((l) => l.country === v.country);
      if (!loc) a.locations.push((loc = { country: v.country, cities: [] }));
      if (v.city && !loc.cities.includes(v.city)) loc.cities.push(v.city);
    }
  }
  // unique devices per code
  const devs: Record<string, Set<string>> = {};
  for (const v of views ?? []) {
    if (v.device_hash) (devs[v.code] ??= new Set()).add(v.device_hash);
  }
  for (const code of Object.keys(analytics)) analytics[code].uniqueDevices = devs[code]?.size ?? 0;

  return NextResponse.json({ rows: data ?? [], analytics }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const sb = admin()!;

  let config: Record<string, unknown>;
  try {
    const body = await req.json();
    config = body?.config;
    if (!config || typeof config !== "object") throw new Error("bad config");
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // retry on the (extremely unlikely) code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    const { error } = await sb.from(TABLE).insert({
      code,
      config,
      client_name: (config.clientName as string) ?? null,
      client_rep: (config.clientRep as string) ?? null,
    });
    if (!error) return NextResponse.json({ code });
    if ((error as { code?: string }).code !== "23505")
      return NextResponse.json({ error: error.message || "insert failed" }, { status: 500 });
  }
  return NextResponse.json({ error: "could not allocate a unique code" }, { status: 500 });
}
