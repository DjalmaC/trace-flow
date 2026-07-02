import { NextResponse } from "next/server";
import { admin, TABLE, isServerShareConfigured } from "@/flow-tool/lib/supabase-server";
import { hasRepKey, isRepKeyConfigured } from "@/flow-tool/lib/api-auth";

// Delete one proposal by code — rep-key gated.
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
