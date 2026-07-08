// Download client-logo candidates for a domain, best sources first. The skill
// then runs each through /logo-lab (the product's real pipeline) and picks by
// looking at the rendered result; nothing here decides quality.
//
//   node scripts/agent/logo-ladder.mjs <domain> <outdir>
//
// Sources, in order:
//   1. Brandfetch CDN        — only if BRANDFETCH_CLIENT_ID is set (true logos)
//   2. apple-touch-icon      — parsed from the site's homepage (brand app mark)
//   3. Google s2 favicon 256 — decent square mark for most companies
//   4. unavatar.io           — aggregator fallback

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , domain, outdir = "."] = process.argv;
if (!domain) {
  console.error("usage: logo-ladder.mjs <domain> <outdir>");
  process.exit(1);
}
mkdirSync(outdir, { recursive: true });

const UA = { "user-agent": "Mozilla/5.0 (Macintosh) trace-flow-agent/1.0" };
const results = [];

async function grab(name, url, referer) {
  try {
    const res = await fetch(url, { headers: { ...UA, ...(referer ? { referer } : {}) }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!res.ok) return results.push({ source: name, url, ok: false, note: `http ${res.status}` });
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500) return results.push({ source: name, url, ok: false, note: `too small (${buf.length}b)` });
    const type = res.headers.get("content-type") ?? "";
    const ext = type.includes("svg") ? "svg" : type.includes("ico") ? "ico" : type.includes("jpeg") ? "jpg" : "png";
    const path = join(outdir, `logo-${results.filter((r) => r.ok).length + 1}-${name}.${ext}`);
    writeFileSync(path, buf);
    results.push({ source: name, url, ok: true, path, bytes: buf.length, contentType: type });
  } catch (e) {
    results.push({ source: name, url, ok: false, note: String(e.message ?? e).slice(0, 80) });
  }
}

if (process.env.BRANDFETCH_CLIENT_ID) {
  await grab("brandfetch", `https://cdn.brandfetch.io/${domain}/w/512/h/512?c=${process.env.BRANDFETCH_CLIENT_ID}`);
}

// apple-touch-icon from the homepage
try {
  const html = await (await fetch(`https://${domain}`, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(15000) })).text();
  const links = [...html.matchAll(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi)].map((m) => m[0]);
  const best = links
    .map((tag) => ({ href: tag.match(/href=["']([^"']+)["']/i)?.[1], size: parseInt(tag.match(/sizes=["'](\d+)/i)?.[1] ?? "0", 10) }))
    .filter((l) => l.href)
    .sort((a, b) => b.size - a.size)[0];
  if (best) {
    const href = best.href.replace(/&amp;/g, "&");
    const abs = href.startsWith("http") ? href : `https://${domain}${href.startsWith("/") ? "" : "/"}${href}`;
    await grab("apple-touch-icon", abs, `https://${domain}`);
  } else {
    results.push({ source: "apple-touch-icon", ok: false, note: "no link tag on homepage" });
  }
} catch (e) {
  results.push({ source: "apple-touch-icon", ok: false, note: String(e.message ?? e).slice(0, 80) });
}

await grab("google-favicon", `https://www.google.com/s2/favicons?domain=${domain}&sz=256`);
await grab("unavatar", `https://unavatar.io/${domain}?fallback=false`);

console.log(JSON.stringify({ domain, candidates: results }, null, 2));
