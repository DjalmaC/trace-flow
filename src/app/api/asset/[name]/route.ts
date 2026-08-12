import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { admin, findShareRow } from "@/flow-tool/lib/supabase-server";
import { hasRepKey } from "@/flow-tool/lib/api-auth";

// Gated delivery of the internal PDFs (the team contact deck + curated client
// proposals). These used to sit in /public where anyone could crawl them; now
// they live in /private-assets and are served only to:
//   • a logged-in rep (correct x-tf-key header), or
//   • a client holding a real share code (?code=<code> that exists in the DB).
// Both the dashboard deck build and the public /f/ "Download Proposal" flow go
// through here — the client passes its own code, the rep passes the key.
export const dynamic = "force-dynamic";

// Allowlist: only these basenames are ever served, so `name` can't traverse.
const ALLOWED = new Set(["sales-slides.pdf", "arq-proposal-june-2026.pdf"]);

async function codeExists(code: string): Promise<boolean> {
  // accepts the share code OR its client-named slug alias — the /f/ page
  // passes back whichever form the viewer opened
  const sb = admin();
  if (!sb || !code) return false;
  const { data } = await findShareRow(sb, "code", code);
  return !!data;
}

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!ALLOWED.has(name)) return NextResponse.json({ error: "notfound" }, { status: 404 });

  const code = new URL(req.url).searchParams.get("code") ?? "";
  const authorized = hasRepKey(req) || (await codeExists(code));
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(process.cwd(), "private-assets", name));
  } catch {
    return NextResponse.json({ error: "missing asset" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
