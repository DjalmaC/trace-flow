// ─────────────────────────────────────────────────────────────────────────────
// Visual design tokens — ported exactly from the Trace deck (build brief §6 +
// flowrender_dark.py). Canonical source; tailwind.config.ts mirrors these.
// Keep as tokens so a future merge into the Router can reconcile themes (§9).
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // deck background
  base: "#08090b",
  glow1: "#15392d",
  glow2: "#0b1714",
  rule: "#4cc28e",

  // operational / gray node
  nodeFill: "#121815",
  nodeStroke: "#2b3a34",
  nodeText: "#c2c9c5",

  // headline / green node + accents
  green: "#46d39a",
  greenFill: "#11241b",
  greenText: "#eaf6ef",

  // currency pill
  pillFill: "#1a221e",
  pillStroke: "#33433c",
  pillText: "#d6ddd8",

  // swap capsule
  capFill: "#141b18",
  capStroke: "#33433c",

  // lines & type
  leg: "#7c8a84",
  muted: "#6f7a76",
  title: "#eef1ee",
  subtitle: "#aeb6b2",
  client: "#7fb89f",

  // client-logo dashed slot
  clientSlot: "#4f6a5e",

  // divider / container
  divider: "#2c3a35",

  // projector ("same actor") line
  projector: "#3f6b5a",

  // trace mark
  traceCyan: "#2be8d6",
  traceGreen: "#34dca0",

  // stablecoins
  usdc: "#2775CA",
  usdt: "#26A17B",

  // ── elevated material (trace_hero_mock.html) ──────────────────────────────
  // Flat solid surfaces + hairline border + 1px top rim-light + soft neutral
  // drop shadow. NO fill gradients (they read cheap), no neon glow.
  page: "#07090b", // page base, a hair below the elevated plane
  surface: "#0f1411", // elevated node/plane fill (flat)
  surfaceTube: "#0a110d", // tube/conduit channel fill (flat, recessed)
  rim: "rgba(255,255,255,0.10)", // 1px top rim-light just inside the top edge
  hairline: "rgba(255,255,255,0.10)", // neutral hairline border (operational)
  borderGreen: "rgba(70,211,154,0.22)", // restrained green border (foreground/client)
  borderGreenStrong: "rgba(70,211,154,0.35)", // hub / emphasis green rim
  tokenFill: "#0c160f", // moving currency token fill
  ambientGlow1: "rgba(22,35,29,0.55)", // soft radial light core
  ambientGlow2: "rgba(13,22,17,0.18)",
  vignette: "rgba(0,0,0,0.45)",
} as const;

// asset paths (served from /public)
export const ASSETS = {
  traceLogo: "/assets/trace_logo.png",
  // Square (1200×1200) lockup mark extracted from the proposal templates, so the
  // bottom-right lockup on generated deck slides matches the template pages.
  traceLockupMark: "/assets/trace_lockup_mark.png",
  usdc: "/assets/usdc.png",
  usdt: "/assets/usdt.png",
} as const;

export const TRACE_LOGO_AR = 1.576; // width / height of the extracted mark

// Direction drives the brand color (echoing the logo's two arrows): pay-in is
// Trace green + right-facing; pay-out is Trace cyan + left-facing.
export function accentFor(direction: "collection" | "disbursement"): string {
  return direction === "collection" ? C.green : C.traceCyan;
}
/** Faint direction-tinted tube fill. */
export function tubeTint(direction: "collection" | "disbursement"): string {
  return direction === "collection" ? "rgba(70,211,154,0.06)" : "rgba(43,232,214,0.06)";
}
