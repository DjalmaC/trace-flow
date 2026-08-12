import { NextResponse, type NextRequest } from "next/server";

// Site gate for the rep-facing pages. Everything a CLIENT touches stays open —
// /f/<code>, the root /<slug> links, /api/* (each route carries its own auth),
// and static assets — but the internal tool (the "Who's presenting?" sign-in,
// dashboard, builder) is invisible until the visitor unlocks it with a rep
// password at /gate. The cookie is a hash derived from TRACE_REP_KEY, so
// rotating that env var invalidates every unlocked browser at once.
//
// Matcher note: the root "/" matches EXACTLY (client slugs live at /<slug>
// and never contain a bare root path), so gating "/" does not gate the links.

const GATE_COOKIE = "tf_gate";

async function gateToken(): Promise<string | null> {
  const secret = process.env.TRACE_REP_KEY;
  if (!secret) return null; // sharing not configured (bare local dev) — nothing to gate with
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tf-gate-v1:${secret}`));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const expected = await gateToken();
  if (!expected) return NextResponse.next();
  if (req.cookies.get(GATE_COOKIE)?.value === expected) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/build/:path*", "/new/:path*", "/logo-lab/:path*"],
};
