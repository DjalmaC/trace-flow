import "server-only";
import type { Metadata } from "next";
import { admin, findShareRow } from "./supabase-server";

// The link preview (WhatsApp / iMessage / Slack unfurl) for a shared proposal:
// "Trace Flow - A funds flow presentation tailored to {Client}". The client's
// name comes from the row; a nameless row (logo-as-name links) falls back to
// the slug's name part ("meta-z99mee" -> "Meta"). Unknown or unresolvable keys
// keep a generic preview - the crawler never learns whether a link exists.

export function nameFromSlug(key: string | null): string | null {
  const m = key?.match(/^([a-z0-9-]+)-[a-z0-9]{4,12}$/);
  if (!m) return null;
  const words = m[1].split("-").filter(Boolean);
  if (!words.length) return null;
  return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export async function sharedLinkMetadata(key: string): Promise<Metadata> {
  let name: string | null = null;
  try {
    const sb = admin();
    if (sb) {
      const { data } = await findShareRow(sb, "client_name, slug:config->>slug", key);
      if (data) {
        name =
          (data.client_name as string | null)?.trim() ||
          nameFromSlug((data.slug as string | null) ?? key) ||
          nameFromSlug(key);
      }
    }
  } catch {
    /* generic preview */
  }
  const title = name
    ? `Trace Flow - A funds flow presentation tailored to ${name}`
    : "Trace Flow - A funds flow presentation";
  const description = "Prepared by Trace Finance.";
  // The preview card (/api/og/<key>): Trace × client on the site's silk-dark
  // backdrop. Crawlers need an absolute URL; the branded origin wins, then
  // the deployment's own host, then local dev.
  const origin =
    process.env.NEXT_PUBLIC_SHARE_ORIGIN?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const image = { url: `${origin}/api/og/${encodeURIComponent(key)}`, width: 1200, height: 630, alt: title };
  return {
    title,
    description,
    // Client links are the customer-facing surface: they carry the full-color
    // tab mark, overriding the root layout's gray internal-tab default.
    icons: { icon: "/assets/trace_icon.png" },
    openGraph: { title, description, siteName: "Trace Finance", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}
