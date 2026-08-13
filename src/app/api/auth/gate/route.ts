import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { hasRepKey } from "@/flow-tool/lib/api-auth";

// Unlocks the site gate (src/middleware.ts): a valid rep password (or the
// master key) in x-tf-key sets the tf_gate cookie the middleware checks.
// The cookie value is sha256("tf-gate-v1:" + TRACE_REP_KEY) — the same token
// the middleware derives — so no session state is stored anywhere.
export const dynamic = "force-dynamic";

const NINETY_DAYS = 60 * 60 * 24 * 90;

export async function POST(req: Request) {
  if (!hasRepKey(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const secret = process.env.TRACE_REP_KEY;
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  const token = createHash("sha256").update(`tf-gate-v1:${secret}`).digest("hex");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("tf_gate", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: NINETY_DAYS,
  });
  return res;
}
