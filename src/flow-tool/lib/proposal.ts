import type {
  Currency,
  Direction,
  FlowConfig,
  ProposalType,
  Stablecoin,
  TraceRep,
} from "../data/schema";
import { renderProposalFlowPngs } from "./pptx";

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
//      slide from /public/proposals/sales-slides.pdf.
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
  logo: { page: number; box: [number, number, number, number] };
  fields: ManifestField[];
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
}

// ── font embedding + rasterisation (shared shape with lib/pptx) ──────────────

let _interStyle: string | null = null;
async function interStyle(): Promise<string> {
  if (_interStyle) return _interStyle;
  const weights = [400, 700];
  const faces = await Promise.all(
    weights.map(async (w) => {
      const buf = await fetch(`/fonts/inter-${w}.woff2`).then((r) => r.arrayBuffer());
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
      const canvas = document.createElement("canvas");
      canvas.width = DW * SCALE;
      canvas.height = DH * SCALE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return reject(new Error("overlay toBlob failed"));
        b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
      }, "image/png");
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

  if (logo) {
    const [x0, y0, x1, y1] = logo.box;
    const bw = x1 - x0;
    const bh = y1 - y0;
    if (logo.plate === "light") {
      parts.push(
        `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" rx="6" fill="#ffffff"/>`,
      );
      const inset = Math.min(5, bw * 0.06);
      parts.push(
        `<image href="${logo.url}" x="${x0 + inset}" y="${y0 + inset}" width="${bw - 2 * inset}" height="${bh - 2 * inset}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    } else {
      parts.push(
        `<image href="${logo.url}" x="${x0}" y="${y0}" width="${bw}" height="${bh}" preserveAspectRatio="xMinYMid meet"/>`,
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

  // Will we replace the contact slide with the rep's pre-designed slide?
  const replaceClosing = rep?.slidePage != null;

  // Stamp overlays onto the relevant template pages (before inserting flows, so
  // page references stay valid). Skip the closing page when we'll replace it.
  const pages = new Set(manifest.fields.map((f) => f.page));
  pages.add(manifest.logo.page);
  for (const pno of pages) {
    if (replaceClosing && pno === manifest.closingPage) continue;
    let fields = manifest.fields.filter((f) => f.page === pno);
    // when no company contact, drop the "— company" tail to avoid "Acme — Acme"
    if (!opts.companyRep) {
      fields = fields.map((f) =>
        f.key === "repCompany" ? { ...f, template: "{company}" } : f,
      );
    }
    const logo =
      pno === manifest.logo.page && opts.companyLogoUrl
        ? { box: manifest.logo.box, url: opts.companyLogoUrl, plate: opts.companyLogoPlate }
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

  // Swap in the rep's pre-designed contact slide, if available.
  if (replaceClosing) {
    const salesBytes = await fetch("/proposals/sales-slides.pdf")
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    if (salesBytes) {
      const sales = await PDFDocument.load(salesBytes);
      const [repSlide] = await doc.copyPages(sales, [rep!.slidePage!]);
      // closing page shifted right by the inserted flow pages
      const closingIdx = manifest.closingPage + flowPngs.length;
      doc.removePage(closingIdx);
      doc.insertPage(closingIdx, repSlide);
    }
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
  URL.revokeObjectURL(url);
}

/** Build + download the proposal PDF. */
export async function downloadProposalPdf(opts: ProposalBuildOpts): Promise<void> {
  const bytes = await buildProposalPdf(opts);
  triggerDownload(bytes, `Trace Finance - ${opts.company} - Proposal.pdf`);
}
