import { computeLayout, CONT_Y, CONT_H } from "../components/layout";
import { Defs } from "../components/FlowSvg";
import { MachineryStage } from "../components/MachineryStage";
import { ASSETS } from "../components/tokens";
import { getFlow } from "../data";
import type { Flow, FlowConfig } from "../data/schema";

// Personalised PowerPoint export. For each flow variant we render the live
// machinery component to a STATIC svg (animate=false → the resting diagram),
// inline its assets + Inter font (an svg rasterised as an image only sees what's
// embedded in it), rasterise to PNG, and drop each onto a dark slide. A title
// slide carries the client + Trace branding. Everything is client-side; pptxgenjs
// and react-dom/server are dynamically imported so they stay out of the main bundle.

const SCALE = 2; // raster DPI multiplier
const DECK_W = 13.333; // 16:9 slide, inches
const DECK_H = 7.5;

async function dataUri(path: string, mime = "image/png"): Promise<string> {
  const buf = await fetch(path).then((r) => r.arrayBuffer());
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

async function interStyle(): Promise<string> {
  const weights = [400, 600, 700];
  const faces = await Promise.all(
    weights.map(async (w) => {
      const uri = await dataUri(`/fonts/inter-${w}.woff2`, "font/woff2");
      return `@font-face{font-family:'Inter';font-style:normal;font-weight:${w};font-display:block;src:url(${uri}) format('woff2');}`;
    }),
  );
  return `<style>${faces.join("")}</style>`;
}

function rasterize(svg: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * SCALE);
      canvas.height = Math.round(h * SCALE);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render the flow diagram."));
    };
    img.src = url;
  });
}

/** Render one flow's machinery diagram to a PNG data URL (+ its pixel size). */
export async function flowDiagramPng(config: FlowConfig, flow: Flow): Promise<{ url: string; w: number; h: number }> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const layout = computeLayout(flow, config);
  const w = layout.width;
  const h = CONT_H + 30;
  const vb = `0 ${CONT_Y - 12} ${w} ${h}`;

  let markup = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={vb} width={w} height={h} style={{ fontFamily: "Inter, sans-serif" }}>
      <Defs />
      <MachineryStage layout={layout} config={config} animate={false} showHeading={false} />
    </svg>,
  );

  const [trace, usdc, usdt, style] = await Promise.all([
    dataUri(ASSETS.traceLogo),
    dataUri(ASSETS.usdc),
    dataUri(ASSETS.usdt),
    interStyle(),
  ]);
  markup = markup
    .split(ASSETS.traceLogo).join(trace)
    .split(ASSETS.usdc).join(usdc)
    .split(ASSETS.usdt).join(usdt)
    .replace(/(<svg[^>]*>)/, `$1${style}`);

  const url = await rasterize(markup, w, h);
  return { url, w, h };
}

type Variant = { flowId: string; name: string };

/** Build a personalised deck (title slide + one slide per flow) and download it. */
export async function downloadFlowPptx(config: FlowConfig, variants?: Variant[]): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");

  const items: Variant[] =
    variants && variants.length
      ? variants
      : [{ flowId: config.flowId, name: getFlow(config.flowId)?.title ?? "Flow" }];

  // pre-render each flow diagram
  const rendered = [];
  for (const it of items) {
    const flow = getFlow(it.flowId);
    if (!flow) continue;
    const img = await flowDiagramPng({ ...config, flowId: it.flowId }, flow);
    rendered.push({ ...it, flow, img });
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "TF169", width: DECK_W, height: DECK_H });
  pptx.layout = "TF169";
  const BG = "07090B";
  const GREEN = "5FD3A0";
  const TITLE = "F2F5F3";
  const SUB = "8B948F";

  // ── title slide ──
  const title = pptx.addSlide();
  title.background = { color: BG };
  if (config.clientLogoUrl) {
    // white card behind the (transparent) client mark so it reads on the dark slide
    title.addShape("roundRect", { x: 5.17, y: 2.2, w: 3.0, h: 1.2, fill: { color: "FFFFFF" }, line: { type: "none" }, rectRadius: 0.12 });
    title.addImage({ data: config.clientLogoUrl, x: 5.42, y: 2.45, w: 2.5, h: 0.7, sizing: { type: "contain", w: 2.5, h: 0.7 } });
  } else {
    title.addText(config.clientName, { x: 0, y: 2.4, w: DECK_W, h: 0.9, align: "center", color: TITLE, fontSize: 40, bold: true, fontFace: "Inter" });
  }
  title.addText("Cross-border payment architecture", { x: 0, y: 3.7, w: DECK_W, h: 0.7, align: "center", color: TITLE, fontSize: 28, bold: true, fontFace: "Inter" });
  title.addText(
    config.clientRep ? `Prepared for ${config.clientRep}` : `Prepared for ${config.clientName}`,
    { x: 0, y: 4.5, w: DECK_W, h: 0.5, align: "center", color: SUB, fontSize: 15, fontFace: "Inter" },
  );
  title.addText("Trace Finance", { x: 0, y: 6.7, w: DECK_W, h: 0.4, align: "center", color: GREEN, fontSize: 14, bold: true, fontFace: "Inter" });

  // ── one slide per flow ──
  for (const r of rendered) {
    const s = pptx.addSlide();
    s.background = { color: BG };
    s.addText("How Trace makes it happen", { x: 0.6, y: 0.35, w: DECK_W - 1.2, h: 0.4, color: SUB, fontSize: 12, bold: true, fontFace: "Inter", charSpacing: 2 });
    s.addText(r.name, { x: 0.6, y: 0.7, w: DECK_W - 1.2, h: 0.7, color: TITLE, fontSize: 26, bold: true, fontFace: "Inter" });

    const margin = 0.7;
    const availW = DECK_W - margin * 2;
    const aspect = r.img.w / r.img.h;
    let imgW = availW;
    let imgH = imgW / aspect;
    const maxH = 3.6;
    if (imgH > maxH) { imgH = maxH; imgW = imgH * aspect; }
    s.addImage({ data: r.img.url, x: (DECK_W - imgW) / 2, y: 1.75, w: imgW, h: imgH });

    if (r.flow.narrative) {
      s.addText(r.flow.narrative, { x: 1.0, y: 1.85 + imgH + 0.25, w: DECK_W - 2.0, h: 1.6, align: "center", color: SUB, fontSize: 13, fontFace: "Inter" });
    }
  }

  await pptx.writeFile({ fileName: `Trace Finance - ${config.clientName} - flows.pptx` });
}
