import { NextResponse } from "next/server";
import { admin, TABLE, isServerShareConfigured } from "@/flow-tool/lib/supabase-server";
import { hasRepKey, isRepKeyConfigured } from "@/flow-tool/lib/api-auth";

// Delete / update one proposal by code — rep-key gated.
export const dynamic = "force-dynamic";

export async function DELETE(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!isServerShareConfigured() || !isRepKeyConfigured())
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  if (!hasRepKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code } = await ctx.params;
  const { error } = await admin()!.from(TABLE).delete().eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Update a proposal's config IN PLACE — the share code (and anything the
// client already has) stays the same; they simply see the edited proposal on
// next open. Used by dashboard → Edit → "Update client link".
export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!isServerShareConfigured() || !isRepKeyConfigured())
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  if (!hasRepKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const config = body?.config;
  if (!config || typeof config !== "object")
    return NextResponse.json({ error: "config object required" }, { status: 400 });

  const { code } = await ctx.params;
  const { data, error } = await admin()!
    .from(TABLE)
    .update({
      config,
      client_name: typeof config.clientName === "string" ? config.clientName : null,
      client_rep: typeof config.clientRep === "string" ? config.clientRep : null,
    })
    .eq("code", code)
    .select("code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, code });
}
