import { isPrivateHost } from "../lib/net-guard";

// Server twin of scripts/agent/logo-ladder.mjs: probe the same best-first
// sources for a client-logo, but return metadata only — no files, no data
// URLs. The agent suggests one URL; the treatment (normalizeLogo) stays a
// browser step Diogo runs from /logo-lab or the edit rail on review.
//
// Sources, in order:
//   1. Brandfetch CDN        — only if BRANDFETCH_CLIENT_ID is set (true logos)
//   2. apple-touch-icon      — parsed from the site's homepage (brand app mark)
//   3. Google s2 favicon 256 — decent square mark for most companies
//   4. unavatar.io           — aggregator fallback

export interface LogoCandidate {
  source: string;
  url?: string;
  ok: boolean;
  bytes?: number;
  contentType?: string;
  note?: string;
}

const UA = { "user-agent": "Mozilla/5.0 (Macintosh) trace-flow-agent/1.0" };
const MAX_BYTES = 8 * 1024 * 1024;

async function probe(source: string, url: string, referer?: string): Promise<LogoCandidate> {
  try {
    const res = await fetch(url, {
      headers: { ...UA, ...(referer ? { referer } : {}) },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { source, url, ok: false, note: `http ${res.status}` };
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 500) return { source, url, ok: false, note: `too small (${buf.byteLength}b)` };
    if (buf.byteLength > MAX_BYTES) return { source, url, ok: false, note: "too large" };
    return { source, url, ok: true, bytes: buf.byteLength, contentType: res.headers.get("content-type") ?? "" };
  } catch (e) {
    return { source, url, ok: false, note: String(e instanceof Error ? e.message : e).slice(0, 80) };
  }
}

export async function fetchLogoCandidates(
  domain: string,
): Promise<{ domain: string; candidates: LogoCandidate[] } | { error: string }> {
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return { error: `"${domain}" is not a valid domain` };
  if (isPrivateHost(clean)) return { error: "host not allowed" };

  const candidates: LogoCandidate[] = [];

  if (process.env.BRANDFETCH_CLIENT_ID) {
    candidates.push(
      await probe("brandfetch", `https://cdn.brandfetch.io/${clean}/w/512/h/512?c=${process.env.BRANDFETCH_CLIENT_ID}`),
    );
  }

  // apple-touch-icon from the homepage
  try {
    const html = await (
      await fetch(`https://${clean}`, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(15000) })
    ).text();
    const links = [...html.matchAll(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi)].map((m) => m[0]);
    const best = links
      .map((tag) => ({
        href: tag.match(/href=["']([^"']+)["']/i)?.[1],
        size: parseInt(tag.match(/sizes=["'](\d+)/i)?.[1] ?? "0", 10),
      }))
      .filter((l): l is { href: string; size: number } => !!l.href)
      .sort((a, b) => b.size - a.size)[0];
    if (best) {
      const href = best.href.replace(/&amp;/g, "&");
      const abs = href.startsWith("http") ? href : `https://${clean}${href.startsWith("/") ? "" : "/"}${href}`;
      candidates.push(await probe("apple-touch-icon", abs, `https://${clean}`));
    } else {
      candidates.push({ source: "apple-touch-icon", ok: false, note: "no link tag on homepage" });
    }
  } catch (e) {
    candidates.push({ source: "apple-touch-icon", ok: false, note: String(e instanceof Error ? e.message : e).slice(0, 80) });
  }

  candidates.push(await probe("google-favicon", `https://www.google.com/s2/favicons?domain=${clean}&sz=256`));
  candidates.push(await probe("unavatar", `https://unavatar.io/${clean}?fallback=false`));

  return { domain: clean, candidates };
}
