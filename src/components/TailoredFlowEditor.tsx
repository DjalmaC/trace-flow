"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Currency, Flow, FlowConfig, FlowNode, Leg, NodeKind } from "@/flow-tool/data/schema";
import {
  blankFlow,
  deckReadyChecks,
  forkFlow,
  newNodeId,
  normalizeTailored,
  registerCustomFlows,
  saveTailoredFlow,
} from "@/flow-tool/data/custom-flows";
import { FLOWS } from "@/flow-tool/data";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { C } from "@/flow-tool/components/tokens";

// ─────────────────────────────────────────────────────────────────────────────
// Tailored-flow editor (design review §4/§6). Not a drawing tool: it composes
// Trace's semantic primitives — payer, company, Trace entity, currency pill,
// FX engine, note — on the Brazil │ Abroad lanes. The output is a plain Flow
// object, so the client deck, share links and the PDF render it exactly like a
// library flow. Guardrails over freedom: lanes snap, arrows re-route, checks
// nudge (never block), and ⌘Z undoes anything.
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 620;
const NODE_W = 150;
const NODE_H = 54;
const DIVIDER_X = CANVAS_W / 2;

const CURRENCIES: Currency[] = ["BRL", "USD", "EUR", "USD/EUR", "USDC/USDT", "USD/USDT"];
const KIND_LABEL: Record<NodeKind, string> = {
  operational: "Payer / Payee",
  client: "Client company",
  trace: "Trace entity",
  merchant: "Merchant / beneficiary",
};
const KIND_TINT: Record<NodeKind, string> = {
  operational: C.nodeStroke,
  client: C.green,
  trace: C.traceCyan,
  merchant: "#d9b96a",
};

type Selection = { type: "node" | "note"; id: string } | { type: "leg"; index: number } | null;
type Armed = "payer" | "company" | "trace" | "pill" | "engine" | "note" | null;

interface EditorState {
  pos: Record<string, { x: number; y: number }>;
  notes: { id: string; x: number; y: number; text: string }[];
}
const editorOf = (f: Flow): EditorState => ({ pos: f.editor?.pos ?? {}, notes: f.editor?.notes ?? [] });

/** Seed canvas positions for nodes that don't have one (a fresh fork): each
 *  lane spreads across its half in chain order. */
function seedPositions(flow: Flow): Flow {
  const pos = { ...editorOf(flow).pos };
  (["brazil", "abroad"] as const).forEach((lane) => {
    const ns = flow.nodes.filter((n) => n.lane === lane && !pos[n.id]);
    if (!ns.length) return;
    const placed = flow.nodes.filter((n) => n.lane === lane && pos[n.id]).length;
    const x0 = lane === "brazil" ? 70 : DIVIDER_X + 70;
    const span = DIVIDER_X - 140 - NODE_W;
    ns.forEach((n, i) => {
      const k = placed + i;
      const total = Math.max(placed + ns.length, 1);
      pos[n.id] = { x: x0 + (span * k) / Math.max(total - 1, 1), y: CANVAS_H / 2 - NODE_H / 2 + (k % 2 ? 40 : -20) };
    });
  });
  return { ...flow, editor: { ...editorOf(flow), pos } };
}

const laneAt = (x: number): FlowNode["lane"] => (x + NODE_W / 2 < DIVIDER_X ? "brazil" : "abroad");

export function TailoredFlowEditor({
  initial,
  config,
  onSave,
  onClose,
}: {
  initial: Flow;
  config: FlowConfig;
  onSave: (flow: Flow) => void;
  onClose: () => void;
}) {
  const [flow, setFlow] = useState<Flow>(() => seedPositions(initial));
  const [selection, setSelection] = useState<Selection>(null);
  const [armed, setArmed] = useState<Armed>(null);
  const [legDraft, setLegDraft] = useState<{ from: string; x: number; y: number } | null>(null);
  const [preview, setPreview] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const history = useRef<{ stack: Flow[]; i: number }>({ stack: [initial], i: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ kind: "node" | "note"; id: string; dx: number; dy: number; moved: boolean } | null>(null);

  const ed = editorOf(flow);
  const pos = ed.pos;
  const checks = useMemo(() => deckReadyChecks(flow), [flow]);
  const ready = checks.every((c) => c.ok);

  // ── mutation core: apply → autosave (debounced) → history (optional) ──
  function update(next: Flow, pushHistory = true) {
    setFlow(next);
    if (pushHistory) {
      const h = history.current;
      h.stack = [...h.stack.slice(0, h.i + 1), next];
      if (h.stack.length > 100) h.stack.shift();
      h.i = h.stack.length - 1;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveTailoredFlow(normalizeTailored(next)), 500);
  }
  function undo() {
    const h = history.current;
    if (h.i > 0) setFlow(h.stack[--h.i]);
  }
  function redo() {
    const h = history.current;
    if (h.i < h.stack.length - 1) setFlow(h.stack[++h.i]);
  }

  // ── keyboard: undo / redo / delete / escape ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inField = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.key === "Backspace" || e.key === "Delete") && !inField) {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === "Escape") {
        if (preview) setPreview(false);
        else if (armed) setArmed(null);
        else setSelection(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const svgPoint = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  };

  // ── graph edits ──
  function addNode(kind: NodeKind, label: string, x: number, y: number) {
    const id = newNodeId();
    const node: FlowNode = { id, label, kind, lane: laneAt(x) };
    update({
      ...flow,
      nodes: [...flow.nodes, node],
      editor: { ...ed, pos: { ...pos, [id]: { x, y } } },
    });
    setSelection({ type: "node", id });
  }
  function patchNode(id: string, patch: Partial<FlowNode>) {
    update({ ...flow, nodes: flow.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  }
  function patchLeg(index: number, patch: Partial<Leg>) {
    update({ ...flow, legs: flow.legs.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  }
  function addLeg(from: string, to: string) {
    if (from === to || flow.legs.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from))) return;
    const a = flow.nodes.find((n) => n.id === from)!;
    const b = flow.nodes.find((n) => n.id === to)!;
    const crossing = a.lane !== b.lane;
    const carries: Currency = a.lane === "brazil" ? "BRL" : "USD/EUR";
    const leg: Leg = crossing
      ? { from, to, carries, convertsTo: carries === "BRL" ? "USD/EUR" : "BRL", crosses: true }
      : { from, to, carries };
    update({ ...flow, legs: [...flow.legs, leg] });
    setSelection({ type: "leg", index: flow.legs.length });
  }
  function deleteSelection() {
    if (!selection) return;
    if (selection.type === "node") {
      const { [selection.id]: _gone, ...rest } = pos;
      update({
        ...flow,
        nodes: flow.nodes.filter((n) => n.id !== selection.id),
        legs: flow.legs.filter((l) => l.from !== selection.id && l.to !== selection.id),
        editor: { ...ed, pos: rest },
      });
    } else if (selection.type === "leg") {
      update({ ...flow, legs: flow.legs.filter((_, i) => i !== selection.index) });
    } else {
      update({ ...flow, editor: { ...ed, notes: ed.notes.filter((n) => n.id !== selection.id) } });
    }
    setSelection(null);
  }

  // ── canvas pointer handlers ──
  function onCanvasClick(e: React.MouseEvent) {
    const { x, y } = svgPoint(e);
    if (armed === "payer") addNode("operational", "Payer", x - NODE_W / 2, y - NODE_H / 2);
    else if (armed === "company") addNode("client", config.clientName || "Company", x - NODE_W / 2, y - NODE_H / 2);
    else if (armed === "trace") addNode("trace", "Pix Inc", x - NODE_W / 2, y - NODE_H / 2);
    else if (armed === "note") {
      const id = `note-${Math.random().toString(36).slice(2, 8)}`;
      update({ ...flow, editor: { ...ed, notes: [...ed.notes, { id, x: x - 90, y: y - 24, text: "Note…" }] } });
      setSelection({ type: "note", id });
    } else {
      setSelection(null);
      return;
    }
    setArmed(null);
  }

  function startNodeDrag(e: React.PointerEvent, id: string, kind: "node" | "note") {
    e.stopPropagation();
    const p = svgPoint(e);
    const cur = kind === "node" ? pos[id] : ed.notes.find((n) => n.id === id);
    if (!cur) return;
    drag.current = { kind, id, dx: p.x - cur.x, dy: p.y - cur.y, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (legDraft) {
      const p = svgPoint(e);
      setLegDraft({ ...legDraft, x: p.x, y: p.y });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const p = svgPoint(e);
    const x = Math.max(8, Math.min(CANVAS_W - NODE_W - 8, p.x - d.dx));
    const y = Math.max(48, Math.min(CANVAS_H - NODE_H - 8, p.y - d.dy));
    d.moved = true;
    if (d.kind === "node") {
      setFlow((f) => ({
        ...f,
        nodes: f.nodes.map((n) => (n.id === d.id ? { ...n, lane: laneAt(x) } : n)),
        editor: { ...editorOf(f), pos: { ...editorOf(f).pos, [d.id]: { x, y } } },
      }));
    } else {
      setFlow((f) => ({
        ...f,
        editor: { ...editorOf(f), notes: editorOf(f).notes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) },
      }));
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (legDraft) {
      const p = svgPoint(e);
      const target = flow.nodes.find((n) => {
        const np = pos[n.id];
        return np && p.x >= np.x && p.x <= np.x + NODE_W && p.y >= np.y && p.y <= np.y + NODE_H;
      });
      if (target) addLeg(legDraft.from, target.id);
      setLegDraft(null);
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (d?.moved) update(flow); // commit the drag as one history step
    else if (d) setSelection({ type: d.kind, id: d.id } as Selection);
  }

  function onLegClick(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    if (armed === "engine") {
      const leg = flow.legs[index];
      patchLeg(index, { convertsTo: leg.convertsTo ?? (leg.carries === "BRL" ? "USD/EUR" : "BRL") });
      setArmed(null);
    } else if (armed === "pill") {
      setArmed(null);
    }
    setSelection({ type: "leg", index });
  }

  // ── save / preview ──
  function handleSave() {
    const normalized = normalizeTailored(flow);
    saveTailoredFlow(normalized);
    onSave(normalized);
  }
  function openPreview() {
    registerCustomFlows([normalizeTailored(flow)]);
    setPreview(true);
  }

  const selNode = selection?.type === "node" ? flow.nodes.find((n) => n.id === selection.id) : null;
  const selLeg = selection?.type === "leg" ? flow.legs[selection.index] : null;
  const selNote = selection?.type === "note" ? ed.notes.find((n) => n.id === selection.id) : null;

  const nodeAnchor = (id: string) => {
    const p = pos[id];
    return p ? { x: p.x, y: p.y, cx: p.x + NODE_W / 2, cy: p.y + NODE_H / 2 } : null;
  };

  if (preview) {
    return (
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#07090b]">
        <FlowExperience config={{ ...config, flowId: flow.id }} presentation />
        <button
          onClick={() => setPreview(false)}
          className="fixed left-4 top-4 z-[95] rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
        >
          ← Back to editor
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#07090b]">
      {/* ── top bar ── */}
      <div className="flex items-center gap-3 border-b border-hairline-row px-4 py-2.5">
        <input
          value={flow.title}
          onChange={(e) => update({ ...flow, title: e.target.value }, false)}
          onBlur={() => update(flow)}
          aria-label="Flow name"
          className="w-[320px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[15px] font-semibold text-title outline-none transition hover:border-hairline-control focus:border-hairline-selected focus:bg-surface-input"
        />
        <span className="rounded-[5px] border border-hairline-control px-1.5 py-[3px] font-mono text-[9.5px] font-medium tracking-[.12em] text-mint-muted">
          CUSTOM · INTERNAL
        </span>
        {flow.customFor && <span className="text-[11.5px] text-muted">only for {flow.customFor}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={undo} title="Undo (⌘Z)" className="rounded-lg border border-hairline-control px-2.5 py-1.5 text-[12px] text-[#8b948f] transition hover:text-title">
            ↩ Undo
          </button>
          <button onClick={redo} title="Redo (⇧⌘Z)" className="rounded-lg border border-hairline-control px-2.5 py-1.5 text-[12px] text-[#8b948f] transition hover:text-title">
            ↪
          </button>
          <button
            onClick={openPreview}
            className="rounded-lg border border-mint/50 px-3 py-1.5 text-[12.5px] font-medium text-mint transition hover:bg-mint/10"
          >
            Preview on deck
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-mint px-3.5 py-1.5 text-[12.5px] font-semibold text-mint-on transition hover:bg-mint-hover"
          >
            Save flow
          </button>
          <button onClick={onClose} aria-label="Close editor" className="ml-1 rounded-lg px-2 py-1.5 text-[15px] leading-none text-[#8b948f] transition hover:text-title">
            ×
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── primitives rail ── */}
        <div className="w-[228px] shrink-0 space-y-1.5 overflow-y-auto border-r border-hairline-row p-3">
          <div className="mb-2 font-mono text-[10px] font-medium tracking-[.14em] text-mint-muted">PRIMITIVES</div>
          {(
            [
              ["payer", "Payer / Payee", "Who sends or receives"],
              ["company", "Company node", "Client, partner, merchant"],
              ["trace", "Trace entity", "Pix Inc, Trace LLC…"],
              ["pill", "Currency pill", "Marks what moves on a leg"],
              ["engine", "Trace FX engine", "Converts the leg it sits on"],
              ["note", "Text", "Free note, editor-only"],
            ] as [Armed, string, string][]
          ).map(([key, title, sub]) => (
            <button
              key={key}
              onClick={() => setArmed(armed === key ? null : key)}
              className={`block w-full rounded-lg border px-3 py-2 text-left transition duration-150 ease-ds ${
                armed === key ? "border-hairline-selected bg-mint/10" : "border-hairline-card bg-surface-card2 hover:border-hairline-control"
              }`}
            >
              <div className={`text-[12.5px] font-semibold ${armed === key ? "text-mint" : "text-title"}`}>{title}</div>
              <div className="text-[10.5px] leading-snug text-muted">{sub}</div>
            </button>
          ))}
          <p className="pt-1 text-[10.5px] leading-normal text-[#5c6b65]">
            Click a primitive, then click the canvas. Currency pill and FX engine apply to a leg. Drag a node&apos;s ○ handle
            onto another node to connect them. ⌘Z undoes anything.
          </p>
        </div>

        {/* ── canvas ── */}
        <div className="relative min-w-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="h-full w-full"
            onClick={onCanvasClick}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ cursor: armed && armed !== "pill" && armed !== "engine" ? "crosshair" : "default", touchAction: "none" }}
          >
            <defs>
              <marker id="tf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill={C.leg} />
              </marker>
              <marker id="tf-arrow-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#00f2b1" />
              </marker>
            </defs>

            {/* lanes */}
            <line x1={DIVIDER_X} y1={20} x2={DIVIDER_X} y2={CANVAS_H - 12} stroke={C.divider} strokeWidth={1.5} strokeDasharray="4 6" />
            <text x={DIVIDER_X / 2} y={34} textAnchor="middle" fontSize={11} letterSpacing={4} fill={C.muted} fontFamily="monospace">
              BRAZIL
            </text>
            <text x={DIVIDER_X + DIVIDER_X / 2} y={34} textAnchor="middle" fontSize={11} letterSpacing={4} fill={C.muted} fontFamily="monospace">
              ABROAD
            </text>

            {/* legs */}
            {flow.legs.map((leg, i) => {
              const a = nodeAnchor(leg.from);
              const b = nodeAnchor(leg.to);
              if (!a || !b) return null;
              const leftToRight = a.cx <= b.cx;
              const x1 = leftToRight ? a.x + NODE_W : a.x;
              const x2 = leftToRight ? b.x : b.x + NODE_W;
              const selected = selection?.type === "leg" && selection.index === i;
              const mx = (x1 + x2) / 2;
              const my = (a.cy + b.cy) / 2;
              const label = leg.convertsTo ? `${leg.carries} → ${leg.convertsTo}` : leg.carries;
              const lw = label.length * 6.4 + 22;
              return (
                <g key={i} onClick={(e) => onLegClick(e, i)} style={{ cursor: "pointer" }}>
                  <line x1={x1} y1={a.cy} x2={x2} y2={b.cy} stroke="transparent" strokeWidth={16} />
                  <line
                    x1={x1}
                    y1={a.cy}
                    x2={x2}
                    y2={b.cy}
                    stroke={selected ? "#00f2b1" : C.leg}
                    strokeWidth={selected ? 2 : 1.4}
                    markerEnd={selected ? "url(#tf-arrow-sel)" : "url(#tf-arrow)"}
                  />
                  <g transform={`translate(${mx - lw / 2}, ${my - 11})`}>
                    <rect width={lw} height={22} rx={11} fill={leg.convertsTo ? C.capFill : C.pillFill} stroke={selected ? "#00f2b1" : C.pillStroke} strokeWidth={selected ? 1.4 : 1} />
                    <text x={lw / 2} y={15} textAnchor="middle" fontSize={11} fontFamily="monospace" fill={leg.convertsTo ? "#7fe6c3" : C.pillText}>
                      {label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* leg being drawn */}
            {legDraft && (() => {
              const a = nodeAnchor(legDraft.from);
              return a ? <line x1={a.cx} y1={a.cy} x2={legDraft.x} y2={legDraft.y} stroke="#00f2b1" strokeWidth={1.6} strokeDasharray="5 4" /> : null;
            })()}

            {/* notes */}
            {ed.notes.map((note) => {
              const selected = selection?.type === "note" && selection.id === note.id;
              const lines = note.text.split("\n").slice(0, 4);
              const w = Math.max(120, Math.min(260, Math.max(...lines.map((l) => l.length)) * 6.2 + 24));
              const h = 18 + lines.length * 15;
              return (
                <g key={note.id} transform={`translate(${note.x}, ${note.y})`} onPointerDown={(e) => startNodeDrag(e, note.id, "note")} onClick={(e) => e.stopPropagation()} style={{ cursor: "grab" }}>
                  <rect width={w} height={h} rx={8} fill="rgba(217,185,106,0.10)" stroke={selected ? "#d9b96a" : "rgba(217,185,106,0.35)"} strokeWidth={selected ? 1.5 : 1} />
                  {lines.map((l, i) => (
                    <text key={i} x={12} y={20 + i * 15} fontSize={11.5} fill="#d9c48c">
                      {l}
                    </text>
                  ))}
                </g>
              );
            })}

            {/* nodes */}
            {flow.nodes.map((n) => {
              const p = pos[n.id];
              if (!p) return null;
              const selected = selection?.type === "node" && selection.id === n.id;
              const tint = KIND_TINT[n.kind];
              return (
                <g key={n.id} transform={`translate(${p.x}, ${p.y})`} onPointerDown={(e) => startNodeDrag(e, n.id, "node")} onClick={(e) => e.stopPropagation()} style={{ cursor: "grab" }}>
                  {selected && <rect x={-4} y={-4} width={NODE_W + 8} height={NODE_H + 8} rx={14} fill="none" stroke="#00f2b1" strokeWidth={1.6} opacity={0.9} />}
                  <rect width={NODE_W} height={NODE_H} rx={11} fill={C.surface} stroke={n.kind === "operational" ? C.nodeStroke : tint} strokeOpacity={n.kind === "operational" ? 1 : 0.55} strokeWidth={1.2} />
                  <text x={12} y={22} fontSize={9} letterSpacing={1.2} fontFamily="monospace" fill={tint === C.nodeStroke ? C.muted : tint}>
                    {KIND_LABEL[n.kind].toUpperCase().split(" ")[0]}
                  </text>
                  <text x={12} y={40} fontSize={12.5} fontWeight={600} fill={C.title}>
                    {n.label.length > 21 ? `${n.label.slice(0, 20)}…` : n.label}
                  </text>
                  {/* edge handle: drag to start a leg */}
                  <circle
                    cx={NODE_W}
                    cy={NODE_H / 2}
                    r={7}
                    fill="#0c110f"
                    stroke={selected ? "#00f2b1" : C.clientSlot}
                    strokeWidth={1.4}
                    style={{ cursor: "crosshair" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const pt = svgPoint(e);
                      setLegDraft({ from: n.id, x: pt.x, y: pt.y });
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* deck-ready checks */}
          <div className="absolute bottom-4 left-4">
            <button
              onClick={() => setChecksOpen((o) => !o)}
              className={`rounded-full border px-3.5 py-1.5 text-[11.5px] font-medium transition ${
                ready ? "border-mint/50 bg-mint/10 text-mint" : "border-[#d9b96a]/50 bg-[#d9b96a]/10 text-[#d9c48c]"
              }`}
            >
              {ready ? "✓ Deck-ready" : `${checks.filter((c) => !c.ok).length} to fix before deck-ready`}
            </button>
            {checksOpen && (
              <div className="mt-2 w-[300px] space-y-1.5 rounded-xl border border-hairline-card bg-[#0c110f]/95 p-3 backdrop-blur">
                {checks.map((c) => (
                  <div key={c.label} className="text-[11.5px] leading-snug">
                    <span className={c.ok ? "text-mint" : "text-[#d9c48c]"}>{c.ok ? "✓" : "•"} {c.label}</span>
                    {!c.ok && c.hint && <div className="pl-4 text-[10.5px] text-muted">{c.hint}</div>}
                  </div>
                ))}
                <p className="pt-1 text-[10px] text-[#5c6b65]">Checks nudge — they never block saving or presenting.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── inspector ── */}
        <div className="w-[264px] shrink-0 overflow-y-auto border-l border-hairline-row p-3.5">
          {selNode ? (
            <div className="space-y-3">
              <div className="font-mono text-[10px] font-medium tracking-[.14em] text-mint-muted">NODE</div>
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted">Name</span>
                <input
                  value={selNode.label}
                  onChange={(e) => patchNode(selNode.id, { label: e.target.value })}
                  className="w-full rounded-lg border border-hairline-control bg-surface-input px-2.5 py-2 text-[12.5px] text-title outline-none focus:border-hairline-selected"
                />
              </label>
              <div>
                <span className="mb-1 block text-[11px] text-muted">Type · replacing keeps its arrows</span>
                <div className="space-y-1">
                  {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => patchNode(selNode.id, { kind: k })}
                      className={`block w-full rounded-lg border px-2.5 py-1.5 text-left text-[12px] transition ${
                        selNode.kind === k ? "border-hairline-selected text-mint" : "border-hairline-control text-[#8b948f] hover:text-title"
                      }`}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-muted">
                Lane: <b className="text-[#8b948f]">{selNode.lane === "brazil" ? "Brazil" : "Abroad"}</b> — drag across the divider to change.
              </div>
              <button onClick={deleteSelection} className="w-full rounded-lg border border-[#7a3d3d] px-2.5 py-2 text-[12px] text-[#d99a9a] transition hover:bg-[#2a1414]">
                Delete node (and its legs)
              </button>
            </div>
          ) : selLeg ? (
            <div className="space-y-3">
              <div className="font-mono text-[10px] font-medium tracking-[.14em] text-mint-muted">LEG</div>
              <div className="text-[11.5px] text-[#8b948f]">
                {flow.nodes.find((n) => n.id === selLeg.from)?.label} → {flow.nodes.find((n) => n.id === selLeg.to)?.label}
                {flow.nodes.find((n) => n.id === selLeg.from)?.lane !== flow.nodes.find((n) => n.id === selLeg.to)?.lane && (
                  <span className="text-mint-muted"> · crosses the border</span>
                )}
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-muted">Carries</span>
                <div className="flex flex-wrap gap-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => patchLeg((selection as { index: number }).index, { carries: c })}
                      className={`rounded-full border px-2 py-1 font-mono text-[10.5px] transition ${
                        selLeg.carries === c ? "border-hairline-selected text-mint" : "border-hairline-control text-[#8b948f] hover:text-title"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-muted">Trace FX engine · converts on this leg</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => patchLeg((selection as { index: number }).index, { convertsTo: undefined })}
                    className={`rounded-full border px-2 py-1 font-mono text-[10.5px] transition ${
                      !selLeg.convertsTo ? "border-hairline-selected text-mint" : "border-hairline-control text-[#8b948f] hover:text-title"
                    }`}
                  >
                    none
                  </button>
                  {CURRENCIES.filter((c) => c !== selLeg.carries).map((c) => (
                    <button
                      key={c}
                      onClick={() => patchLeg((selection as { index: number }).index, { convertsTo: c })}
                      className={`rounded-full border px-2 py-1 font-mono text-[10.5px] transition ${
                        selLeg.convertsTo === c ? "border-hairline-selected text-mint" : "border-hairline-control text-[#8b948f] hover:text-title"
                      }`}
                    >
                      → {c}
                    </button>
                  ))}
                </div>
                {selLeg.convertsTo && <p className="mt-1 text-[10.5px] text-muted">Renders as the swap capsule · spot + spread.</p>}
              </div>
              <button
                onClick={() => patchLeg((selection as { index: number }).index, { from: selLeg.to, to: selLeg.from })}
                className="w-full rounded-lg border border-hairline-control px-2.5 py-2 text-[12px] text-[#8b948f] transition hover:text-title"
              >
                ⇄ Flip direction
              </button>
              <button onClick={deleteSelection} className="w-full rounded-lg border border-[#7a3d3d] px-2.5 py-2 text-[12px] text-[#d99a9a] transition hover:bg-[#2a1414]">
                Remove leg
              </button>
            </div>
          ) : selNote ? (
            <div className="space-y-3">
              <div className="font-mono text-[10px] font-medium tracking-[.14em] text-mint-muted">NOTE · INTERNAL</div>
              <textarea
                value={selNote.text}
                onChange={(e) =>
                  update({ ...flow, editor: { ...ed, notes: ed.notes.map((n) => (n.id === selNote.id ? { ...n, text: e.target.value } : n)) } }, false)
                }
                onBlur={() => update(flow)}
                rows={4}
                className="w-full rounded-lg border border-hairline-control bg-surface-input px-2.5 py-2 text-[12px] text-title outline-none focus:border-hairline-selected"
              />
              <p className="text-[10.5px] text-muted">Notes live only in this editor — the client deck never shows them.</p>
              <button onClick={deleteSelection} className="w-full rounded-lg border border-[#7a3d3d] px-2.5 py-2 text-[12px] text-[#d99a9a] transition hover:bg-[#2a1414]">
                Delete note
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="font-mono text-[10px] font-medium tracking-[.14em] text-mint-muted">THIS FLOW</div>
              <p className="text-[11.5px] leading-normal text-muted">
                Select a node, a leg, or a note to edit it here. The deck draws this flow with the same renderer as the
                library — your canvas arrangement sets the story&apos;s order; the deck handles the styling.
              </p>
              <div className="rounded-lg border border-hairline-card bg-surface-card2 p-2.5 text-[11px] leading-relaxed text-[#8b948f]">
                <div>{flow.nodes.length} nodes · {flow.legs.length} legs</div>
                <div>{flow.legs.filter((l) => l.convertsTo).length} conversion(s)</div>
                <div>Trace role: {normalizeTailored(flow).traceRole.join(" + ") || "—"}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fork-first creation (design §4b): most tailored flows are one edit away from
// a library flow. Search → fork; blank stays one click away.
// ─────────────────────────────────────────────────────────────────────────────

export function NewTailoredFlowModal({
  clientName,
  onCreate,
  onClose,
}: {
  clientName: string;
  onCreate: (draft: Flow) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return FLOWS;
    return FLOWS.filter((f) => `${f.displayId} ${f.title} ${f.blurb} ${f.dials.model}`.toLowerCase().includes(needle));
  }, [q]);
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-2xl border border-hairline-card bg-[#0c110f] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-semibold text-title">New tailored flow</div>
        <p className="mb-3 text-[12px] text-muted">Fork the closest library flow, or start blank.</p>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Search flows — "offshore", "NRA", "stablecoin"…'
          className="mb-3 w-full rounded-lg border border-hairline-control bg-surface-input px-3 py-2.5 text-[13px] text-title outline-none placeholder:text-muted focus:border-hairline-selected"
        />
        <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => onCreate(forkFlow(f, clientName))}
              className="flex w-full items-center gap-3 rounded-lg border border-hairline-card bg-surface-card2 px-3 py-2.5 text-left transition hover:border-hairline-control"
            >
              <span className="w-8 shrink-0 font-mono text-[12px] font-semibold text-mint-muted">{f.displayId}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-title">{f.title}</span>
                <span className="block truncate text-[10.5px] text-muted">{f.blurb}</span>
              </span>
              <span className="shrink-0 text-[11px] font-medium text-mint">Fork & edit</span>
            </button>
          ))}
          {!results.length && <div className="py-6 text-center text-[12px] text-muted">No flows match.</div>}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-hairline-row pt-3">
          <p className="pr-3 text-[10.5px] leading-snug text-[#5c6b65]">Forked flows keep the working parts — you edit only the leg that&apos;s different.</p>
          <button
            onClick={() => onCreate(blankFlow(clientName))}
            className="shrink-0 rounded-lg border border-hairline-control px-3 py-2 text-[12px] font-medium text-[#8b948f] transition hover:text-title"
          >
            Start blank
          </button>
        </div>
      </div>
    </div>
  );
}
