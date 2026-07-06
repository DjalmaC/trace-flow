import type { Flow, FlowNode, Headline, Lane, NodeKind } from "./schema";
import { computeTraceRole } from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// Tailored flows (design review §4/§6). A tailored flow is a plain Flow object
// — same schema, same layout engine, same renderers — built by a rep in the
// flow editor instead of shipped in the library. Three homes:
//
//   1. localStorage drafts (`tf:tailored-flows`): the rep's own, autosaved.
//   2. The module registry below: getFlow() falls through to it, so every
//      consumer (build canvas, client link, PDF export) resolves tailored
//      flows with zero call-site changes.
//   3. A shared link's config carries the tailored Flow objects it uses
//      (`customFlows`), and SharedFlowView registers them on load — the client
//      renders them exactly like library flows.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = "tf:tailored-flows";

// ── registry (getFlow fallback) ──────────────────────────────────────────────

const registry = new Map<string, Flow>();

export function registerCustomFlows(flows: Flow[] | undefined | null): void {
  for (const f of flows ?? []) {
    if (f && typeof f.id === "string" && Array.isArray(f.nodes)) registry.set(f.id, f);
  }
}
export function getCustomFlow(id: string): Flow | undefined {
  return registry.get(id);
}
export function unregisterCustomFlow(id: string): void {
  registry.delete(id);
}

// ── localStorage drafts ──────────────────────────────────────────────────────

export function listTailoredFlows(): Flow[] {
  try {
    const raw = localStorage.getItem(KEY);
    const flows = raw ? (JSON.parse(raw) as Flow[]) : [];
    registerCustomFlows(flows);
    return flows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

export function saveTailoredFlow(flow: Flow): void {
  const next = { ...flow, updatedAt: Date.now() };
  registerCustomFlows([next]);
  try {
    const rest = listTailoredFlows().filter((f) => f.id !== flow.id);
    localStorage.setItem(KEY, JSON.stringify([next, ...rest]));
  } catch {
    /* quota / private mode — the registry still has it for this session */
  }
}

export function deleteTailoredFlow(id: string): void {
  unregisterCustomFlow(id);
  try {
    localStorage.setItem(KEY, JSON.stringify(listTailoredFlows().filter((f) => f.id !== id)));
  } catch {
    /* ignore */
  }
}

// ── factories ────────────────────────────────────────────────────────────────

export function newCustomFlowId(): string {
  return `custom-${Math.random().toString(36).slice(2, 9)}`;
}
export function newNodeId(): string {
  return `n-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fork a flow into a tailored draft: deep copy, new identity, editor state. */
export function forkFlow(src: Flow, clientName?: string): Flow {
  const copy = JSON.parse(JSON.stringify(src)) as Flow;
  return {
    ...copy,
    id: newCustomFlowId(),
    displayId: "T",
    title: src.custom ? src.title : `${src.title} · tailored`,
    blurb: clientName ? `Tailored for ${clientName}, from flow ${src.displayId}.` : `Tailored, from flow ${src.displayId}.`,
    custom: true,
    customFor: clientName,
    updatedAt: Date.now(),
    editor: copy.editor ?? { pos: {}, notes: [] },
  };
}

/** A minimal viable blank: payer → client across the border, one converting leg. */
export function blankFlow(clientName = "Your Client"): Flow {
  const payer: FlowNode = { id: newNodeId(), label: "BR payer", kind: "operational", lane: "brazil" };
  const client: FlowNode = { id: newNodeId(), label: clientName, kind: "client", lane: "abroad" };
  const flow: Flow = {
    id: newCustomFlowId(),
    displayId: "T",
    title: "New tailored flow",
    blurb: `Tailored for ${clientName}.`,
    dials: { model: "VA", rail: "direct-fiat", nraOwnership: "none", pixRole: "none", localLp: false },
    traceRole: [],
    directions: ["collection", "disbursement"],
    headline: { partyA: payer.id, partyB: client.id, carries: "BRL", convertsTo: "USD/EUR" },
    nodes: [payer, client],
    legs: [{ from: payer.id, to: client.id, carries: "BRL", convertsTo: "USD/EUR", crosses: true }],
    sameActor: [],
    custom: true,
    customFor: clientName,
    updatedAt: Date.now(),
    editor: { pos: {}, notes: [] },
  };
  return normalizeTailored(flow);
}

// ── normalization ────────────────────────────────────────────────────────────
// Keeps a hand-built flow inside the contract the layout engine expects:
// nodes ordered as the rail chain, headline endpoints valid, crosses flags and
// traceRole derived from the data.

export function deriveHeadline(flow: Flow): Headline {
  const first = flow.nodes[0];
  const last = flow.nodes[flow.nodes.length - 1];
  // Prefer real counterparts for the stage-1 arc: the first/last client-ish
  // node, falling back to the chain ends.
  const clientish = (n: FlowNode) => n.kind === "client" || n.kind === "merchant";
  const partyA = flow.nodes.find(clientish) ?? first;
  const partyB = [...flow.nodes].reverse().find((n) => clientish(n) && n.id !== partyA?.id) ?? last;
  const firstLeg = flow.legs[0];
  const lastConvert = [...flow.legs].reverse().find((l) => l.convertsTo);
  return {
    partyA: partyA?.id ?? first?.id ?? "",
    partyB: partyB?.id ?? last?.id ?? "",
    carries: firstLeg?.carries ?? "BRL",
    convertsTo: lastConvert?.convertsTo,
  };
}

export function normalizeTailored(flow: Flow): Flow {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  // Story order drives the deck rail. Topological order over the legs (Kahn),
  // breaking ties by editor x-position — so a merge (two payers into one
  // account) keeps both origins ahead of the account. Falls back to pure
  // x-order if the graph has a cycle.
  const pos = flow.editor?.pos ?? {};
  const px = (n: FlowNode) => pos[n.id]?.x ?? 0;
  const byX = (a: FlowNode, b: FlowNode) => px(a) - px(b);
  let nodes: FlowNode[] | null = null;
  {
    const inDeg = new Map<string, number>(flow.nodes.map((n) => [n.id, 0]));
    for (const l of flow.legs) if (inDeg.has(l.to) && byId.has(l.from)) inDeg.set(l.to, (inDeg.get(l.to) ?? 0) + 1);
    const queue = flow.nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).sort(byX);
    const order: FlowNode[] = [];
    while (queue.length) {
      const n = queue.shift()!;
      order.push(n);
      for (const l of flow.legs) {
        if (l.from !== n.id || !inDeg.has(l.to)) continue;
        const d = (inDeg.get(l.to) ?? 1) - 1;
        inDeg.set(l.to, d);
        if (d === 0) {
          const t = byId.get(l.to);
          if (t) {
            queue.push(t);
            queue.sort(byX);
          }
        }
      }
    }
    if (order.length === flow.nodes.length) nodes = order;
  }
  if (!nodes) nodes = [...flow.nodes].sort(byX);
  const legs = flow.legs
    .filter((l) => byId.has(l.from) && byId.has(l.to) && l.from !== l.to)
    .map((l) => ({ ...l, crosses: byId.get(l.from)!.lane !== byId.get(l.to)!.lane }));
  const next: Flow = { ...flow, nodes, legs };
  const headline = deriveHeadline(next);
  return {
    ...next,
    headline,
    sameActor: [
      { headlineNode: headline.partyA, machineryNode: headline.partyA },
      { headlineNode: headline.partyB, machineryNode: headline.partyB },
    ],
    traceRole: computeTraceRole(next),
  };
}

// ── deck-ready checks (passive; nudge, never block) ──────────────────────────

export interface FlowCheck {
  ok: boolean;
  label: string;
  hint?: string;
}

export function deckReadyChecks(flow: Flow): FlowCheck[] {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const connected = new Set(flow.legs.flatMap((l) => [l.from, l.to]));
  const crossing = flow.legs.filter(
    (l) => byId.get(l.from) && byId.get(l.to) && byId.get(l.from)!.lane !== byId.get(l.to)!.lane,
  );
  const outDeg = new Map<string, number>();
  for (const l of flow.legs) {
    outDeg.set(l.from, (outDeg.get(l.from) ?? 0) + 1);
  }
  // Merges are welcome (two payers into one account render as tributaries);
  // splits still read wrong on the deck's single relay.
  const noSplits = flow.nodes.every((n) => (outDeg.get(n.id) ?? 0) <= 1);
  return [
    {
      ok: flow.nodes.some((n) => n.kind === "client"),
      label: "Names the client",
      hint: "Add a company node and set its type to Client.",
    },
    {
      ok: flow.nodes.length >= 2 && flow.legs.length >= 1,
      label: "Two parties, connected",
      hint: "Drag from a node's edge handle to connect it.",
    },
    {
      ok: flow.nodes.every((n) => connected.has(n.id)) || flow.nodes.length < 2,
      label: "No stranded nodes",
      hint: "Every node needs at least one leg.",
    },
    {
      ok: crossing.length === 0 || crossing.every((l) => l.convertsTo),
      label: "Border crossings convert",
      hint: "A leg that crosses Brazil | Abroad needs the FX engine (converts to).",
    },
    {
      ok: noSplits,
      label: "Routes only converge",
      hint: "Several payers can pay into one account, but an account that splits into two routes reads wrong on the deck.",
    },
  ];
}
