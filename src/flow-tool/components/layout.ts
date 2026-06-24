import type { Currency, Flow, FlowConfig } from "../data/schema";

// ─────────────────────────────────────────────────────────────────────────────
// The layout engine. Takes (Flow, FlowConfig) and computes pure geometry — node
// boxes, elbow legs, conversion points, the headline arc, and the "same actor"
// projector lines. The renderer is dumb: it only draws what this returns.
//
// All eleven Brazil flows are linear chains, so the machinery is a horizontal
// rail partitioned by the Brazil | Abroad divide. Conversion legs get a wider
// gap so a swap capsule fits; plain legs are tight.
// ─────────────────────────────────────────────────────────────────────────────

export const VIEW_H = 560;
const NODE_W = 168;
const NODE_H = 58;
const PAD_X = 56;
const GAP_PLAIN = 92;
const GAP_CONVERT = 208;

const BAND_Y = 412; // machinery node vertical center
const HEAD_Y = 64; // headline node top
const HEAD_H = 46;
export const CONT_Y = 168; // machinery container top
export const CONT_H = 372;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export type NodeKindOrEngine = Flow["nodes"][number]["kind"] | "engine";

export interface NodeLayout extends Box {
  id: string;
  label: string;
  kind: NodeKindOrEngine;
  lane: Flow["nodes"][number]["lane"];
  lines: string[];
  /** For the collapsed "Trace engine": how many internal steps it folds. */
  engineCount?: number;
}

export interface LegLayout {
  index: number;
  from: string;
  to: string;
  /** SVG path for the connector (right edge of `from` → left edge of `to`). */
  d: string;
  /** Travel endpoints (already oriented for collection; reverse for disbursement). */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  carries: Currency;
  convertsTo?: Currency;
  /** Mid-leg point where the token/swap sits. */
  mid: { x: number; y: number };
}

export interface HeadlineLayout {
  a: Box;
  b: Box;
  /** Which endpoint carries the configured client (logo slot). */
  aIsClient: boolean;
  bIsClient: boolean;
  aLabel: string;
  bLabel: string;
  /** Arc path A → B. */
  d: string;
  carries: Currency;
  convertsTo?: Currency;
  mid: { x: number; y: number };
}

export interface ProjectorLayout {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface FlowLayout {
  width: number;
  height: number;
  nodes: NodeLayout[];
  legs: LegLayout[];
  headline: HeadlineLayout;
  projectors: ProjectorLayout[];
  dividerX: number;
  brazilLabelX: number;
  abroadLabelX: number;
  reverse: boolean;
  /** Machinery node that carries the uploaded client logo (the primary client). */
  primaryClientId?: string;
  /** Present when this flow has a collapsible Trace-operated middle. */
  engine?: EngineInfo;
  /** Whether this layout was built in the collapsed (engine-folded) form. */
  collapsed: boolean;
}

/** A contiguous Trace-operated middle that can fold into a single "engine". */
export interface EngineInfo {
  /** Ids of the internal flow nodes the engine folds (in order). */
  ids: string[];
  label: string;
  count: number;
}

export const ENGINE_ID = "__engine__";

/** Naive label wrap: split into <=2 lines near the middle on a word boundary. */
function wrapLabel(label: string): string[] {
  if (label.length <= 20) return [label];
  const words = label.split(" ");
  const mid = Math.ceil(label.length / 2);
  let acc = 0;
  let split = words.length - 1;
  for (let i = 0; i < words.length; i++) {
    acc += words[i].length + 1;
    if (acc >= mid) {
      split = i;
      break;
    }
  }
  const l1 = words.slice(0, split + 1).join(" ");
  const l2 = words.slice(split + 1).join(" ");
  return l2 ? [l1, l2] : [l1];
}

type SrcNode = { id: string; label: string; kind: NodeKindOrEngine; lane: Flow["nodes"][number]["lane"]; w: number; engineCount?: number };
type SrcLeg = { from: string; to: string; carries: Currency; convertsTo?: Currency; hubAtEngine?: boolean };

const ENGINE_W = 212;

/** Detect a contiguous Trace-operated middle (kind trace/operational) strictly
 *  between the two headline counterparts. Collapsible when it folds >= 3 nodes. */
export function detectEngine(flow: Flow): EngineInfo | null {
  const counterpart = (id: string) =>
    flow.sameActor.find((s) => s.headlineNode === id)?.machineryNode ?? id;
  const ai = flow.nodes.findIndex((n) => n.id === counterpart(flow.headline.partyA));
  const bi = flow.nodes.findIndex((n) => n.id === counterpart(flow.headline.partyB));
  if (ai < 0 || bi < 0) return null;
  const lo = Math.min(ai, bi);
  const hi = Math.max(ai, bi);
  const internal = (i: number) => flow.nodes[i].kind === "trace" || flow.nodes[i].kind === "operational";
  let best: number[] = [];
  let k = lo + 1;
  while (k < hi) {
    if (internal(k)) {
      let j = k;
      const run: number[] = [];
      while (j < hi && internal(j)) run.push(j++);
      if (run.length > best.length) best = run;
      k = j;
    } else k++;
  }
  if (best.length < 3) return null;
  return { ids: best.map((i) => flow.nodes[i].id), label: "Trace · cross-border & conversion", count: best.length };
}

export function computeLayout(flow: Flow, config: FlowConfig, opts: { collapsed?: boolean } = {}): FlowLayout {
  const reverse = config.direction === "disbursement";
  const engine = detectEngine(flow);
  const collapsed = !!opts.collapsed && !!engine;

  const D = (c: Currency) => c; // currency mapping happens at render time

  // ── build the effective node/leg lists (full, or with the engine folded) ──
  let srcNodes: SrcNode[];
  let srcLegs: SrcLeg[];
  if (collapsed && engine) {
    const idSet = new Set(engine.ids);
    const first = engine.ids[0];
    const last = engine.ids[engine.ids.length - 1];
    const enterLeg = flow.legs.find((l) => l.to === first)!;
    const exitLeg = flow.legs.find((l) => l.from === last)!;
    const outputCurrency = exitLeg.convertsTo ?? exitLeg.carries;
    const engineNode: SrcNode = {
      id: ENGINE_ID,
      label: engine.label,
      kind: "engine",
      lane: flow.nodes.find((n) => n.id === first)!.lane,
      w: ENGINE_W,
      engineCount: engine.count,
    };
    srcNodes = [];
    flow.nodes.forEach((n) => {
      if (n.id === first) srcNodes.push(engineNode);
      if (!idSet.has(n.id)) srcNodes.push({ id: n.id, label: n.label, kind: n.kind, lane: n.lane, w: NODE_W });
    });
    srcLegs = [];
    flow.legs.forEach((l) => {
      const fromIn = idSet.has(l.from);
      const toIn = idSet.has(l.to);
      if (fromIn && toIn) return; // internal — folded away
      if (l.to === first) srcLegs.push({ from: l.from, to: ENGINE_ID, carries: D(l.carries), convertsTo: D(outputCurrency), hubAtEngine: true });
      else if (l.from === last) srcLegs.push({ from: ENGINE_ID, to: l.to, carries: D(outputCurrency) });
      else srcLegs.push({ from: l.from, to: l.to, carries: D(l.carries), convertsTo: l.convertsTo });
    });
  } else {
    srcNodes = flow.nodes.map((n) => ({ id: n.id, label: n.label, kind: n.kind, lane: n.lane, w: NODE_W }));
    srcLegs = flow.legs.map((l) => ({ from: l.from, to: l.to, carries: l.carries, convertsTo: l.convertsTo }));
  }

  // ── machinery nodes: horizontal chain, wider gap before a conversion leg ──
  const xs: number[] = [];
  let cursor = PAD_X;
  srcNodes.forEach((node, i) => {
    if (i > 0) {
      const incoming = srcLegs.find((l) => l.to === node.id);
      const gap = incoming?.convertsTo ? GAP_CONVERT : GAP_PLAIN;
      cursor += srcNodes[i - 1].w + gap;
    }
    xs.push(cursor);
  });
  const lastW = srcNodes[srcNodes.length - 1]?.w ?? NODE_W;
  const width = cursor + lastW + PAD_X;

  const nodes: NodeLayout[] = srcNodes.map((node, i) => {
    const x = xs[i];
    const h = node.kind === "engine" ? 88 : NODE_H;
    const y = BAND_Y - h / 2;
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      lane: node.lane,
      lines: wrapLabel(node.label),
      engineCount: node.engineCount,
      x,
      y,
      w: node.w,
      h,
      cx: x + node.w / 2,
      cy: BAND_Y,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // ── divider between the last Brazil node and the first Abroad node ──
  const engineNodeL = byId.get(ENGINE_ID);
  const lastBrazil = nodes.filter((n) => n.lane === "brazil").at(-1);
  const firstAbroad = nodes.find((n) => n.lane === "abroad");
  const dividerX = engineNodeL
    ? engineNodeL.cx // the folded engine straddles the border
    : lastBrazil && firstAbroad
      ? (lastBrazil.x + lastBrazil.w + firstAbroad.x) / 2
      : width / 2;

  const brazilNodes = nodes.filter((n) => n.lane === "brazil");
  const abroadNodes = nodes.filter((n) => n.lane === "abroad");
  const brazilLabelX = brazilNodes.length
    ? (brazilNodes[0].x + brazilNodes.at(-1)!.cx) / 2
    : dividerX / 2;
  const abroadLabelX = abroadNodes.length
    ? (abroadNodes[0].cx + abroadNodes.at(-1)!.x + abroadNodes.at(-1)!.w) / 2
    : (dividerX + width) / 2;

  // ── legs: straight horizontal connectors along the rail ──
  const legs: LegLayout[] = srcLegs.map((leg, index) => {
    const from = byId.get(leg.from)!;
    const to = byId.get(leg.to)!;
    const x1 = from.x + from.w;
    const x2 = to.x;
    const y = BAND_Y;
    // the folded engine's conversion hub sits AT the engine center
    const midX = leg.hubAtEngine ? to.cx : (x1 + x2) / 2;
    return {
      index,
      from: leg.from,
      to: leg.to,
      d: `M${x1} ${y} L${x2} ${y}`,
      x1,
      y1: y,
      x2,
      y2: y,
      carries: leg.carries,
      convertsTo: leg.convertsTo,
      mid: { x: midX, y },
    };
  });

  // ── headline: two foreground nodes above their machinery counterparts ──
  const counterpart = (headlineId: string): NodeLayout | undefined => {
    const link = flow.sameActor.find((s) => s.headlineNode === headlineId);
    return link ? byId.get(link.machineryNode) : byId.get(headlineId);
  };
  const aMach = counterpart(flow.headline.partyA) ?? nodes[0];
  const bMach = counterpart(flow.headline.partyB) ?? nodes.at(-1)!;

  const HEAD_W = 188;
  const headBox = (cx: number): Box => ({
    x: cx - HEAD_W / 2,
    y: HEAD_Y,
    w: HEAD_W,
    h: HEAD_H,
    cx,
    cy: HEAD_Y + HEAD_H / 2,
  });
  const a = headBox(aMach.cx);
  const b = headBox(bMach.cx);
  const arcY = a.y + HEAD_H / 2;
  const dipY = arcY + 64;
  const ax = a.x + a.w;
  const bx = b.x;
  const arcMidX = (ax + bx) / 2;

  // The uploaded logo lands on exactly one node — the primary client, which is
  // the client-kind headline endpoint (prefer A). Other client-kind nodes (a
  // second customer) render their own label until two-logo input lands in v2.
  const aIsPrimary = aMach.kind === "client" || bMach.kind !== "client";
  const primaryClientMach =
    aMach.kind === "client" ? aMach : bMach.kind === "client" ? bMach : undefined;

  const headline: HeadlineLayout = {
    a,
    b,
    aIsClient: aIsPrimary && aMach.kind === "client",
    bIsClient: !aIsPrimary && bMach.kind === "client",
    aLabel: aMach.label,
    bLabel: bMach.label,
    d: `M${ax} ${arcY} Q${arcMidX} ${dipY} ${bx} ${arcY}`,
    carries: flow.headline.carries,
    convertsTo: flow.headline.convertsTo,
    mid: { x: arcMidX, y: dipY - 16 },
  };

  // ── projector ("same actor") lines from headline nodes to machinery ──
  const projectors: ProjectorLayout[] = [
    { x1: a.cx, y1: a.y + a.h, x2: aMach.cx, y2: aMach.y },
    { x1: b.cx, y1: b.y + b.h, x2: bMach.cx, y2: bMach.y },
  ];

  return {
    width,
    height: VIEW_H,
    nodes,
    legs,
    headline,
    projectors,
    dividerX,
    brazilLabelX,
    abroadLabelX,
    reverse,
    primaryClientId: primaryClientMach?.id,
    engine: engine ?? undefined,
    collapsed,
  };
}
