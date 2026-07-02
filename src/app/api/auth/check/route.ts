import { NextResponse } from "next/server";
import { hasRepKey } from "@/flow-tool/lib/api-auth";

// Sign-in validation for the rep login screen: 200 when the x-tf-key header
// carries a valid rep password, 401 otherwise. Grants nothing by itself.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hasRepKey(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}
