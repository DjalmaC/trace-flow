import type { Currency, Flow, FlowConfig, Leg } from "../data/schema";

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

export interface NodeLayout extends Box {
  id: string;
  label: string;
  kind: Flow["nodes"][number]["kind"];
  lane: Flow["nodes"][number]["lane"];
  lines: string[];
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
}

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

export function computeLayout(flow: Flow, config: FlowConfig): FlowLayout {
  const reverse = config.direction === "disbursement";

  // ── machinery nodes: horizontal chain, wider gap before a conversion leg ──
  const legByFrom = new Map<string, Leg>();
  flow.legs.forEach((l) => legByFrom.set(l.from, l));

  const xs: number[] = [];
  let cursor = PAD_X;
  flow.nodes.forEach((node, i) => {
    if (i > 0) {
      const incoming = flow.legs.find((l) => l.to === node.id);
      const gap = incoming?.convertsTo ? GAP_CONVERT : GAP_PLAIN;
      cursor += NODE_W + gap;
    }
    xs.push(cursor);
  });
  const width = cursor + NODE_W + PAD_X;

  const nodes: NodeLayout[] = flow.nodes.map((node, i) => {
    const x = xs[i];
    const y = BAND_Y - NODE_H / 2;
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      lane: node.lane,
      lines: wrapLabel(node.label),
      x,
      y,
      w: NODE_W,
      h: NODE_H,
      cx: x + NODE_W / 2,
      cy: BAND_Y,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // ── divider between the last Brazil node and the first Abroad node ──
  const lastBrazil = nodes.filter((n) => n.lane === "brazil").at(-1);
  const firstAbroad = nodes.find((n) => n.lane === "abroad");
  const dividerX =
    lastBrazil && firstAbroad
      ? (lastBrazil.x + lastBrazil.w + firstAbroad.x) / 2
      : width / 2;

  const brazilNodes = nodes.filter((n) => n.lane === "brazil");
  const abroadNodes = nodes.filter((n) => n.lane === "abroad");
  const brazilLabelX = brazilNodes.length
    ? (brazilNodes[0].x + brazilNodes.at(-1)!.x + NODE_W) / 2
    : dividerX / 2;
  const abroadLabelX = abroadNodes.length
    ? (abroadNodes[0].x + abroadNodes.at(-1)!.x + NODE_W) / 2
    : (dividerX + width) / 2;

  // ── legs: straight horizontal connectors along the rail ──
  const legs: LegLayout[] = flow.legs.map((leg, index) => {
    const from = byId.get(leg.from)!;
    const to = byId.get(leg.to)!;
    const x1 = from.x + from.w;
    const x2 = to.x;
    const y = BAND_Y;
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
      mid: { x: (x1 + x2) / 2, y },
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
  };
}
