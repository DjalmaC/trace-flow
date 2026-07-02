import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { admin, TABLE } from "@/flow-tool/lib/supabase-server";
import { hasRepKey } from "@/flow-tool/lib/api-auth";

// Public read-by-code — the only anonymous data path. Returns exactly one flow's
// stored config, addressed by its unguessable share code.
//
// Design handoff 2c adds two gates and 1b adds analytics:
//  • password gate — links created with `gatePassword` in the config (auto-set
//    to the client's company name at share time) require ?pw= to match;
//  • 30-day expiry — links older than 30 days return 410;
//  • view logging — successful client opens (not rep opens) record a row in
//    flow_views: timestamp, anonymized device hash, geo-IP country/city from
//    Vercel's request headers. Logging must never break the read path.
export const dynamic = "force-dynamic";

const EXPIRY_DAYS = 30;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const sb = admin();
  if (!sb) return NextResponse.json({ error: "unconfigured" }, { status: 503 });

  const { data, error } = await sb
    .from(TABLE)
    .select("config, created_at")
    .eq("code", code)
    .maybeSingle();
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

  // password gate (only for links that carry one; legacy links stay open)
  const gate = typeof config.gatePassword === "string" ? config.gatePassword : "";
  if (gate && !isRep) {
    const pw = new URL(req.url).searchParams.get("pw") ?? "";
    if (!pw) return NextResponse.json({ error: "locked" }, { status: 401 });
    if (norm(pw) !== norm(gate)) {
      return NextResponse.json({ error: "wrong-password" }, { status: 403 });
    }
  }

  // view analytics — client opens only; never let logging break the read
  if (!isRep) {
    try {
      const h = req.headers;
      const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
      const ua = h.get("user-agent") ?? "";
      const deviceHash = createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 16);
      const country = h.get("x-vercel-ip-country") ?? null;
      const city = h.get("x-vercel-ip-city") ? decodeURIComponent(h.get("x-vercel-ip-city")!) : null;
      await sb.from("flow_views").insert({ code, device_hash: deviceHash, country, city });
    } catch {
      /* table missing or insert failed — analytics are best-effort */
    }
  }

  // never ship the gate password to the browser
  const { gatePassword: _gp, ...clientConfig } = config;
  void _gp;
  return NextResponse.json({ config: clientConfig }, { headers: { "cache-control": "no-store" } });
}
