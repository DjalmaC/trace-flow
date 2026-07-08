// Render-verify a share link against its spec before Diogo ever sees it.
//
//   node scripts/agent/verify-link.mjs <code> <normalized-spec.json> [--local|--base URL] [--outdir DIR]
//
// Checks (JSON verdict on stdout, screenshots in outdir):
//   gate-locked      GET /api/flow/<code> without pw     -> 401
//   gate-password    GET /api/flow/<code>?pw=<company>   -> 200, clientName matches
//   render           hero + pricing + closing screenshots (rep-key session)
//   pricing-values   every numeric rate from the spec appears on the Pricing tab
//   flow-names       each variant name appears (multi-flow links)
//   rep-contact      the rep's name appears on the closing section
//   pdf              proposal PDF downloads; page count sane; customized rates present (warn-only)

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const [code, specFile] = args.filter((a) => !a.startsWith("--"));
if (!code || !specFile) {
  console.error("usage: verify-link.mjs <code> <normalized-spec.json> [--local|--base URL] [--outdir DIR]");
  process.exit(1);
}
const baseFlag = args.indexOf("--base");
const base = args.includes("--local") ? "http://localhost:3123" : baseFlag >= 0 ? args[baseFlag + 1] : "https://trace-flow-three.vercel.app";
const outFlag = args.indexOf("--outdir");
const outdir = outFlag >= 0 ? args[outFlag + 1] : `verify-${code}`;
mkdirSync(outdir, { recursive: true });

const payload = JSON.parse(readFileSync(specFile, "utf8"));
const spec = payload.spec ?? payload;
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../.env.local");
const repKey = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("TRACE_REP_KEY="))?.slice(14).trim().replace(/^["']|["']$/g, "");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const checks = [];
const check = (name, ok, note = "") => checks.push({ name, ok, note });

// ── gate, at the API level ──
const r1 = await fetch(`${base}/api/flow/${code}`);
check("gate-locked", r1.status === 401, `status ${r1.status}`);
const r2 = await fetch(`${base}/api/flow/${code}?pw=${encodeURIComponent(spec.company)}`);
let cfg = null;
if (r2.ok) cfg = (await r2.json()).config;
check("gate-password", r2.ok && cfg?.clientName === spec.company, `status ${r2.status}, clientName=${cfg?.clientName}`);

// ── expected strings ──
const fmt = (card, t) => (t.text?.trim() ? t.text.trim() : `${card.prefix ?? ""}${t.value.toFixed(2)}${card.suffix ?? ""}`);
const expectedRates = (spec.pricing?.cards ?? []).flatMap((card) =>
  card.type === "flat" ? [card.flatText?.trim() || `${card.prefix ?? ""}${(card.flat ?? 0).toFixed(2)}${card.suffix ?? ""}`] : card.tiers.map((t) => fmt(card, t)),
);
const flowNames = (spec.flows ?? []).map((f) => f.name).filter(Boolean);
const repName = spec.salesperson?.name;

// ── rendered link (rep session bypasses the gate) ──
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.addInitScript((k) => localStorage.setItem("tf:rep-key", k), repKey);
  await page.goto(`${base}/f/${code}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6500); // ride out the welcome intro
  await page.screenshot({ path: join(outdir, "1-hero.png") });

  await page.getByRole("button", { name: "Pricing" }).first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(outdir, "2-pricing.png") });
  const pricingText = await page.evaluate(() => document.body.innerText);
  const missing = expectedRates.filter((v) => !pricingText.includes(v));
  check("pricing-values", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : `${expectedRates.length} rates present`);

  await page.getByRole("button", { name: "Flow" }).first().click();
  await page.waitForTimeout(800);
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (flowNames.length > 1) {
    const missingFlows = flowNames.filter((n) => !bodyText.includes(n));
    check("flow-names", missingFlows.length === 0, missingFlows.length ? `missing: ${missingFlows.join(", ")}` : "all present");
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outdir, "3-closing.png") });
  const closingText = await page.evaluate(() => document.body.innerText);
  if (repName) check("rep-contact", closingText.includes(repName), repName);

  // ── the PDF (warn-only: heavier moving parts) ──
  try {
    const dl = page.waitForEvent("download", { timeout: 45000 });
    await page.getByRole("button", { name: /Download Proposal/i }).first().click();
    const download = await dl;
    const pdfPath = join(outdir, "proposal.pdf");
    await download.saveAs(pdfPath);
    const py = `
import fitz, json, sys
d = fitz.open("${pdfPath}")
text = "".join(p.get_text() for p in d)
print(json.dumps({"pages": len(d), "hasRates": [v for v in sys.argv[1:] if v in text]}))`;
    writeFileSync(join(outdir, "pdfcheck.py"), py);
    const out = JSON.parse(execFileSync("python3", [join(outdir, "pdfcheck.py"), ...expectedRates.slice(0, 6)], { encoding: "utf8" }));
    // customized pricing pages are live-rendered PNGs (no text layer), so
    // rates-in-text is informational only; the on-screen check is the real one
    check("pdf", out.pages >= 3, `${out.pages} pages; text-layer rates ${out.hasRates.length}/${Math.min(expectedRates.length, 6)} (0 is normal for customized pricing)`);
  } catch (e) {
    check("pdf", false, `warn: ${String(e.message ?? e).slice(0, 100)}`);
  }
} finally {
  await browser.close();
}

const hardFail = checks.filter((c) => !c.ok && c.name !== "pdf");
console.log(JSON.stringify({ ok: hardFail.length === 0, checks, outdir }, null, 2));
process.exit(hardFail.length ? 2 : 0);
