import { computeLayout, CONT_Y, CONT_H } from "../components/layout";
import { Defs } from "../components/FlowSvg";
import { MachineryStage } from "../components/MachineryStage";
import { ASSETS } from "../components/tokens";
import { getFlow, defaultConfig } from "../data";
import type { Flow, FlowConfig } from "../data/schema";

// Personalised PowerPoint export, styled to match the flow 1-10 decks on the web
// app: near-black background + green radial glow + a thin green top rule + Inter,
// with the Trace Finance lockup bottom-right. Each slide is a single 960x540 deck
// composition (rendered live → static SVG → rasterised PNG) placed full-bleed.
// pptxgenjs + react-dom/server are dynamically imported to stay out of the main bundle.

const DW = 960;
const DH = 540;
const SCALE = 2;
const DECK_W_IN = 13.333; // 16:9 slide
const DECK_H_IN = 7.5;

// deck palette (from flow_0X_dark.svg)
const BG = "#08090b";
const RULE = "#4cc28e";
const TITLE = "#eef1ee";
const SUB = "#6f7a76";
const LABEL = "#7fb89f";

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
      reject(new Error("Could not render the deck slide."));
    };
    img.src = url;
  });
}

// ── deck composition (JSX → static SVG) ──────────────────────────────────────

// Match the bottom-right lockup baked into the proposal templates EXACTLY, so it
// doesn't shift between template pages and inserted flow slides. Template values
// (960×540): mark in a 44.6 box right-edge ~804.2, centred at y≈509; "Trace
// Finance" Inter-Bold 20, left x≈808.6, baseline y≈516.2.
function Lockup() {
  // Exact template rect: square mark at (759.6, 486.7) 44.6×44.6, "Trace Finance"
  // Inter-Bold 20 left at x≈808.6, baseline y≈516.2.
  return (
    <>
      <image href={ASSETS.traceLockupMark} x={759.6} y={486.7} width={44.6} height={44.6} />
      <text x={808.6} y={516.2} fontSize={20} fontWeight={700} fill={TITLE}>
        Trace Finance
      </text>
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${DW} ${DH}`} width={DW} height={DH} style={{ fontFamily: "Inter, sans-serif" }}>
      <Defs />
      <rect x={0} y={0} width={DW} height={DH} fill={BG} />
      <rect x={0} y={0} width={DW} height={DH} fill="url(#tf-glow)" />
      <rect x={0} y={0} width={DW} height={3.2} fill={RULE} />
      {children}
      <Lockup />
    </svg>
  );
}

function titleSlide(config: FlowConfig) {
  const cw = 320;
  const ch = 140;
  const cx = (DW - cw) / 2;
  const cy = 150;
  return (
    <Frame>
      {config.clientLogoUrl ? (
        config.clientLogoPlate === "light" ? (
          <>
            <rect x={cx} y={cy} width={cw} height={ch} rx={18} fill="#ffffff" />
            <image href={config.clientLogoUrl} x={cx + 42} y={cy + 38} width={cw - 84} height={ch - 76} preserveAspectRatio="xMidYMid meet" />
          </>
        ) : (
          // light/transparent logo straight on the dark deck (no white card)
          <image href={config.clientLogoUrl} x={cx + 20} y={cy + 16} width={cw - 40} height={ch - 32} preserveAspectRatio="xMidYMid meet" />
        )
      ) : (
        <text x={DW / 2} y={cy + ch / 2 + 14} fontSize={46} fontWeight={700} fill={TITLE} textAnchor="middle">
          {config.clientName}
        </text>
      )}
      <text x={DW / 2} y={cy + ch + 66} fontSize={30} fontWeight={700} fill={TITLE} textAnchor="middle">
        Cross-border payment architecture
      </text>
      <text x={DW / 2} y={cy + ch + 98} fontSize={15} fill={SUB} textAnchor="middle">
        {config.clientRep ? `Prepared for ${config.clientRep}` : `Prepared for ${config.clientName}`}
      </text>
    </Frame>
  );
}

// The client-facing flow label is POSITIONAL — "what flow is this to the client":
// Flow 1, Flow 2, … by order in the proposal, or "The Flow" if there's only one.
function deckFlowLabel(index: number, total: number): string {
  return total <= 1 ? "The Flow" : `Flow ${index + 1}`;
}

function flowSlide(config: FlowConfig, flow: Flow, name: string, label: string, support?: string) {
  const layout = computeLayout(flow, config);
  const mw = layout.width;
  const mh = CONT_H + 30;
  const areaTop = 122;
  const areaBottom = 474;
  const availW = DW - 80;
  const maxH = areaBottom - areaTop;
  let w2 = availW;
  let h2 = (w2 * mh) / mw;
  if (h2 > maxH) {
    h2 = maxH;
    w2 = (h2 * mw) / mh;
  }
  const x2 = (DW - w2) / 2;
  const y2 = areaTop + (maxH - h2) / 2;
  return (
    <Frame>
      <text x={48} y={56} fontSize={11} fontWeight={600} fill={LABEL} letterSpacing={2}>
        BENEATH THE SURFACE
      </text>
      <text x={48} y={86} fontSize={24} fontWeight={700} fill={TITLE}>
        {`${label} - ${name}`}
      </text>
      {support && (
        <text x={48} y={108} fontSize={12.5} fill={SUB}>
          {support}
        </text>
      )}
      <svg x={x2} y={y2} width={w2} height={h2} viewBox={`0 ${CONT_Y - 12} ${mw} ${mh}`} preserveAspectRatio="xMidYMid meet">
        <MachineryStage layout={layout} config={config} animate={false} showHeading={false} />
      </svg>
    </Frame>
  );
}

async function renderDeckPng(node: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  let markup = renderToStaticMarkup(node);
  const [trace, lockup, usdc, usdt, style] = await Promise.all([
    dataUri(ASSETS.traceLogo),
    dataUri(ASSETS.traceLockupMark),
    dataUri(ASSETS.usdc),
    dataUri(ASSETS.usdt),
    interStyle(),
  ]);
  markup = markup
    .split(ASSETS.traceLockupMark).join(lockup)
    .split(ASSETS.traceLogo).join(trace)
    .split(ASSETS.usdc).join(usdc)
    .split(ASSETS.usdt).join(usdt)
    .replace(/(<svg[^>]*>)/, `$1${style}`);
  return rasterize(markup, DW, DH);
}

/** Render just the flow slides (no title slide), as 960×540 PNG data URLs — used
 *  by the proposal builder to insert deck pages into a template PDF. */
export async function renderProposalFlowPngs(
  config: FlowConfig,
  variants?: { flowId: string; name: string }[],
): Promise<string[]> {
  const items =
    variants && variants.length
      ? variants
      : [{ flowId: config.flowId, name: getFlow(config.flowId)?.title ?? "Flow" }];
  const valid = items.filter((it) => getFlow(it.flowId));
  const out: string[] = [];
  for (let i = 0; i < valid.length; i++) {
    const it = valid[i];
    const flow = getFlow(it.flowId)!;
    const support = flow.heroSupport ? flow.heroSupport[config.direction] : undefined;
    out.push(await renderDeckPng(flowSlide({ ...config, flowId: it.flowId }, flow, it.name, deckFlowLabel(i, valid.length), support)));
  }
  return out;
}

/** QA hook: render one deck slide to a PNG data URL. */
export async function previewDeckPng(flowId: string, kind: "title" | "flow"): Promise<string> {
  const flow = getFlow(flowId)!;
  const config: FlowConfig = { ...defaultConfig(flowId, "ARQ"), clientRep: "Victor Medeiros", clientLogoPlate: "none" };
  return renderDeckPng(kind === "title" ? titleSlide(config) : flowSlide(config, flow, "With Arq IP", deckFlowLabel(0, 1), flow.heroSupport?.collection));
}

type Variant = { flowId: string; name: string };

function dataUrlToBytes(u: string): Uint8Array {
  const b64 = u.slice(u.indexOf(",") + 1);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function triggerDownload(bytes: Uint8Array, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Render the personalised deck slides (title + one per flow) as PNG data URLs. */
async function renderDeckSlides(config: FlowConfig, variants?: Variant[]): Promise<string[]> {
  const items: Variant[] =
    variants && variants.length
      ? variants
      : [{ flowId: config.flowId, name: getFlow(config.flowId)?.title ?? "Flow" }];
  const valid = items.filter((it) => getFlow(it.flowId));
  const slides = [await renderDeckPng(titleSlide(config))];
  for (let i = 0; i < valid.length; i++) {
    const it = valid[i];
    const flow = getFlow(it.flowId)!;
    const support = flow.heroSupport ? flow.heroSupport[config.direction] : undefined;
    slides.push(await renderDeckPng(flowSlide({ ...config, flowId: it.flowId }, flow, it.name, deckFlowLabel(i, valid.length), support)));
  }
  return slides;
}

/** Build the same personalised deck as a multi-page PDF and download it. */
export async function downloadFlowDeckPdf(config: FlowConfig, variants?: Variant[]): Promise<void> {
  const { PDFDocument } = await import("pdf-lib");
  const slides = await renderDeckSlides(config, variants);
  const pdf = await PDFDocument.create();
  for (const dataUrl of slides) {
    const png = await pdf.embedPng(dataUrlToBytes(dataUrl));
    const page = pdf.addPage([DW, DH]); // landscape, 1pt = 1px of the 960x540 deck
    page.drawImage(png, { x: 0, y: 0, width: DW, height: DH });
  }
  const bytes = await pdf.save();
  triggerDownload(bytes, `Trace Finance - ${config.clientName} - flows.pdf`, "application/pdf");
}

/** Build a personalised deck (title slide + one slide per flow) and download it. */
export async function downloadFlowPptx(config: FlowConfig, variants?: Variant[]): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");

  const items: Variant[] =
    variants && variants.length
      ? variants
      : [{ flowId: config.flowId, name: getFlow(config.flowId)?.title ?? "Flow" }];

  const valid = items.filter((it) => getFlow(it.flowId));
  const titlePng = await renderDeckPng(titleSlide(config));
  const flowPngs: string[] = [];
  for (let i = 0; i < valid.length; i++) {
    const it = valid[i];
    const flow = getFlow(it.flowId)!;
    const support = flow.heroSupport ? flow.heroSupport[config.direction] : undefined;
    flowPngs.push(await renderDeckPng(flowSlide({ ...config, flowId: it.flowId }, flow, it.name, deckFlowLabel(i, valid.length), support)));
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "TF169", width: DECK_W_IN, height: DECK_H_IN });
  pptx.layout = "TF169";

  const title = pptx.addSlide();
  title.background = { color: "08090B" };
  title.addImage({ data: titlePng, x: 0, y: 0, w: DECK_W_IN, h: DECK_H_IN });

  for (const png of flowPngs) {
    const s = pptx.addSlide();
    s.background = { color: "08090B" };
    s.addImage({ data: png, x: 0, y: 0, w: DECK_W_IN, h: DECK_H_IN });
  }

  await pptx.writeFile({ fileName: `Trace Finance - ${config.clientName} - flows.pptx` });
}
