import { NextResponse } from "next/server";
import { hasRepKey } from "@/flow-tool/lib/api-auth";

// Rep-gated image proxy for the logo drop zone: lets a rep drag a logo
// straight from another website tab without downloading it first (the browser
// hands us the image URL; fetching it client-side would die on CORS). Images
// only, size-capped, and never private/internal hosts.

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h.startsWith("[")) return true;
  return false;
}

export async function GET(req: Request) {
  if (!hasRepKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:")
    return NextResponse.json({ error: "http(s) only" }, { status: 400 });
  if (isPrivateHost(target.hostname)) return NextResponse.json({ error: "host not allowed" }, { status: 400 });

  try {
    const res = await fetch(target, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh) trace-flow-logo/1.0", accept: "image/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return NextResponse.json({ error: `not an image (${type})` }, { status: 415 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "image too large" }, { status: 413 });
    return new NextResponse(buf, {
      headers: { "content-type": type, "cache-control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 120) }, { status: 502 });
  }
}
