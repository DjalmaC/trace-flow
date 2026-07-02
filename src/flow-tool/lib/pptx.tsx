import { computeLayout, CONT_Y, CONT_H } from "../components/layout";
import { Defs } from "../components/FlowSvg";
import { MachineryStage } from "../components/MachineryStage";
import { ASSETS } from "../components/tokens";
import { getFlow, defaultConfig } from "../data";
import type { Flow, FlowConfig, PriceComponent, PriceTier, ProposalPricing } from "../data/schema";

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
  const buf = await fetch(path).then((r) => {
    if (!r.ok) throw new Error(`Could not load ${path}.`);
    return r.arrayBuffer();
  });
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
  // JetBrains Mono Bold: the proposal templates set their rate values in it, so
  // the live-rendered pricing page matches them glyph-for-glyph.
  const jb = await dataUri("/fonts/jetbrains-mono-700.woff2", "font/woff2");
  faces.push(
    `@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:700;font-display:block;src:url(${jb}) format('woff2');}`,
  );
  return `<style>${faces.join("")}</style>`;
}

function rasterize(svg: string, w: number, h: number, scale = SCALE): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no 2d context"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error("Could not render the deck slide."));
      }
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

// ── custom pricing page (proposal PDF) ───────────────────────────────────────
// A 1:1 recreation of the standard template's rate page (page 1), rendered live
// from the rep's ProposalPricing so overridden/flat/custom rates land in the
// downloaded proposal. Geometry, palette, and type were measured directly off
// the template PDF (Inter-Bold headings, JetBrains Mono Bold values, #1a1a1f
// cards on #3a3f47 hairlines) so the page sits indistinguishably between the
// template's own pages. Structure-aware: tiered renders five bands, flat one.

const PP = {
  text: "#e8ecf0",
  grey: "#8f98a3",
  // Exact Trace-logo mark colours (sampled from trace_logo.png) so the badges,
  // bullets and values read as the SAME green/blue as the lockup on the page:
  // the Pix API table is Trace green, the FX Spread table is Trace blue.
  green: "#06f1af",
  blue: "#4ae1fc",
  card: "#1a1a1f",
  hairline: "#3a3f47",
  rowline: "#3a3e45",
  badgeInk: "#06120c",
};

// The Pix brand mark (four-arrowhead diamond), single monochrome path in a
// 24×24 box — filled dark, it sits in the green Pix API badge.
const PIX_MARK =
  "M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156";

// A single Trace-mark arrowhead (the right ">" half of the logo, from
// TraceArrow's SHAPE), always right-facing, tinted to the table colour — the
// row bullet. viewBox 303×417.
function ArrowBullet({ x, y, h, color }: { x: number; y: number; h: number; color: string }) {
  const w = (h * 303) / 417;
  return (
    <svg x={x} y={y} width={w} height={h} viewBox="0 0 303 417" fill={color}>
      <rect x={10.3} y={86.2} width={282.9} height={130.2} rx={26} transform="rotate(45.03 151.7 151.3)" />
      <rect x={29.4} y={261.6} width={130.2} height={122.4} rx={24.5} transform="rotate(134.95 94.5 322.8)" />
    </svg>
  );
}

function fmtVol(n: number): string {
  return n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${Math.round(n / 1000)}k`;
}
function bandLabel(tiers: PriceTier[], i: number): string {
  const t = tiers[i];
  if (t.max == null) {
    const prev = tiers[i - 1]?.max;
    return prev != null ? `Above ${fmtVol(prev)} / month` : "All volumes";
  }
  if (i === 0) return `Up to ${fmtVol(t.max)} / month`;
  const prev = tiers[i - 1]?.max;
  return prev != null ? `${fmtVol(prev)} - ${fmtVol(t.max)} / month` : `Up to ${fmtVol(t.max)} / month`;
}

function BrazilFlag() {
  return (
    <g>
      <rect x={40} y={30} width={61} height={41} rx={6} fill="#009c3b" stroke="#4a4f57" strokeWidth={0.75} />
      <path d="M70.5 34 L94 50.5 L70.5 67 L47 50.5 Z" fill="#fedf00" />
      <clipPath id="pp-flag-circle">
        <circle cx={70.5} cy={50.5} r={10.5} />
      </clipPath>
      <circle cx={70.5} cy={50.5} r={10.5} fill="#002776" />
      <rect x={59} y={47} width={23} height={4} fill="#ffffff" transform="rotate(-9 70.5 50.5)" clipPath="url(#pp-flag-circle)" />
    </g>
  );
}

function PriceCardSvg({
  x,
  symbol,
  accent,
  title,
  sub,
  comp,
  render,
}: {
  x: number;
  /** Badge glyph: the Pix mark, or a "$" for the FX card. */
  symbol: "pix" | "dollar";
  /** The table's Trace colour — badge fill, bullets, and values all use it. */
  accent: string;
  title: string;
  sub: string;
  comp: PriceComponent;
  render: (v: number) => string;
}) {
  const rows: { label: string; value: string }[] =
    comp.type === "flat"
      ? [{ label: "All volumes", value: render(comp.flat ?? comp.tiers[0]?.value ?? 0) }]
      : comp.tiers.map((t, i) => ({ label: bandLabel(comp.tiers, i), value: render(t.value) }));
  // Distribute the rows evenly through a fixed body band so 1-row (flat) and
  // 5-row (tiered) cards both fill their card with even rhythm — no dead space,
  // no cramping, matched card heights.
  const CARD_TOP = 112;
  const CARD_H = 331;
  const bodyTop = 208;
  const bodyBottom = CARD_TOP + CARD_H - 22;
  const pitch = (bodyBottom - bodyTop) / rows.length;
  const padX = 30;
  return (
    <g>
      <rect x={x} y={CARD_TOP} width={436} height={CARD_H} rx={14} fill={PP.card} stroke={PP.hairline} strokeWidth={0.75} />
      <circle cx={x + 45} cy={157} r={20} fill={accent} />
      {symbol === "pix" ? (
        <svg x={x + 45 - 12} y={157 - 12} width={24} height={24} viewBox="0 0 24 24">
          <path d={PIX_MARK} fill={PP.badgeInk} />
        </svg>
      ) : (
        <text x={x + 45} y={164} fontSize={20} fontWeight={700} fill={PP.badgeInk} textAnchor="middle">
          $
        </text>
      )}
      <text x={x + 75} y={156} fontSize={20} fontWeight={700} fill={PP.text}>
        {title}
      </text>
      <text x={x + 75} y={175} fontSize={10.5} fill={PP.grey}>
        {sub}
      </text>
      <line x1={x + 25} y1={194} x2={x + 411} y2={194} stroke={PP.hairline} strokeWidth={0.75} />
      {rows.map((r, i) => {
        const yc = bodyTop + (i + 0.5) * pitch; // row centre
        return (
          <g key={i}>
            {i > 0 && (
              <line x1={x + padX} y1={bodyTop + i * pitch} x2={x + 436 - padX} y2={bodyTop + i * pitch} stroke={PP.rowline} strokeWidth={0.75} />
            )}
            <ArrowBullet x={x + padX + 1} y={yc - 6.5} h={13} color={accent} />
            <text x={x + padX + 27} y={yc + 4.5} fontSize={12.5} fill={PP.text}>
              {r.label}
            </text>
            <text x={x + 436 - padX} y={yc + 4.5} fontSize={13} fontWeight={700} fill={accent} textAnchor="end" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {r.value}
            </text>
            {comp.type === "flat" && (
              <text x={x + padX + 27} y={yc + 22} fontSize={10.5} fill={PP.grey}>
                A single rate across every monthly volume — no tiers to track.
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function pricingPageSlide(pricing: ProposalPricing, subLine: string, footerText?: string) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${DW} ${DH}`} width={DW} height={DH} style={{ fontFamily: "Inter, sans-serif" }}>
      <defs>
        <linearGradient id="pp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1313" />
          <stop offset="1" stopColor="#0a0d0d" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={DW} height={DH} fill="url(#pp-bg)" />
      <rect x={0} y={0} width={DW} height={1.6} fill={PP.green} />
      <text x={943} y={36} fontSize={11} fontWeight={700} fill={PP.text} textAnchor="end">
        Trace Finance
      </text>
      <BrazilFlag />
      <text x={112} y={61} fontSize={32} fontWeight={700} fill={PP.text}>
        Brazil
      </text>
      <text x={113} y={83} fontSize={13.5} fill={PP.green}>
        {subLine}
      </text>
      <PriceCardSvg
        x={40}
        symbol="pix"
        accent={PP.green}
        title="Pix API"
        sub={pricing.pix.type === "flat" ? "Flat per-payment fee (USD), all volumes" : "Per-payment fee (USD), tiered by volume"}
        comp={pricing.pix}
        render={(v) => `USD $${v.toFixed(2)} / pix`}
      />
      <PriceCardSvg
        x={485}
        symbol="dollar"
        accent={PP.blue}
        title="FX spread"
        sub={pricing.spread.type === "flat" ? "Spot + one flat spread" : "Spot + spread, tiered by volume"}
        comp={pricing.spread}
        render={(v) => `${v.toFixed(2)}%`}
      />
      {footerText && (
        <text x={36} y={514.8} fontSize={9} fill={PP.grey}>
          {footerText}
        </text>
      )}
      <image href={ASSETS.traceLockupMark} x={759.6} y={486.7} width={44.6} height={44.6} />
      <text x={808.6} y={516.2} fontSize={20} fontWeight={700} fill={PP.text}>
        Trace Finance
      </text>
    </svg>
  );
}

/** Render the customized pricing page as a 960×540 PNG data URL (proposal PDF). */
export async function renderPricingPagePng(
  pricing: ProposalPricing,
  subLine: string,
  footerText?: string,
): Promise<string> {
  // Render at 4× (≈288 DPI at the 960×540pt page = print quality) so the
  // text-dense rate page reads crisp beside the vector template pages, rather
  // than soft like a 2× screenshot.
  return renderDeckPng(pricingPageSlide(pricing, subLine, footerText), 4);
}

async function renderDeckPng(node: React.ReactElement, scale = SCALE): Promise<string> {
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
  const config: FlowConfig = { ...defaultConfig(flowId, "Acme"), clientRep: "Jane Doe", clientLogoPlate: "none" };
  return renderDeckPng(kind === "title" ? titleSlide(config) : flowSlide(config, flow, flow.title, deckFlowLabel(0, 1), flow.heroSupport?.collection));
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
  // Defer: revoking right after click() can abort the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
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
