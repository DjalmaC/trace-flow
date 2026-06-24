import { PDFDocument } from "pdf-lib";
import { getFlow } from "../data";
import type { FlowConfig } from "../data/schema";

// Client-side "Download PDF": render the DESIGNED deck SVG (svg/flow_0X_dark.svg,
// served from /public/flows) — not a snapshot of the web view — with the
// client's name + logo injected, Inter embedded, rasterised at high DPI and
// wrapped into a one-page landscape PDF. One source of truth (the deck SVG),
// two outputs (animated web view + this static deck).

const SVG_W = 920;
const SVG_H = 540;
const SCALE = 3; // raster DPI multiplier — print-crisp
const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK = "http://www.w3.org/1999/xlink";

/** flow-1 → flow_01_dark.svg, flow-9.1 → flow_09_1_dark.svg, flow-10 → flow_10_dark.svg */
function svgFile(flowId: string): string {
  const m = flowId.replace("flow-", "");
  if (m === "9.1") return "flow_09_1_dark.svg";
  return `flow_${m.padStart(2, "0")}_dark.svg`;
}

/** Inject client name (headline) + logo (every tagged slot) into the deck SVG doc. */
function injectClient(doc: Document, config: FlowConfig) {
  const head = doc.getElementById("headline-client");
  if (head) head.textContent = `What ${config.clientName} wants`;

  const slots = Array.from(doc.querySelectorAll(".client-logo-slot"));
  const labels = Array.from(doc.querySelectorAll(".client-logo-label"));

  if (config.clientLogoUrl) {
    for (const rect of slots) {
      const img = doc.createElementNS(SVG_NS, "image");
      for (const a of ["x", "y", "width", "height"]) img.setAttribute(a, rect.getAttribute(a) ?? "0");
      img.setAttribute("preserveAspectRatio", "xMidYMid meet");
      img.setAttribute("href", config.clientLogoUrl);
      img.setAttributeNS(XLINK, "xlink:href", config.clientLogoUrl);
      rect.parentNode?.insertBefore(img, rect.nextSibling);
      rect.remove();
    }
    labels.forEach((t) => t.remove());
  } else {
    // no logo → name the slot instead of leaving a "client logo" placeholder
    labels.forEach((t) => (t.textContent = config.clientName));
  }
}

/** Embed Inter (400/600/700) as data-URI @font-face so the rasterised text
 *  matches the deck (an SVG rendered as an image only sees fonts embedded in it). */
async function embedInter(doc: Document) {
  const weights = [400, 600, 700];
  const faces = await Promise.all(
    weights.map(async (w) => {
      const buf = await fetch(`/fonts/inter-${w}.woff2`).then((r) => r.arrayBuffer());
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      return `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    }),
  );
  const style = doc.createElementNS(SVG_NS, "style");
  style.textContent = faces.join("");
  const defs = doc.querySelector("defs") ?? doc.documentElement;
  defs.insertBefore(style, defs.firstChild);
}

/** Rasterise an SVG string to PNG bytes via an offscreen canvas. */
function rasterise(svg: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SVG_W * SCALE;
      canvas.height = SVG_H * SCALE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (!b) return reject(new Error("toBlob failed"));
        b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render the flow SVG."));
    };
    img.src = url;
  });
}

function flowName(flowId: string): string {
  const f = getFlow(flowId);
  return f?.title ?? `Flow ${flowId.replace("flow-", "")}`;
}

/** Generate the per-client deck PDF and trigger a download. */
export async function downloadFlowPdf(config: FlowConfig): Promise<void> {
  const raw = await fetch(`/flows/${svgFile(config.flowId)}`).then((r) => {
    if (!r.ok) throw new Error("Could not load the flow template.");
    return r.text();
  });

  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const svgEl = doc.documentElement;
  // give the SVG a definite intrinsic size for the rasteriser
  svgEl.setAttribute("width", String(SVG_W));
  svgEl.setAttribute("height", String(SVG_H));

  injectClient(doc, config);
  await embedInter(doc);

  const svgStr = new XMLSerializer().serializeToString(doc);
  const png = await rasterise(svgStr);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([SVG_W, SVG_H]); // landscape, 1pt = 1px
  const image = await pdf.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width: SVG_W, height: SVG_H });
  const bytes = await pdf.save();

  const filename = `Trace Finance — ${config.clientName} — ${flowName(config.flowId)}.pdf`;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
