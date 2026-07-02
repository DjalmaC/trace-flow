import type {
  Currency,
  Direction,
  FlowConfig,
  ProposalPricing,
  ProposalType,
  Stablecoin,
  TraceRep,
} from "../data/schema";
import { pricingEqualsDeck } from "../data/schema";
import { renderPricingPagePng, renderProposalFlowPngs } from "./pptx";

// ─────────────────────────────────────────────────────────────────────────────
// Proposal assembly (client-side).
//
// A proposal is built on top of a fixed Trace template PDF:
//   Title → Pricing page(s) → ⟨flow slides⟩ → Contact slide
//
// The templates live blanked in /public/proposals/templates/{type}.pdf — all
// `[…]` placeholders redacted out (clean background preserved), paired with a
// `{type}.manifest.json` describing each field's exact position / font / size /
// colour. At build time we:
//   1. stamp a filled overlay (logo + text in Inter) over the title / footer /
//      contact pages — pixel-aligned to the original placeholders,
//   2. insert the live-rendered flow deck pages (960×540, identical to the web
//      decks) right before the contact slide,
//   3. optionally REPLACE the contact slide with the selected rep's pre-designed
//      slide from the gated /api/asset/sales-slides.pdf (private-assets/).
//
// Everything runs in the browser, reusing the same SVG→PNG rasteriser the flow
// decks use, so there is a single source of truth for the deck look.
// ─────────────────────────────────────────────────────────────────────────────

const DW = 960;
const DH = 540;
const SCALE = 2; // overlay raster DPI multiplier

interface ManifestField {
  key: string;
  page: number;
  template: string;
  x: number;
  baseline: number;
  size: number;
  color: string;
  font: "bold" | "regular";
  align: "left" | "right";
}
interface Manifest {
  name: string;
  pageW: number;
  pageH: number;
  closingPage: number;
  flowsInsertAt: number;
  /** Page index of the pix/spread rate card, or null when the template has no
   *  1:1 counterpart (brazil-market) and a customized card is inserted instead. */
  pricingPage?: number | null;
  logo: { page: number; box: [number, number, number, number] };
  fields: ManifestField[];
}

/** How this caller is allowed to fetch the gated /api/asset PDFs: a rep holds
 *  the shared key; a client holds a valid share code. */
export interface AssetAuth {
  repKey?: string;
  code?: string;
}

export interface ProposalBuildOpts {
  proposalType: ProposalType;
  company: string;
  /** Company point of contact (client side), shown on the title slide. */
  companyRep?: string;
  /** Title-slide date, e.g. "June 2026". */
  date: string;
  companyLogoUrl?: string;
  companyLogoPlate?: "light" | "none";
  /** Flows to include, in order, with the label shown on each slide. */
  flows: { flowId: string; name: string }[];
  direction?: Direction;
  stablecoin?: Stablecoin;
  collected?: Currency;
  delivered?: Currency;
  /** Trace salesperson — fills (or, via slidePage, replaces) the contact slide. */
  rep?: TraceRep;
  /** The proposal's pricing. When it differs from the deck rates, the PDF's
   *  rate page is live-rendered so the download matches the client's Pricing
   *  view (standard: replaces the template page; brazil-market: inserted). */
  pricing?: ProposalPricing;
  /** Credentials for fetching the gated sales-slides deck. */
  assetAuth?: AssetAuth;
}

/** Fetch a gated /api/asset PDF, returning null on any failure. */
async function fetchAsset(name: string, auth?: AssetAuth): Promise<ArrayBuffer | null> {
  const q = auth?.code ? `?code=${encodeURIComponent(auth.code)}` : "";
  const headers: HeadersInit | undefined = auth?.repKey ? { "x-tf-key": auth.repKey } : undefined;
  return fetch(`/api/asset/${name}${q}`, { headers })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
}

// Register Inter as a real FontFace so canvas measureText() (used by fitSize)
// matches the Inter embedded in the rasterised overlay. Without this the app's
// hashed next/font family isn't reachable as "Inter" and metrics fall back to
// sans-serif, so headlines fit inconsistently across machines.
let _interLoaded: Promise<void> | null = null;
function ensureInterLoaded(): Promise<void> {
  if (_interLoaded) return _interLoaded;
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  _interLoaded = (async () => {
    await Promise.all(
      [400, 700].map(async (w) => {
        try {
          const ff = new FontFace("Inter", `url(/fonts/inter-${w}.woff2)`, { weight: String(w) });
          await ff.load();
          (document as Document & { fonts: FontFaceSet }).fonts.add(ff);
        } catch {
          /* fall back to sans-serif metrics for this weight */
        }
      }),
    );
  })();
  return _interLoaded;
}

// ── font embedding + rasterisation (shared shape with lib/pptx) ──────────────

let _interStyle: string | null = null;
async function interStyle(): Promise<string> {
  if (_interStyle) return _interStyle;
  const weights = [400, 700];
  const faces = await Promise.all(
    weights.map(async (w) => {
      const buf = await fetch(`/fonts/inter-${w}.woff2`).then((r) => {
        if (!r.ok) throw new Error(`Could not load Inter ${w}.`);
        return r.arrayBuffer();
      });
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${btoa(bin)}) format('woff2');}`;
    }),
  );
  _interStyle = `<style>${faces.join("")}</style>`;
  return _interStyle;
}

function rasterize(svg: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = DW * SCALE;
        canvas.height = DH * SCALE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => {
          if (!b) return reject(new Error("overlay toBlob failed"));
          b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))).catch(reject);
        }, "image/png");
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error("Could not rasterise the overlay."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not rasterise the proposal overlay."));
    };
    img.src = url;
  });
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// For values placed inside an SVG attribute (e.g. the logo href): also neutralise
// quotes so a hostile/odd URL can't break out of the attribute or inject markup.
const escAttr = (s: string) =>
  esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Only embed logos we can trust as inert: data URIs or same-app asset paths. */
function safeLogoHref(url: string): string | null {
  const u = url.trim();
  if (/^data:image\//i.test(u)) return u;
  if (u.startsWith("/")) return u; // same-origin app asset
  return null; // reject http(s)/javascript/etc. — won't render in SVG anyway
}

/** Shrink a font size until the text fits `maxW` at the given weight (Inter). */
function fitSize(text: string, size: number, weight: number, maxW: number): number {
  if (typeof document === "undefined") return size;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return size;
  let s = size;
  for (let i = 0; i < 12; i++) {
    ctx.font = `${weight} ${s}px Inter, sans-serif`;
    if (ctx.measureText(text).width <= maxW) break;
    s -= s * 0.06;
  }
  return s;
}

function resolveTemplate(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Build a transparent 960×540 overlay SVG for one page. */
async function pageOverlaySvg(
  fields: ManifestField[],
  vars: Record<string, string>,
  logo?: { box: [number, number, number, number]; url: string; plate?: "light" | "none" },
): Promise<string> {
  const style = await interStyle();
  const parts: string[] = [];

  const logoHref = logo ? safeLogoHref(logo.url) : null;
  if (logo && logoHref) {
    const [x0, y0, x1, y1] = logo.box;
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (logo.plate === "light") {
      parts.push(
        `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="6" fill="#ffffff"/>`,
      );
      const inset = Math.min(5, bw * 0.06);
      parts.push(
        `<image href="${escAttr(logoHref)}" x="${x0 + inset}" y="${y0 + inset}" width="${bw - 2 * inset}" height="${bh - 2 * inset}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    } else {
      parts.push(
        `<image href="${escAttr(logoHref)}" x="${x0}" y="${y0}" width="${bw}" height="${bh}" preserveAspectRatio="xMinYMid meet"/>`,
      );
    }
  }

  for (const f of fields) {
    const text = resolveTemplate(f.template, vars).trim();
    if (!text) continue;
    const weight = f.font === "bold" ? 700 : 400;
    const anchor = f.align === "right" ? "end" : "start";
    // headline can be long — shrink to stay on the slide
    const maxW = f.key === "headline" ? DW - f.x - 48 : Infinity;
    const size = Number.isFinite(maxW) ? fitSize(text, f.size, weight, maxW) : f.size;
    parts.push(
      `<text x="${f.x}" y="${f.baseline}" font-family="Inter, sans-serif" font-weight="${weight}" font-size="${size}" fill="${f.color}" text-anchor="${anchor}">${esc(text)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DW} ${DH}" width="${DW}" height="${DH}">${style}${parts.join("")}</svg>`;
}

function dataUrlToBytes(u: string): Uint8Array {
  const b64 = u.slice(u.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Assemble the full proposal PDF and return its bytes. */
export async function buildProposalPdf(opts: ProposalBuildOpts): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");

  const base = `/proposals/templates/${opts.proposalType}`;
  const [tplBytes, manifest] = await Promise.all([
    fetch(`${base}.pdf`).then((r) => {
      if (!r.ok) throw new Error("Could not load the proposal template.");
      return r.arrayBuffer();
    }),
    fetch(`${base}.manifest.json`).then((r) => {
      if (!r.ok) throw new Error("Could not load the proposal manifest.");
      return r.json() as Promise<Manifest>;
    }),
  ]);

  if (manifest.closingPage == null || manifest.flowsInsertAt == null) {
    throw new Error("Proposal manifest is missing page anchors.");
  }

  // Make canvas text metrics match the embedded Inter before any fitSize() runs.
  await ensureInterLoaded();

  const doc = await PDFDocument.load(tplBytes);

  // Fill values. repCompany collapses to just the company when no contact given.
  const rep = opts.rep;
  const vars: Record<string, string> = {
    company: opts.company,
    rep: opts.companyRep || opts.company,
    date: opts.date,
    repName: rep?.name ?? "",
    repTitle: rep?.title ?? "",
    repEmail: rep?.email ?? "",
    repPhone: rep?.phone ?? "",
    repLinkedIn: rep?.linkedin ?? "",
  };

  // Try to load the rep's pre-designed contact slide up front. Only if it's
  // actually available (deck present + the page index in range) will we replace
  // the template's closing page; otherwise we stamp the closing page below so it
  // never ships blank. pdf-lib import reused from above.
  let repSlideDoc: Awaited<ReturnType<typeof PDFDocument.load>> | null = null;
  let repSlideIndex = -1;
  if (rep?.slidePage != null) {
    const salesBytes = await fetchAsset("sales-slides.pdf", opts.assetAuth);
    if (salesBytes) {
      const sales = await PDFDocument.load(salesBytes);
      if (rep.slidePage >= 0 && rep.slidePage < sales.getPageCount()) {
        repSlideDoc = sales;
        repSlideIndex = rep.slidePage;
      }
    }
  }
  const willReplace = repSlideIndex >= 0;

  // The template's static "Prepared for" label sits just above the rep line but
  // gets clipped during redaction; redraw it (with the colon) in its original
  // style so the title reads "Prepared for: {rep} — {company}".
  const repField = manifest.fields.find((f) => f.key === "repCompany");
  if (repField) {
    manifest.fields.push({
      key: "preparedFor",
      page: repField.page,
      template: "Prepared for:",
      x: repField.x,
      baseline: repField.baseline - 14.6,
      size: 9,
      color: "#8f98a3",
      font: "regular",
      align: "left",
    });
  }

  // The placeholder logo box is short, so a square mark renders small — grow it
  // into the empty top-left space for more presence.
  const lb = manifest.logo.box;
  const logoBox: [number, number, number, number] = [lb[0], lb[1], lb[0] + 200, lb[1] + 56];

  // ── customized pricing → the PDF rate page is live-rendered ──
  // Deck-identical pricing keeps the template's hand-designed page. Anything
  // else (override / flat / custom bands) renders the page from the same
  // ProposalPricing the client's web Pricing view reads, so the download can
  // never disagree with what the client saw on the link.
  const pricingCustomized = !!opts.pricing && !pricingEqualsDeck(opts.pricing);
  const pricingSub =
    opts.proposalType === "standard"
      ? "BRL payins and payouts via Pix / TED · USDC ↔ BRL"
      : "Cross-border payins and payouts · USDT ↔ BRL";
  if (pricingCustomized && typeof manifest.pricingPage === "number") {
    // standard: replace the template's own rate page in place (page count
    // unchanged, so every downstream index stays valid). The overlay loop
    // below still stamps this page's footer field onto the replacement.
    const png = await doc.embedPng(dataUrlToBytes(await renderPricingPagePng(opts.pricing!, pricingSub)));
    doc.removePage(manifest.pricingPage);
    const page = doc.insertPage(manifest.pricingPage, [DW, DH]);
    page.drawImage(png, { x: 0, y: 0, width: DW, height: DH });
  }

  // Stamp overlays onto the relevant template pages (before inserting flows, so
  // page references stay valid). Skip the closing page when we'll replace it.
  const pages = new Set(manifest.fields.map((f) => f.page));
  pages.add(manifest.logo.page);
  for (const pno of pages) {
    if (willReplace && pno === manifest.closingPage) continue;
    let fields = manifest.fields.filter((f) => f.page === pno);
    // when no company contact, drop the "— company" tail to avoid "Acme — Acme"
    if (!opts.companyRep) {
      fields = fields.map((f) =>
        f.key === "repCompany" ? { ...f, template: "{company}" } : f,
      );
    }
    const logo =
      pno === manifest.logo.page && opts.companyLogoUrl
        ? { box: logoBox, url: opts.companyLogoUrl, plate: opts.companyLogoPlate }
        : undefined;
    if (!fields.length && !logo) continue;
    const svg = await pageOverlaySvg(fields, vars, logo);
    const png = await doc.embedPng(await rasterize(svg));
    doc.getPage(pno).drawImage(png, { x: 0, y: 0, width: DW, height: DH });
  }

  // Render + insert the flow deck pages right before the contact slide.
  const flowConfig: FlowConfig = {
    flowId: opts.flows[0]?.flowId ?? "flow-1",
    clientName: opts.company,
    clientRep: opts.companyRep,
    clientLogoUrl: opts.companyLogoUrl,
    clientLogoPlate: opts.companyLogoPlate,
    collected: opts.collected ?? "BRL",
    delivered: opts.delivered ?? "USD/EUR",
    direction: opts.direction ?? "collection",
    stablecoin: opts.stablecoin ?? "both",
  };
  const flowPngs = opts.flows.length ? await renderProposalFlowPngs(flowConfig, opts.flows) : [];
  for (let k = 0; k < flowPngs.length; k++) {
    const png = await doc.embedPng(dataUrlToBytes(flowPngs[k]));
    const page = doc.insertPage(manifest.flowsInsertAt + k, [DW, DH]);
    page.drawImage(png, { x: 0, y: 0, width: DW, height: DH });
  }

  // brazil-market has no pix/spread page to replace; a customized rate card is
  // inserted just ahead of the flow slides (footer baked in — no manifest
  // fields exist for a page the template never had).
  let pricingInserted = 0;
  if (pricingCustomized && typeof manifest.pricingPage !== "number") {
    const footerField = manifest.fields.find((f) => f.key === "footer");
    const footerText = footerField ? resolveTemplate(footerField.template, vars).trim() : undefined;
    const png = await doc.embedPng(dataUrlToBytes(await renderPricingPagePng(opts.pricing!, pricingSub, footerText)));
    const page = doc.insertPage(manifest.flowsInsertAt, [DW, DH]);
    page.drawImage(png, { x: 0, y: 0, width: DW, height: DH });
    pricingInserted = 1;
  }

  // Swap in the rep's pre-designed contact slide (preloaded above). If it wasn't
  // available the closing page was stamped normally, so nothing ships blank.
  if (willReplace && repSlideDoc) {
    const [repSlide] = await doc.copyPages(repSlideDoc, [repSlideIndex]);
    // closing page shifted right by the inserted flow + pricing pages
    const closingIdx = manifest.closingPage + flowPngs.length + pricingInserted;
    doc.removePage(closingIdx);
    doc.insertPage(closingIdx, repSlide);
  }

  return doc.save();
}

function triggerDownload(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation: revoking synchronously after click() can abort the
  // download in Safari/Firefox before it has started.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Build + download the proposal PDF. */
export async function downloadProposalPdf(opts: ProposalBuildOpts): Promise<void> {
  const bytes = await buildProposalPdf(opts);
  triggerDownload(bytes, `Trace Finance - ${opts.company} - Proposal.pdf`);
}
