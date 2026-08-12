import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { admin, TABLE } from "@/flow-tool/lib/supabase-server";
import { hasRepKey } from "@/flow-tool/lib/api-auth";

// Public read-by-code — the only anonymous data path. Returns exactly one flow's
// stored config, addressed by its unguessable share code.
//
// Design handoff 2c adds a gate and 1b adds analytics:
//  • 30-day expiry — links older than 30 days return 410;
//    (the former password gate is retired — links are open to anyone holding
//    the unguessable code; stored gatePassword values are ignored/stripped)
//  • view logging — successful client opens (not rep opens) record a row in
//    flow_views: timestamp, anonymized device hash, geo-IP country/city from
//    Vercel's request headers. Logging must never break the read path.
export const dynamic = "force-dynamic";

const EXPIRY_DAYS = 30;

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const sb = admin();
  if (!sb) return NextResponse.json({ error: "unconfigured" }, { status: 503 });

  // Resolve by code first, then by the client-named slug alias (/nuvera-k4x2).
  // Analytics and expiry always use the ROW's code, whichever form matched.
  let { data, error } = await sb
    .from(TABLE)
    .select("code, config, created_at")
    .eq("code", code)
    .maybeSingle();
  if (!error && !data) {
    ({ data, error } = await sb
      .from(TABLE)
      .select("code, config, created_at")
      .eq("config->>slug", code)
      .maybeSingle());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const isRep = hasRepKey(req);
  const config = (data.config ?? {}) as Record<string, unknown>;

  // 30-day expiry (rep access bypasses so the dashboard can still open/manage)
  if (!isRep && data.created_at) {
    const age = Date.now() - new Date(data.created_at).getTime();
    if (age > EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }
  }

  // The password gate is retired: anyone holding the link may open it
  // (stored gatePassword values are stripped from the response below).

  // view analytics — client opens only; never let logging break the read
  if (!isRep) {
    try {
      const h = req.headers;
      const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
      const ua = h.get("user-agent") ?? "";
      const deviceHash = createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 16);
      const country = h.get("x-vercel-ip-country") ?? null;
      const city = h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null;
      await sb.from("flow_views").insert({ code: data.code, device_hash: deviceHash, country, city });
    } catch {
      /* table missing or insert failed — analytics are best-effort */
    }
  }

  // never ship the gate password to the browser
  const { gatePassword: _gp, ...clientConfig } = config;
  void _gp;
  return NextResponse.json({ config: clientConfig }, { headers: { "cache-control": "no-store" } });
}
