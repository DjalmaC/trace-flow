import type { Currency, Flow, FlowConfig } from "../data/schema";
import { isPlatformFlow } from "../data/schema";

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
const GAP_CONVERT = 200; // wide enough that the converted token clears the hub plinth (R_SHOW) before the next box, while keeping dense flows on one screen

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
  /** Content's original node id when reordered (see FlowConfig.nodeOrder). */
  srcId?: string;
  label: string;
  kind: NodeKindOrEngine;
  lane: Flow["nodes"][number]["lane"];
  lines: string[];
  /** Topological column (longest distance from a source). Parallel origins —
   *  two payers into one account — share a column and stack vertically. */
  depth: number;
  /** On the main relay path (the rail). Off-trunk nodes are tributaries. */
  onTrunk: boolean;
  /** For the collapsed "Trace engine": how many internal steps it folds. */
  engineCount?: number;
  /** Render with the client's logo instead of the kind's default badge. */
  brandedClient?: boolean;
}

export interface LegLayout {
  index: number;
  from: string;
  to: string;
  /** SVG path for the connector (right edge of `from` → left edge of `to`).
   *  Straight along the rail; a smooth curve when a tributary joins it. */
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
  /** Not part of the relay rail — drawn as a curved tributary conduit with a
   *  resting token instead of the travelling one. */
  offTrunk?: boolean;
}

export interface HeadlineLayout {
  a: Box;
  b: Box;
  /** Which endpoint carries the configured client (logo slot). */
  aIsClient: boolean;
  bIsClient: boolean;
  aLabel: string;
  bLabel: string;
  /** Rename keys (srcId) of the machinery counterparts, for canvas editing. */
  aId: string;
  bId: string;
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
  /** Vertical centre of the relay rail (trunk nodes sit exactly here). */
  railY: number;
  brazilLabelX: number;
  abroadLabelX: number;
  /** Lane display names — "Brazil" / "Abroad" unless the proposal renames them
   *  (FlowConfig.laneLabels). */
  brazilLabel: string;
  abroadLabel: string;
  /** Machinery container frame — the CONT_Y/CONT_H defaults, grown vertically
   *  when branch rows need the room. Renderers frame the stage with these. */
  contY: number;
  contH: number;
  /** Technology-provider framing (FlowConfig.platform): the client's branded
   *  enclosure drawn around the whole machinery. */
  platformFrame?: { x: number; y: number; w: number; h: number };
  /** Outer bounds of the stage — the platform frame when present, else the
   *  container. ViewBoxes frame on these. */
  stageY: number;
  stageH: number;
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

// ─────────────────────────────────────────────────────────────────────────────
// Liquidity-hub layout (archetype "hub"). A horizontal client-journey rail —
// client on the left, the Trace desk (hub) in the centre, a counterparty on the
// right — with a pool of liquidity participants BELOW the rail, each trading
// two-way with the hub. Isolated from the corridor solver above; renders through
// HubStage, not MachineryStage.
// ─────────────────────────────────────────────────────────────────────────────
export function computeHubLayout(flow: Flow, config: FlowConfig): FlowLayout {
  const key = (n: { id: string; srcId?: string }) => `${flow.id}:${n.srcId ?? n.id}`;
  const labelOf = (n: FlowNodeT) => config.nodeLabels?.[key(n)] ?? n.label;
  const brandedOf = (n: FlowNodeT) => !!n.brandedClient || !!config.nodeBranded?.[key(n)];

  const pool = flow.nodes.filter((n) => n.pool);
  const journey = flow.nodes.filter((n) => !n.pool);
  const hubNode = journey.find((n) => n.kind === "trace") ?? journey[Math.floor(journey.length / 2)] ?? flow.nodes[0];
  const ends = journey.filter((n) => n.id !== hubNode.id);
  const leftEnd = ends[0];
  const rightEnd = ends[1];

  // geometry
  const railY = 224;
  const poolY = 430;
  const hubCx = 470;
  const SPAN = 300;
  const width = 940;
  const HUB_R = 44;

  const box = (cx: number, cy: number, w: number, h: number): Box => ({ x: cx - w / 2, y: cy - h / 2, w, h, cx, cy });
  const nodes: NodeLayout[] = [];

  // the hub itself — a trace node the renderer draws as the spinning mark
  nodes.push({ ...box(hubCx, railY, HUB_R * 2, HUB_R * 2), id: hubNode.id, srcId: hubNode.srcId, label: labelOf(hubNode), kind: "trace", lane: hubNode.lane, lines: [labelOf(hubNode)], depth: 1, onTrunk: true });
  if (leftEnd)
    nodes.push({ ...box(hubCx - SPAN, railY, NODE_W, NODE_H), id: leftEnd.id, srcId: leftEnd.srcId, label: labelOf(leftEnd), kind: leftEnd.kind, lane: leftEnd.lane, lines: wrapLabel(labelOf(leftEnd)), depth: 0, onTrunk: true, brandedClient: brandedOf(leftEnd) });
  if (rightEnd)
    nodes.push({ ...box(hubCx + SPAN, railY, NODE_W, NODE_H), id: rightEnd.id, srcId: rightEnd.srcId, label: labelOf(rightEnd), kind: rightEnd.kind, lane: rightEnd.lane, lines: wrapLabel(labelOf(rightEnd)), depth: 2, onTrunk: true, brandedClient: brandedOf(rightEnd) });

  // pool row, centred under the hub
  const POOL_W = 152, POOL_H = 56, GAP = 26;
  const totalW = pool.length * POOL_W + Math.max(0, pool.length - 1) * GAP;
  const startX = hubCx - totalW / 2;
  pool.forEach((p, i) => {
    const cx = startX + i * (POOL_W + GAP) + POOL_W / 2;
    nodes.push({ ...box(cx, poolY, POOL_W, POOL_H), id: p.id, srcId: p.srcId, label: labelOf(p), kind: p.kind, lane: p.lane, lines: wrapLabel(labelOf(p)), depth: 3, onTrunk: false, brandedClient: brandedOf(p) });
  });

  const byId = new Map(nodes.map((nd) => [nd.id, nd] as const));
  const legs: LegLayout[] = flow.legs.map((l, i) => {
    const f = byId.get(l.from), t = byId.get(l.to);
    const x1 = f?.cx ?? hubCx, y1 = f?.cy ?? railY, x2 = t?.cx ?? hubCx, y2 = t?.cy ?? railY;
    return { index: i, from: l.from, to: l.to, d: `M${x1} ${y1} L${x2} ${y2}`, x1, y1, x2, y2, carries: l.carries, convertsTo: l.convertsTo, mid: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, offTrunk: f?.onTrunk === false || t?.onTrunk === false };
  });

  const primary = leftEnd && leftEnd.kind === "client" ? leftEnd : journey.find((n) => n.kind === "client");
  const anchor = leftEnd ?? hubNode, far = rightEnd ?? hubNode;
  const headline: HeadlineLayout = {
    a: box(300, HEAD_Y + HEAD_H / 2, 220, HEAD_H),
    b: box(width - 300, HEAD_Y + HEAD_H / 2, 220, HEAD_H),
    aIsClient: true, bIsClient: false,
    aLabel: labelOf(anchor), bLabel: labelOf(far),
    aId: anchor.srcId ?? anchor.id, bId: far.srcId ?? far.id,
    d: "", carries: flow.headline.carries, convertsTo: flow.headline.convertsTo, mid: { x: width / 2, y: HEAD_Y },
  };

  const stageY = 118;
  const stageH = poolY + POOL_H / 2 + 66 - stageY;
  return {
    width, height: VIEW_H, nodes, legs, headline, projectors: [],
    dividerX: -9999, railY, brazilLabelX: -9999, abroadLabelX: -9999, brazilLabel: "", abroadLabel: "",
    contY: stageY, contH: stageH, stageY, stageH,
    reverse: config.direction === "disbursement",
    primaryClientId: primary?.id, collapsed: false,
  };
}
type FlowNodeT = Flow["nodes"][number];

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

type SrcNode = { id: string; srcId?: string; label: string; kind: NodeKindOrEngine; lane: Flow["nodes"][number]["lane"]; w: number; engineCount?: number; brandedClient?: boolean };
type SrcLeg = { from: string; to: string; carries: Currency; convertsTo?: Currency; hubAtEngine?: boolean };

const ENGINE_W = 212;

/** Detect a contiguous Trace-operated middle (kind trace/operational) strictly
 *  between the two headline counterparts. Collapsible when it folds >= 3 nodes. */
export function detectEngine(flow: Flow): EngineInfo | null {
  // Folding assumes one linear chain; a flow with a merge (fan-in) or split
  // keeps its full machinery.
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  for (const l of flow.legs) {
    outDeg.set(l.from, (outDeg.get(l.from) ?? 0) + 1);
    inDeg.set(l.to, (inDeg.get(l.to) ?? 0) + 1);
  }
  if (flow.nodes.some((n) => (inDeg.get(n.id) ?? 0) > 1 || (outDeg.get(n.id) ?? 0) > 1)) return null;
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

/** Apply a proposal's box reordering (edit mode): permute node CONTENT — label,
 *  kind, branding — across the flow's fixed slots. Slots keep their id, lane and
 *  every leg, so currencies, the conversion hub and the Brazil | Abroad border
 *  stay exactly where the flow put them; only what each box says moves. `srcId`
 *  remembers the content's home so renames travel with it. Ignores anything
 *  that isn't a full permutation of the flow's node ids. */
function applyNodeOrder(flow: Flow, config: FlowConfig): Flow {
  const order = config.nodeOrder?.[flow.id];
  if (!order) return flow;
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const valid =
    order.length === flow.nodes.length &&
    new Set(order).size === order.length &&
    order.every((id) => byId.has(id));
  if (!valid || order.every((id, i) => id === flow.nodes[i].id)) return flow;
  return {
    ...flow,
    nodes: flow.nodes.map((slot, i) => {
      const content = byId.get(order[i])!;
      return { ...slot, label: content.label, kind: content.kind, brandedClient: content.brandedClient, srcId: content.id };
    }),
  };
}

export function computeLayout(flow: Flow, config: FlowConfig, opts: { collapsed?: boolean } = {}): FlowLayout {
  // Liquidity-hub archetype takes a completely separate solver — the corridor
  // path below (trunk DP, Brazil|Abroad border, engine folding) never runs on
  // it, so hub flows can't destabilise the eleven corridor flows.
  if (flow.archetype === "hub") return computeHubLayout(flow, config);
  flow = applyNodeOrder(flow, config);
  // Technology-provider framing: the client wraps the flow, so no box inside
  // it carries their name or logo (and the headline pills stay generic).
  const platform = isPlatformFlow(config, flow.id);
  const reverse = config.direction === "disbursement";
  const engine = detectEngine(flow);
  const collapsed = !!opts.collapsed && !!engine;

  const D = (c: Currency) => c; // currency mapping happens at render time
  // per-proposal renames (double-click on the build canvas) — keyed on the
  // content's original id (srcId), so a rename follows its box through reorders
  const labelOf = (n: { id: string; label: string; srcId?: string }) =>
    config.nodeLabels?.[`${flow.id}:${n.srcId ?? n.id}`] ?? n.label;
  // per-proposal branding: a box the rep marked to carry the client logo (so a
  // flow can show a second client entity), OR the flow's own brandedClient flag
  const brandedOf = (n: { id: string; srcId?: string; brandedClient?: boolean }) =>
    n.brandedClient || !!config.nodeBranded?.[`${flow.id}:${n.srcId ?? n.id}`];

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
      if (!idSet.has(n.id)) srcNodes.push({ id: n.id, srcId: n.srcId, label: labelOf(n), kind: n.kind, lane: n.lane, w: NODE_W, brandedClient: brandedOf(n) });
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
    srcNodes = flow.nodes.map((n) => ({ id: n.id, srcId: n.srcId, label: labelOf(n), kind: n.kind, lane: n.lane, w: NODE_W, brandedClient: brandedOf(n) }));
    srcLegs = flow.legs.map((l) => ({ from: l.from, to: l.to, carries: l.carries, convertsTo: l.convertsTo }));
  }

  // ── topological columns (fan-in support) ──
  // depth = longest path from any source. A chain degenerates to one node per
  // column, reproducing the classic single-rail layout exactly; parallel
  // origins (two payers into one account) share a column and stack.
  const nodeIdx = new Map(srcNodes.map((n, i) => [n.id, i]));
  const depths = new Array<number>(srcNodes.length).fill(0);
  for (let pass = 0; pass < srcNodes.length; pass++) {
    let changed = false;
    for (const l of srcLegs) {
      const a = nodeIdx.get(l.from);
      const b = nodeIdx.get(l.to);
      if (a == null || b == null) continue;
      if (depths[b] < depths[a] + 1) {
        depths[b] = depths[a] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const colCount = srcNodes.length ? Math.max(...depths) + 1 : 0;

  // The trunk — the longest source→sink path — carries the relay; everything
  // else is a tributary that merges into it.
  const byDepthOrder = srcNodes.map((_, i) => i).sort((a, b) => depths[a] - depths[b]);
  const bestLen = new Array<number>(srcNodes.length).fill(0);
  const bestPrev = new Array<number>(srcNodes.length).fill(-1);
  const legPrev = new Array<number>(srcNodes.length).fill(-1);
  for (const i of byDepthOrder) {
    srcLegs.forEach((l, li) => {
      if (nodeIdx.get(l.from) !== i) return;
      const j = nodeIdx.get(l.to);
      if (j == null) return;
      if (bestLen[j] < bestLen[i] + 1) {
        bestLen[j] = bestLen[i] + 1;
        bestPrev[j] = i;
        legPrev[j] = li;
      }
    });
  }
  let trunkEnd = 0;
  bestLen.forEach((v, i) => {
    if (v > bestLen[trunkEnd]) trunkEnd = i;
  });
  const trunkNodeIdx = new Set<number>();
  const trunkLegIdx = new Set<number>();
  for (let i = trunkEnd; i >= 0; i = bestPrev[i]) {
    trunkNodeIdx.add(i);
    if (legPrev[i] >= 0) trunkLegIdx.add(legPrev[i]);
    if (bestPrev[i] === -1) break;
  }

  // ── column x positions: wider gap before a column any conversion enters ──
  const colMaxW: number[] = new Array(colCount).fill(NODE_W);
  srcNodes.forEach((n, i) => {
    colMaxW[depths[i]] = Math.max(colMaxW[depths[i]], n.w);
  });
  const colX: number[] = [];
  let cursor = PAD_X;
  for (let c = 0; c < colCount; c++) {
    if (c > 0) {
      const converts = srcLegs.some((l) => {
        const j = nodeIdx.get(l.to);
        return j != null && depths[j] === c && l.convertsTo;
      });
      cursor += colMaxW[c - 1] + (converts ? GAP_CONVERT : GAP_PLAIN);
    }
    colX.push(cursor);
  }
  const width = (colX[colCount - 1] ?? PAD_X) + (colMaxW[colCount - 1] ?? NODE_W) + PAD_X;

  // ── vertical placement: the trunk holds the rail. Every OFF-trunk node
  // belongs to a "branch" — a weakly-connected group of off-trunk nodes — and
  // each branch takes ONE consistent row: branches that FEED the trunk (payers,
  // sources of value) sit above the rail, branches that RECEIVE from it
  // (recipients) below, ordered left→right. A complex flow then reads as
  // parallel lanes meeting the main rail, instead of boxes stacked into
  // arbitrary up/down slots column by column. ──
  const STACK_OFF = 96;
  const uf = new Map<number, number>();
  const findUF = (a: number): number => {
    let r = a;
    while (uf.get(r) !== r) r = uf.get(r)!;
    return r;
  };
  srcNodes.forEach((_, i) => {
    if (!trunkNodeIdx.has(i)) uf.set(i, i);
  });
  for (const l of srcLegs) {
    const a = nodeIdx.get(l.from);
    const b = nodeIdx.get(l.to);
    if (a != null && b != null && uf.has(a) && uf.has(b)) uf.set(findUF(a), findUF(b));
  }
  const branches = new Map<number, number[]>();
  for (const i of uf.keys()) {
    const r = findUF(i);
    branches.set(r, [...(branches.get(r) ?? []), i]);
  }
  const rowOf = new Map<number, number>(); // node index -> signed row (0 = rail)
  {
    const above: { xs: number; members: number[] }[] = [];
    const below: { xs: number; members: number[] }[] = [];
    for (const members of branches.values()) {
      const inComp = new Set(members);
      let feeds = false;
      let receives = false;
      for (const l of srcLegs) {
        const a = nodeIdx.get(l.from);
        const b = nodeIdx.get(l.to);
        if (a == null || b == null) continue;
        if (inComp.has(a) && trunkNodeIdx.has(b)) feeds = true;
        if (trunkNodeIdx.has(a) && inComp.has(b)) receives = true;
      }
      const xs = Math.min(...members.map((i) => colX[depths[i]] ?? 0));
      (feeds && !receives ? above : below).push({ xs, members });
    }
    above.sort((p, q) => p.xs - q.xs).forEach((c, r) => c.members.forEach((i) => rowOf.set(i, -(r + 1))));
    below.sort((p, q) => p.xs - q.xs).forEach((c, r) => c.members.forEach((i) => rowOf.set(i, r + 1)));
  }
  const rowsAbove = Math.max(0, ...[...rowOf.values()].map((r) => (r < 0 ? -r : 0)));
  const rowsBelow = Math.max(0, ...[...rowOf.values()].map((r) => (r > 0 ? r : 0)));
  const cyFor = (i: number): number => (trunkNodeIdx.has(i) ? BAND_Y : BAND_Y + (rowOf.get(i) ?? 1) * STACK_OFF);

  // The machinery container grows to hold extra rows (the classic single flow
  // and one-payer fan-ins keep the exact default frame).
  const contY = Math.min(CONT_Y, BAND_Y - rowsAbove * STACK_OFF - NODE_H / 2 - 44);
  const contH = Math.max(CONT_Y + CONT_H, BAND_Y + rowsBelow * STACK_OFF + NODE_H / 2 + 28) - contY;

  const nodes: NodeLayout[] = srcNodes.map((node, i) => {
    const c = depths[i];
    const x = colX[c] + (colMaxW[c] - node.w) / 2;
    const h = node.kind === "engine" ? 88 : NODE_H;
    const cy = cyFor(i);
    return {
      id: node.id,
      srcId: node.srcId,
      label: node.label,
      kind: node.kind,
      lane: node.lane,
      lines: wrapLabel(node.label),
      depth: c,
      onTrunk: trunkNodeIdx.has(i),
      engineCount: node.engineCount,
      brandedClient: node.brandedClient,
      x,
      y: cy - h / 2,
      w: node.w,
      h,
      cx: x + node.w / 2,
      cy,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // The technology-provider frame hugs the payment flow ITSELF — the boxes
  // and rail — inside the machinery container, clear of the lane labels.
  const FRAME_PAD = 30;
  const platformFrame = platform && nodes.length
    ? (() => {
        const minX = Math.min(...nodes.map((n) => n.x)) - FRAME_PAD;
        const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + FRAME_PAD;
        const minY = Math.min(...nodes.map((n) => n.y)) - FRAME_PAD;
        const maxY = Math.max(...nodes.map((n) => n.y + n.h)) + FRAME_PAD;
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      })()
    : undefined;
  // The lane labels (contY + 56) must sit ABOVE the platform frame — branch
  // rows can push the frame's top past them, which would trap "Brazil" and
  // "Abroad" inside the client's brand boundary. Grow the container upward
  // until the labels clear the frame.
  let contYv = contY;
  let contHv = contH;
  if (platformFrame && contYv + 56 > platformFrame.y - 16) {
    const newTop = platformFrame.y - 72;
    contHv += contYv - newTop;
    contYv = newTop;
  }
  // Stage bounds: the container, stretched only if the frame's chip/caption
  // need room (branch rows below can push the caption past the container).
  const stageYv = platformFrame ? Math.min(contYv, platformFrame.y - 26) : contYv;
  const stageHv = (platformFrame ? Math.max(contYv + contHv, platformFrame.y + platformFrame.h + 46) : contYv + contHv) - stageYv;

  // ── divider between the Brazil lane and the Abroad lane ──
  // Sit it in the widest horizontal gap between two adjacent nodes of different
  // lanes, so it lands on the real border regardless of which lane is drawn on
  // the left (e.g. abroad-first flows like #11.1, not just Brazil-first ones).
  const engineNodeL = byId.get(ENGINE_ID);
  const brazilNodes = nodes.filter((n) => n.lane === "brazil");
  const abroadNodes = nodes.filter((n) => n.lane === "abroad");
  const byX = [...nodes].sort((a, b) => a.x - b.x);
  let gapMid = width / 2;
  let bestGap = -Infinity;
  for (let i = 0; i < byX.length - 1; i++) {
    if (byX[i].lane === byX[i + 1].lane) continue;
    const gap = byX[i + 1].x - (byX[i].x + byX[i].w);
    if (gap > bestGap) {
      bestGap = gap;
      gapMid = (byX[i].x + byX[i].w + byX[i + 1].x) / 2;
    }
  }
  // ── legs: straight connectors along the rail; a tributary (off-trunk leg or
  // any leg whose ends sit at different heights) draws as a smooth S-curve
  // merging into its target. ──
  const legs: LegLayout[] = srcLegs.map((leg, index) => {
    const from = byId.get(leg.from)!;
    const to = byId.get(leg.to)!;
    const y1 = from.cy;
    const y2 = to.cy;
    const straight = y1 === y2;
    // Straight rail legs span box edge to box edge. A curved tributary anchors
    // at the box CENTERS instead — its round caps hide under the boxes exactly
    // the way the rail tucks its own ends — and approaches with a flat tangent,
    // so it merges into the rail parallel, like a tributary joining a river.
    const x1 = straight ? from.x + from.w : from.cx;
    const x2 = straight ? to.x : to.cx;
    // the folded engine's conversion hub sits AT the engine center
    const midX = leg.hubAtEngine ? to.cx : (x1 + x2) / 2;
    const dx = Math.max(64, Math.abs(x2 - x1) * 0.55);
    return {
      index,
      from: leg.from,
      to: leg.to,
      d: straight ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`,
      x1,
      y1,
      x2,
      y2,
      carries: leg.carries,
      convertsTo: leg.convertsTo,
      mid: { x: midX, y: straight ? y1 : (y1 + y2) / 2 },
      offTrunk: !trunkLegIdx.has(index) || undefined,
    };
  });

  // A branch curve's resting chip sits at the curve's midpoint — when that
  // midpoint lands beside a rail conversion hub, slide the chip back along
  // the curve so the two never crowd each other.
  const bez = (t: number, p0: number, p1: number, p2: number, p3: number) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };
  const railHubXs = legs.filter((l) => l.convertsTo && !l.offTrunk).map((l) => l.mid.x);
  for (const l of legs) {
    if (!l.offTrunk || l.y1 === l.y2 || l.convertsTo) continue;
    if (railHubXs.some((hx) => Math.abs(hx - l.mid.x) < 64)) {
      const dxc = Math.max(64, Math.abs(l.x2 - l.x1) * 0.55);
      const t = 0.3;
      l.mid = {
        x: bez(t, l.x1, l.x1 + dxc, l.x2 - dxc, l.x2),
        y: bez(t, l.y1, l.y1, l.y2, l.y2),
      };
    }
  }

  // The divider is the regulatory story, and the FX engine converts AT the
  // border — so when a leg crosses the lanes, the divider runs through that
  // leg's hub (its midpoint when nothing converts on it), preferring the rail's
  // own crossing. Only lane-adjacency (no crossing leg) falls back to the
  // widest-gap scan above.
  const crossing = legs.filter((l) => {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    return a && b && a.lane !== b.lane;
  });
  const borderLeg =
    crossing.find((l) => l.convertsTo && !l.offTrunk) ??
    crossing.find((l) => l.convertsTo) ??
    crossing.find((l) => !l.offTrunk) ??
    crossing[0];
  const dividerX = engineNodeL
    ? engineNodeL.cx // the folded engine straddles the border
    : borderLeg
      ? borderLeg.mid.x
      : brazilNodes.length && abroadNodes.length
        ? gapMid
        : width / 2;

  const laneCenter = (ns: NodeLayout[]) => {
    const x0 = Math.min(...ns.map((n) => n.x));
    const x1 = Math.max(...ns.map((n) => n.x + n.w));
    return (x0 + x1) / 2;
  };
  const brazilLabelX = brazilNodes.length ? laneCenter(brazilNodes) : dividerX / 2;
  const abroadLabelX = abroadNodes.length ? laneCenter(abroadNodes) : (dividerX + width) / 2;

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
  // When a reorder moved the client box off its headline slot, the logo travels
  // with it — otherwise the primary stays a headline endpoint, as always.
  const reordered = flow.nodes.some((n) => n.srcId && n.srcId !== n.id);
  const primaryClientMach = platform
    ? undefined
    : aMach.kind === "client"
      ? aMach
      : bMach.kind === "client"
        ? bMach
        : reordered
          ? nodes.find((n) => n.kind === "client")
          : undefined;

  const headline: HeadlineLayout = {
    a,
    b,
    aIsClient: !platform && aIsPrimary && aMach.kind === "client",
    bIsClient: !platform && !aIsPrimary && bMach.kind === "client",
    aLabel: aMach.label,
    bLabel: bMach.label,
    aId: aMach.srcId ?? aMach.id,
    bId: bMach.srcId ?? bMach.id,
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
    railY: BAND_Y,
    brazilLabelX,
    abroadLabelX,
    brazilLabel: config.laneLabels?.[flow.id]?.brazil?.trim() || "Brazil",
    abroadLabel: config.laneLabels?.[flow.id]?.abroad?.trim() || "Abroad",
    contY: contYv,
    contH: contHv,
    platformFrame,
    stageY: stageYv,
    stageH: stageHv,
    reverse,
    primaryClientId: primaryClientMach?.id,
    engine: engine ?? undefined,
    collapsed,
  };
}
