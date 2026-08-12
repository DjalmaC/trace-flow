import "server-only";
import type { Metadata } from "next";
import { admin, findShareRow } from "./supabase-server";

// The link preview (WhatsApp / iMessage / Slack unfurl) for a shared proposal:
// "Trace Flow - A funds flow presentation tailored to {Client}". The client's
// name comes from the row; a nameless row (logo-as-name links) falls back to
// the slug's name part ("meta-z99mee" -> "Meta"). Unknown or unresolvable keys
// keep a generic preview - the crawler never learns whether a link exists.

function nameFromSlug(key: string | null): string | null {
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
  return {
    title,
    description,
    openGraph: { title, description, siteName: "Trace Finance", type: "website" },
    twitter: { card: "summary", title, description },
  };
}
