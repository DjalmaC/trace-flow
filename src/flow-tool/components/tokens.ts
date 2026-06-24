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
} as const;

// asset paths (served from /public)
export const ASSETS = {
  traceLogo: "/assets/trace_logo.png",
  usdc: "/assets/usdc.png",
  usdt: "/assets/usdt.png",
} as const;

export const TRACE_LOGO_AR = 1.576; // width / height of the extracted mark
