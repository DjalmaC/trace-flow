import type { Flow } from "./schema";

// Design-contract export. A flow that reproduces an external design package
// (Flow.specId, Leg.id) exports its topology in the package's graph.json shape
// so the package verifier can compare it: nodes (id, label) and edges (id,
// source, target, label, kind). Layout, currencies and lanes are presentation
// and are not part of the contract.

export interface GraphExport {
  id: string;
  title: string;
  diagram_type: "primary_flow" | "supplementary_mechanism";
  direction: "TD";
  nodes: { id: string; label: string }[];
  edges: { id: string; source: string; target: string; label: string; kind: "funds" | "instruction" }[];
}

export function flowGraphExport(flow: Flow): GraphExport {
  return {
    id: flow.specId ?? flow.id,
    title: flow.title,
    diagram_type: flow.mechanism ? "supplementary_mechanism" : "primary_flow",
    direction: "TD",
    nodes: flow.nodes.map((n) => ({ id: n.id, label: n.label })),
    edges: flow.legs.map((l, i) => ({
      id: l.id ?? `${flow.specId ?? flow.id}-E${String(i + 1).padStart(2, "0")}`,
      source: l.from,
      target: l.to,
      label: l.label ?? "",
      kind: l.kind === "instruction" ? "instruction" : "funds",
    })),
  };
}
