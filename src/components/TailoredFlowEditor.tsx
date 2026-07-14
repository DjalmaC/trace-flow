"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Currency, Flow, FlowConfig, FlowNode, Leg, NodeKind } from "@/flow-tool/data/schema";
import {
  arrivingCurrency,
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

// ─────────────────────────────────────────────────────────────────────────────
// Tailored-flow editor (design review §4/§6, drawn to its frames): a white-
// first rep surface — the dark deck is what the client sees. Not a drawing
// tool: it composes Trace's semantic primitives on the Brazil │ Abroad lanes
// (Brazil above, Abroad below — the divider is the regulatory story and the
// one piece of layout the rep can't break). Left-to-right position tells the
// story's order; the deck renderer does the styling. Guardrails over freedom:
// lanes snap, arrows re-route, checks nudge (never block), ⌘Z undoes anything.
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 620;
const NODE_W = 150;
const NODE_H = 54;
const LANE_Y = CANVAS_H / 2; // the Brazil │ Abroad divider (horizontal)

// Light-surface palette (Trace DS direction: mint only for selection, success
// and the primary CTA; yellow tint = annotation; everything else calm greys).
const P = {
  page: "#f4f2ec",
  panel: "#fbfaf6",
  bar: "#faf9f4",
  line: "#e6e3da",
  dot: "#dedbcf",
  ink: "#1f2723",
  sub: "#6b7570",
  faint: "#98a09b",
  mint: "#00f2b1",
  mintInk: "#0b8a63",
  mintDeep: "#12b98a",
  mintTint: "#e9fbf3",
  mintLine: "#9fe8cd",
  amber: "#8a6d1a",
  amberTint: "#fdf6dd",
  amberLine: "#ecd98d",
  danger: "#b4544a",
};

const CURRENCIES: Currency[] = ["BRL", "USD", "EUR", "USD/EUR", "USDC/USDT", "USD/USDT"];
const COIN_DOT: Partial<Record<Currency, string>> = { "USDC/USDT": "#2775CA", "USD/USDT": "#26A17B" };
const KIND_LABEL: Record<NodeKind, string> = {
  operational: "Payer / Payee",
  client: "Client",
  trace: "Trace entity",
  merchant: "Merchant",
};
// Only two voices on the canvas, like the frames: mint for Trace + the client
// (the parties that carry the story), grey for everything operational.
const kindInk = (k: NodeKind) => (k === "trace" || k === "client" ? P.mintInk : P.faint);

type Selection = { type: "node" | "note"; id: string } | { type: "leg"; index: number } | null;
type Armed = "payer" | "company" | "trace" | "pill" | "engine" | "note" | null;

interface EditorState {
  pos: Record<string, { x: number; y: number }>;
  notes: { id: string; x: number; y: number; text: string }[];
}
const editorOf = (f: Flow): EditorState => ({ pos: f.editor?.pos ?? {}, notes: f.editor?.notes ?? [] });

/** Seed canvas positions for nodes that don't have one (a fresh fork): each
 *  lane spreads across its band in chain order — Brazil above, Abroad below. */
function seedPositions(flow: Flow): Flow {
  const pos = { ...editorOf(flow).pos };
  const laneY: Record<FlowNode["lane"], number> = { brazil: LANE_Y - 128, abroad: LANE_Y + 74 };
  const unplaced = flow.nodes.filter((n) => !pos[n.id]);
  if (unplaced.length) {
    const span = CANVAS_W - 200 - NODE_W;
    flow.nodes.forEach((n, i) => {
      if (pos[n.id]) return;
      const x = 100 + (span * i) / Math.max(flow.nodes.length - 1, 1);
      pos[n.id] = { x, y: laneY[n.lane] + (i % 2 ? 26 : -14) };
    });
  }
  return { ...flow, editor: { ...editorOf(flow), pos } };
}

const laneAt = (y: number): FlowNode["lane"] => (y + NODE_H / 2 < LANE_Y ? "brazil" : "abroad");

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapBox, setWrapBox] = useState({ w: 1, h: 1 });
  const history = useRef<{ stack: Flow[]; i: number }>({ stack: [initial], i: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{ kind: "node" | "note"; id: string; dx: number; dy: number; moved: boolean } | null>(null);

  const ed = editorOf(flow);
  const pos = ed.pos;
  const checks = useMemo(() => deckReadyChecks(flow), [flow]);
  const ready = checks.every((c) => c.ok);

  // canvas scale, for anchoring HTML popovers to SVG coordinates
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setWrapBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const scale = Math.min(wrapBox.w / CANVAS_W, wrapBox.h / CANVAS_H);
  const originX = (wrapBox.w - CANVAS_W * scale) / 2;
  const originY = (wrapBox.h - CANVAS_H * scale) / 2;
  const toScreen = (x: number, y: number) => ({ left: originX + x * scale, top: originY + y * scale });

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
    const node: FlowNode = { id, label, kind, lane: laneAt(y) };
    update({ ...flow, nodes: [...flow.nodes, node], editor: { ...ed, pos: { ...pos, [id]: { x, y } } } });
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
    // Currency continuity: a leg leaves a node carrying whatever arrived there;
    // only a source node falls back to its lane's native currency.
    const carries: Currency = arrivingCurrency(flow, from) ?? (a.lane === "brazil" ? "BRL" : "USD/EUR");
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

  // ── canvas pointers ──
  function onCanvasClick(e: React.MouseEvent) {
    const { x, y } = svgPoint(e);
    if (armed === "payer") addNode("operational", "Payer", x - NODE_W / 2, y - NODE_H / 2);
    else if (armed === "company") addNode("client", config.clientName || "Company", x - NODE_W / 2, y - NODE_H / 2);
    else if (armed === "trace") addNode("trace", "Pix Inc", x - NODE_W / 2, y - NODE_H / 2);
    else if (armed === "note") {
      const id = `note-${Math.random().toString(36).slice(2, 8)}`;
      update({ ...flow, editor: { ...ed, notes: [...ed.notes, { id, x: x - 90, y: y - 20, text: "Note…" }] } });
      setSelection({ type: "note", id });
    } else {
      setSelection(null);
      setChecksOpen(false);
      return;
    }
    setArmed(null);
  }

  function startDrag(e: React.PointerEvent, id: string, kind: "node" | "note") {
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
    const y = Math.max(44, Math.min(CANVAS_H - NODE_H - 8, p.y - d.dy));
    d.moved = true;
    if (d.kind === "node") {
      setFlow((f) => ({
        ...f,
        nodes: f.nodes.map((n) => (n.id === d.id ? { ...n, lane: laneAt(y) } : n)),
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
    if (d?.moved) update(flow);
    else if (d) setSelection({ type: d.kind, id: d.id } as Selection);
  }
  function onLegClick(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    if (armed === "engine") {
      const leg = flow.legs[index];
      // Turning on the FX engine: money leaves the account as it arrived and
      // converts AT the engine — so carries snaps to the arriving currency and
      // the conversion target starts from there.
      const arriving = arrivingCurrency(flow, leg.from) ?? leg.carries;
      patchLeg(index, {
        carries: arriving,
        convertsTo: leg.convertsTo && leg.convertsTo !== arriving ? leg.convertsTo : arriving === "BRL" ? "USD/EUR" : "BRL",
      });
      setArmed(null);
    } else if (armed === "pill") setArmed(null);
    setSelection({ type: "leg", index });
  }

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
  const selLegIndex = selection?.type === "leg" ? selection.index : null;
  const selLeg = selLegIndex != null ? flow.legs[selLegIndex] : null;
  const selNote = selection?.type === "note" ? ed.notes.find((n) => n.id === selection.id) : null;

  const anchor = (id: string) => {
    const p = pos[id];
    return p ? { ...p, cx: p.x + NODE_W / 2, cy: p.y + NODE_H / 2 } : null;
  };
  /** Smooth S-curve between the facing edges of two nodes. */
  const legPath = (a: { x: number; y: number; cx: number; cy: number }, b: { x: number; y: number; cx: number; cy: number }) => {
    const ltr = a.cx <= b.cx;
    const x1 = ltr ? a.x + NODE_W : a.x;
    const x2 = ltr ? b.x : b.x + NODE_W;
    const dx = Math.max(Math.abs(x2 - x1) * 0.45, 32) * (ltr ? 1 : -1);
    return { x1, y1: a.cy, x2, y2: b.cy, d: `M${x1} ${a.cy} C${x1 + dx} ${a.cy} ${x2 - dx} ${b.cy} ${x2} ${b.cy}` };
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

  const crossingUnconverted = selLeg
    ? flow.nodes.find((n) => n.id === selLeg.from)?.lane !== flow.nodes.find((n) => n.id === selLeg.to)?.lane && !selLeg.convertsTo
    : false;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col" style={{ background: P.page, color: P.ink }}>
      {/* ── top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: P.bar, borderBottom: `1px solid ${P.line}` }}>
        <button onClick={onClose} className="flex items-center gap-1 text-[13px] font-medium transition hover:opacity-70" style={{ color: P.sub }}>
          ‹ Proposal
        </button>
        <input
          value={flow.title}
          onChange={(e) => update({ ...flow, title: e.target.value }, false)}
          onBlur={() => update(flow)}
          aria-label="Flow name"
          className="w-[380px] rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[14.5px] font-semibold outline-none transition"
          style={{ color: P.ink }}
          onFocus={(e) => (e.target.style.background = "#fff")}
          onBlurCapture={(e) => (e.target.style.background = "transparent")}
        />
        <span
          className="rounded-md px-1.5 py-[3px] font-mono text-[9.5px] font-medium tracking-[.12em]"
          style={{ background: P.amberTint, border: `1px solid ${P.amberLine}`, color: P.amber }}
        >
          CUSTOM · INTERNAL
        </span>
        <div className="ml-auto flex items-center gap-2">
          {flow.customFor && (
            <span className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium" style={{ border: `1px solid ${P.line}`, color: P.sub }}>
              Only for {flow.customFor}
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setChecksOpen((o) => !o)}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition"
              style={
                ready
                  ? { background: P.mintTint, border: `1px solid ${P.mintLine}`, color: P.mintInk }
                  : { background: P.amberTint, border: `1px solid ${P.amberLine}`, color: P.amber }
              }
            >
              {ready ? "✓ Deck-ready" : `${checks.filter((c) => !c.ok).length} to fix`}
            </button>
            {checksOpen && (
              <div
                className="absolute right-0 top-[calc(100%+6px)] z-10 w-[300px] space-y-1.5 rounded-xl bg-white p-3 shadow-lg"
                style={{ border: `1px solid ${P.line}` }}
              >
                {checks.map((c) => (
                  <div key={c.label} className="text-[11.5px] leading-snug">
                    <span style={{ color: c.ok ? P.mintInk : P.amber }}>
                      {c.ok ? "✓" : "•"} {c.label}
                    </span>
                    {!c.ok && c.hint && (
                      <div className="pl-4 text-[10.5px]" style={{ color: P.sub }}>
                        {c.hint}
                      </div>
                    )}
                  </div>
                ))}
                <p className="pt-1 text-[10px]" style={{ color: P.faint }}>
                  Checks nudge — they never block.
                </p>
              </div>
            )}
          </div>
          <button
            onClick={openPreview}
            className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-medium transition hover:opacity-80"
            style={{ border: `1px solid ${P.line}`, color: P.ink }}
          >
            Preview on deck
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition hover:opacity-90"
            style={{ background: P.mint, color: "#06231a" }}
          >
            Save flow
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── primitives rail ── */}
        <div className="flex w-[220px] shrink-0 flex-col p-3" style={{ background: P.bar, borderRight: `1px solid ${P.line}` }}>
          <div className="mb-2 font-mono text-[9.5px] font-medium tracking-[.18em]" style={{ color: P.faint }}>
            PRIMITIVES
          </div>
          <div className="space-y-1.5">
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
                className="block w-full rounded-lg px-3 py-2 text-left transition duration-150"
                style={
                  armed === key
                    ? { background: P.mintTint, border: `1px solid ${P.mintLine}` }
                    : { background: "#fff", border: `1px solid ${P.line}` }
                }
              >
                <div className="text-[12px] font-semibold" style={{ color: armed === key ? P.mintInk : P.ink }}>
                  {title}
                </div>
                <div className="text-[10px] leading-snug" style={{ color: P.sub }}>
                  {sub}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10.5px] leading-normal" style={{ color: P.faint }}>
            Drag onto the canvas, or click a primitive then click the canvas. Everything is labeled — nothing to memorize
            between rare uses.
          </p>
          <div className="mt-auto flex items-center gap-1.5 pt-3 text-[10.5px]" style={{ borderTop: `1px solid ${P.line}`, color: P.faint }}>
            <span className="rounded border px-1 py-px font-mono text-[9px]" style={{ borderColor: P.line, color: P.sub }}>
              ⌘Z
            </span>
            undo anything, always
          </div>
        </div>

        {/* ── canvas ── */}
        <div ref={wrapRef} className="relative min-w-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="h-full w-full"
            onClick={onCanvasClick}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ cursor: armed && armed !== "pill" && armed !== "engine" ? "crosshair" : "default", touchAction: "none", background: P.panel }}
          >
            <defs>
              <pattern id="tf-dots" width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="1.2" cy="1.2" r="1.2" fill={P.dot} />
              </pattern>
            </defs>
            <rect width={CANVAS_W} height={CANVAS_H} fill="url(#tf-dots)" />

            {/* the Brazil │ Abroad divider — horizontal, unbreakable */}
            <line x1={16} y1={LANE_Y} x2={CANVAS_W - 16} y2={LANE_Y} stroke="#cdc9bb" strokeWidth={1.5} strokeDasharray="2 7" />
            <text x={22} y={LANE_Y - 12} fontSize={10} letterSpacing={4} fill={P.faint} fontFamily="monospace">
              BRAZIL
            </text>
            <text x={22} y={LANE_Y + 20} fontSize={10} letterSpacing={4} fill={P.faint} fontFamily="monospace">
              ABROAD
            </text>

            {/* legs — smooth curves; the FX capsule / currency pill ride the midpoint */}
            {flow.legs.map((leg, i) => {
              const a = anchor(leg.from);
              const b = anchor(leg.to);
              if (!a || !b) return null;
              const L = legPath(a, b);
              const selected = selLegIndex === i;
              const stroke = selected ? P.mintDeep : "#25c99618";
              const mx = (L.x1 + L.x2) / 2;
              const my = (L.y1 + L.y2) / 2;
              const coin = COIN_DOT[leg.carries];
              return (
                <g key={i} onClick={(e) => onLegClick(e, i)} style={{ cursor: "pointer" }}>
                  <path d={L.d} fill="none" stroke="transparent" strokeWidth={18} />
                  <path d={L.d} fill="none" stroke={selected ? P.mintDeep : "#2ec79b"} strokeWidth={selected ? 2.4 : 1.7} opacity={selected ? 1 : 0.75} />
                  <circle cx={L.x1} cy={L.y1} r={3.2} fill={selected ? P.mintDeep : "#2ec79b"} />
                  <circle cx={L.x2} cy={L.y2} r={3.2} fill={selected ? P.mintDeep : "#2ec79b"} />
                  {leg.convertsTo ? (
                    (() => {
                      const outs = [leg.convertsTo, ...(leg.alsoConvertsTo ?? [])].join(" / ");
                      const label = `${leg.carries} → ${outs} · spot + spread`;
                      const w = label.length * 6.1 + 26;
                      return (
                        <g transform={`translate(${mx - w / 2}, ${my - 21})`}>
                          <rect width={w} height={42} rx={9} fill={P.mintTint} stroke={selected ? P.mintDeep : P.mintLine} strokeWidth={selected ? 1.5 : 1} />
                          <text x={13} y={17} fontSize={8} letterSpacing={1.6} fontFamily="monospace" fill={P.mintInk} opacity={0.75}>
                            ⤢ TRACE FX ENGINE
                          </text>
                          <text x={13} y={32} fontSize={10.5} fontFamily="monospace" fill={P.mintInk}>
                            {label}
                          </text>
                        </g>
                      );
                    })()
                  ) : (
                    (() => {
                      const w = leg.carries.length * 6.6 + (coin ? 36 : 24);
                      return (
                        <g transform={`translate(${mx - w / 2}, ${my - 12})`}>
                          <rect width={w} height={24} rx={12} fill="#fff" stroke={selected ? P.mintDeep : P.line} strokeWidth={selected ? 1.4 : 1} />
                          {coin && <circle cx={15} cy={12} r={5} fill={coin} />}
                          <text x={coin ? 25 : 12} y={16} fontSize={10.5} fontFamily="monospace" fill={P.ink}>
                            {leg.carries}
                          </text>
                        </g>
                      );
                    })()
                  )}
                </g>
              );
            })}

            {/* leg being drawn */}
            {legDraft &&
              (() => {
                const a = anchor(legDraft.from);
                return a ? (
                  <path
                    d={`M${a.x + NODE_W} ${a.cy} C${a.x + NODE_W + 60} ${a.cy} ${legDraft.x - 60} ${legDraft.y} ${legDraft.x} ${legDraft.y}`}
                    fill="none"
                    stroke={P.mintDeep}
                    strokeWidth={1.8}
                    strokeDasharray="5 4"
                  />
                ) : null;
              })()}

            {/* notes — yellow-tinted annotations */}
            {ed.notes.map((note) => {
              const selected = selection?.type === "note" && selection.id === note.id;
              const lines = note.text.split("\n").slice(0, 4);
              const w = Math.max(150, Math.min(280, Math.max(...lines.map((l) => l.length)) * 6.1 + 30));
              const h = 16 + lines.length * 15;
              return (
                <g key={note.id} transform={`translate(${note.x}, ${note.y})`} onPointerDown={(e) => startDrag(e, note.id, "note")} onClick={(e) => e.stopPropagation()} style={{ cursor: "grab" }}>
                  <rect width={w} height={h} rx={4} fill={P.amberTint} stroke={selected ? "#d9b96a" : P.amberLine} strokeWidth={selected ? 1.5 : 1} />
                  <rect width={3} height={h} rx={1.5} fill="#e3c65e" />
                  {lines.map((l, i) => (
                    <text key={i} x={13} y={19 + i * 15} fontSize={11} fill="#6b5c22">
                      {l}
                    </text>
                  ))}
                </g>
              );
            })}

            {/* nodes — white cards, mono kind label, mint selection + handles */}
            {flow.nodes.map((n) => {
              const p = pos[n.id];
              if (!p) return null;
              const selected = selection?.type === "node" && selection.id === n.id;
              return (
                <g key={n.id} transform={`translate(${p.x}, ${p.y})`} onPointerDown={(e) => startDrag(e, n.id, "node")} onClick={(e) => e.stopPropagation()} style={{ cursor: "grab" }}>
                  <rect width={NODE_W} height={NODE_H} rx={9} fill="#fff" stroke={selected ? P.mintDeep : P.line} strokeWidth={selected ? 1.6 : 1} />
                  <text x={13} y={21} fontSize={8.5} letterSpacing={1.8} fontFamily="monospace" fill={kindInk(n.kind)}>
                    {KIND_LABEL[n.kind].toUpperCase()}
                  </text>
                  <text x={13} y={40} fontSize={13} fontWeight={600} fill={P.ink}>
                    {n.label.length > 19 ? `${n.label.slice(0, 18)}…` : n.label}
                  </text>
                  {selected && (
                    <>
                      <circle cx={0} cy={NODE_H / 2} r={4} fill="#fff" stroke={P.mintDeep} strokeWidth={1.5} />
                      <circle cx={NODE_W / 2} cy={0} r={4} fill="#fff" stroke={P.mintDeep} strokeWidth={1.5} />
                    </>
                  )}
                  {/* edge handle: drag to start a leg */}
                  <circle cx={NODE_W} cy={NODE_H / 2} r={12} fill="transparent" style={{ cursor: "crosshair" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const pt = svgPoint(e);
                      setLegDraft({ from: n.id, x: pt.x, y: pt.y });
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    }}
                  />
                  <circle cx={NODE_W} cy={NODE_H / 2} r={selected ? 5 : 4.5} fill="#fff" stroke={P.mintDeep} strokeWidth={1.5} pointerEvents="none" />
                </g>
              );
            })}
          </svg>

          {/* ── inline editors, anchored to the selection (design 6a #4 / 6b) ── */}
          {selNode && pos[selNode.id] && (() => {
            const s = toScreen(pos[selNode.id].x + NODE_W / 2, pos[selNode.id].y + NODE_H + 10);
            const at = { left: Math.min(Math.max(s.left - 118, 8), wrapBox.w - 244), top: Math.min(s.top, wrapBox.h - 190) };
            return (
            <div
              className="absolute z-10 w-[236px] rounded-xl bg-white p-3 shadow-lg"
              style={{ border: `1px solid ${P.line}`, ...at }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 font-mono text-[9px] font-medium tracking-[.18em]" style={{ color: P.faint }}>
                NODE
              </div>
              <input
                value={selNode.label}
                onChange={(e) => patchNode(selNode.id, { label: e.target.value })}
                className="mb-2 w-full rounded-lg px-2.5 py-2 text-[12.5px] outline-none"
                style={{ border: `1px solid ${P.line}`, color: P.ink }}
              />
              <div className="mb-2 flex flex-wrap gap-1">
                {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => patchNode(selNode.id, { kind: k })}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                    style={
                      selNode.kind === k
                        ? { background: P.mint, color: "#06231a" }
                        : { border: `1px solid ${P.line}`, color: P.sub }
                    }
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: P.faint }}>
                  retyping keeps its arrows
                </span>
                <button onClick={deleteSelection} className="text-[11px] font-medium transition hover:opacity-70" style={{ color: P.danger }}>
                  Delete
                </button>
              </div>
            </div>
            );
          })()}

          {selLeg && selLegIndex != null && (() => {
            const a = anchor(selLeg.from);
            const b = anchor(selLeg.to);
            if (!a || !b) return null;
            const mid = toScreen((a.cx + b.cx) / 2, Math.max(a.cy, b.cy) + 40);
            const fromN = flow.nodes.find((n) => n.id === selLeg.from);
            const toN = flow.nodes.find((n) => n.id === selLeg.to);
            return (
              <div
                className="absolute z-10 w-[320px] rounded-xl bg-white p-3.5 shadow-lg"
                style={{ border: `1px solid ${P.line}`, left: Math.min(Math.max(mid.left - 160, 8), wrapBox.w - 328), top: Math.max(8, Math.min(mid.top, wrapBox.h - 430)) }}
                onClick={(e) => e.stopPropagation()}
              >
                {crossingUnconverted && (
                  <div className="mb-2.5 rounded-lg px-2.5 py-2 text-[11px] leading-snug" style={{ background: P.amberTint, border: `1px solid ${P.amberLine}`, color: P.amber }}>
                    ⚠ This leg crosses the border but nothing converts. Turn on the FX engine below.
                  </div>
                )}
                <div className="mb-0.5 font-mono text-[9px] font-medium tracking-[.18em]" style={{ color: P.faint }}>
                  LEG
                </div>
                <div className="mb-2.5 text-[12.5px] font-semibold" style={{ color: P.ink }}>
                  {fromN?.label} → {toN?.label}
                  {fromN?.lane !== toN?.lane && (
                    <span className="font-normal" style={{ color: P.sub }}>
                      {" "}· crosses the border
                    </span>
                  )}
                </div>
                <div className="mb-1 text-[11px] font-medium" style={{ color: P.sub }}>
                  Carries
                </div>
                <div className="mb-2.5 flex flex-wrap gap-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => patchLeg(selLegIndex, { carries: c })}
                      className="rounded-full px-2 py-1 font-mono text-[10.5px] transition"
                      style={
                        selLeg.carries === c
                          ? { border: `1.4px solid ${P.mintDeep}`, color: P.mintInk, background: P.mintTint }
                          : { border: `1px solid ${P.line}`, color: P.sub }
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="mb-2.5 rounded-lg p-2.5" style={{ background: selLeg.convertsTo ? P.mintTint : "#f7f6f1", border: `1px solid ${selLeg.convertsTo ? P.mintLine : P.line}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-semibold" style={{ color: selLeg.convertsTo ? P.mintInk : P.ink }}>
                      Converts on this leg
                    </span>
                    <button
                      role="switch"
                      aria-checked={!!selLeg.convertsTo}
                      onClick={() => {
                        if (selLeg.convertsTo) {
                          patchLeg(selLegIndex, { convertsTo: undefined, alsoConvertsTo: undefined });
                          return;
                        }
                        // money leaves the account as it arrived; the FX engine
                        // converts on the leg — carries snaps to the arriving
                        // currency, the target starts from there
                        const arriving = arrivingCurrency(flow, selLeg.from) ?? selLeg.carries;
                        patchLeg(selLegIndex, { carries: arriving, convertsTo: arriving === "BRL" ? "USD/EUR" : "BRL" });
                      }}
                      className="relative h-[18px] w-[32px] rounded-full transition"
                      style={{ background: selLeg.convertsTo ? P.mint : "#d8d5cb" }}
                    >
                      <span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all" style={{ left: selLeg.convertsTo ? 16 : 2 }} />
                    </button>
                  </div>
                  {selLeg.convertsTo && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <span className="font-mono text-[10.5px]" style={{ color: P.mintInk }}>
                        {selLeg.carries} →
                      </span>
                      {CURRENCIES.filter((c) => c !== selLeg.carries).map((c) => (
                        <button
                          key={c}
                          onClick={() => patchLeg(selLegIndex, { convertsTo: c, alsoConvertsTo: selLeg.alsoConvertsTo?.filter((x) => x !== c).length ? selLeg.alsoConvertsTo.filter((x) => x !== c) : undefined })}
                          className="rounded-full px-1.5 py-0.5 font-mono text-[10px] transition"
                          style={
                            selLeg.convertsTo === c
                              ? { border: `1.4px solid ${P.mintDeep}`, color: P.mintInk, background: "#fff" }
                              : { border: `1px solid ${P.mintLine}`, color: P.sub }
                          }
                        >
                          {c}
                        </button>
                      ))}
                      <span className="w-full pt-1 text-[10px] font-medium" style={{ color: P.sub }}>
                        Can also deliver — the deck alternates the outputs:
                      </span>
                      {CURRENCIES.filter((c) => c !== selLeg.carries && c !== selLeg.convertsTo).map((c) => {
                        const on = !!selLeg.alsoConvertsTo?.includes(c);
                        return (
                          <button
                            key={`alt-${c}`}
                            onClick={() => {
                              const cur = selLeg.alsoConvertsTo ?? [];
                              const next = on ? cur.filter((x) => x !== c) : [...cur, c];
                              patchLeg(selLegIndex, { alsoConvertsTo: next.length ? next : undefined });
                            }}
                            className="rounded-full px-1.5 py-0.5 font-mono text-[10px] transition"
                            style={
                              on
                                ? { border: `1.4px solid ${P.mintDeep}`, color: P.mintInk, background: "#fff" }
                                : { border: `1px dashed ${P.mintLine}`, color: P.sub }
                            }
                          >
                            {on ? "✓ " : "+ "}{c}
                          </button>
                        );
                      })}
                      <span className="w-full pt-0.5 text-[9.5px]" style={{ color: P.mintInk, opacity: 0.8 }}>
                        via Trace FX engine · spot + spread
                      </span>
                    </div>
                  )}
                </div>
                <div className="mb-1 text-[11px] font-medium" style={{ color: P.sub }}>
                  Direction
                </div>
                <div className="mb-3 inline-flex rounded-lg p-[2px]" style={{ border: `1px solid ${P.line}`, background: "#f7f6f1" }}>
                  {[
                    { label: `→ ${toN?.label ?? ""}`, active: true },
                    { label: `→ ${fromN?.label ?? ""}`, active: false },
                  ].map((o) => (
                    <button
                      key={o.label}
                      onClick={() => !o.active && patchLeg(selLegIndex, { from: selLeg.to, to: selLeg.from })}
                      className="max-w-[130px] truncate rounded-md px-2 py-1 text-[11px] font-medium transition"
                      style={o.active ? { background: "#fff", color: P.ink, boxShadow: "0 1px 2px rgba(0,0,0,.06)" } : { color: P.sub }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <button onClick={deleteSelection} className="text-[11.5px] font-medium transition hover:opacity-70" style={{ color: P.danger }}>
                    Remove leg
                  </button>
                  <button
                    onClick={() => setSelection(null)}
                    className="rounded-lg px-3 py-1.5 text-[11.5px] font-semibold"
                    style={{ background: P.mint, color: "#06231a" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            );
          })()}

          {selNote && (
            <div
              className="absolute z-10 w-[240px] rounded-xl bg-white p-3 shadow-lg"
              style={{ border: `1px solid ${P.line}`, ...toScreen(selNote.x, selNote.y + 56) }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1.5 font-mono text-[9px] font-medium tracking-[.18em]" style={{ color: P.faint }}>
                NOTE · EDITOR-ONLY
              </div>
              <textarea
                value={selNote.text}
                onChange={(e) => update({ ...flow, editor: { ...ed, notes: ed.notes.map((n) => (n.id === selNote.id ? { ...n, text: e.target.value } : n)) } }, false)}
                onBlur={() => update(flow)}
                rows={3}
                className="w-full rounded-lg px-2.5 py-2 text-[12px] outline-none"
                style={{ border: `1px solid ${P.line}`, color: P.ink }}
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px]" style={{ color: P.faint }}>
                  the client deck never shows this
                </span>
                <button onClick={deleteSelection} className="text-[11px] font-medium" style={{ color: P.danger }}>
                  Delete
                </button>
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
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-6" onClick={onClose}>
      <div className="w-full max-w-[520px] rounded-2xl p-5 shadow-2xl" style={{ background: P.page, border: `1px solid ${P.line}` }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-semibold" style={{ color: P.ink }}>
          New tailored flow
        </div>
        <p className="mb-3 text-[12px]" style={{ color: P.sub }}>
          Fork the closest library flow, or start blank.
        </p>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Search flows — "offshore", "NRA", "stablecoin"…'
          className="mb-3 w-full rounded-lg bg-white px-3 py-2.5 text-[13px] outline-none"
          style={{ border: `1px solid ${P.line}`, color: P.ink }}
        />
        <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => onCreate(forkFlow(f, clientName))}
              className="flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left transition hover:opacity-80"
              style={{ border: `1px solid ${P.line}` }}
            >
              <span className="w-8 shrink-0 font-mono text-[12px] font-semibold" style={{ color: P.mintInk }}>
                {f.displayId}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium" style={{ color: P.ink }}>
                  {f.title}
                </span>
                <span className="block truncate text-[10.5px]" style={{ color: P.sub }}>
                  {f.blurb}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold" style={{ color: P.mintInk }}>
                Fork & edit
              </span>
            </button>
          ))}
          {!results.length && (
            <div className="py-6 text-center text-[12px]" style={{ color: P.sub }}>
              No flows match.
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${P.line}` }}>
          <p className="pr-3 text-[10.5px] leading-snug" style={{ color: P.faint }}>
            Forked flows keep the working parts — you edit only the leg that&apos;s different.
          </p>
          <button
            onClick={() => onCreate(blankFlow(clientName))}
            className="shrink-0 rounded-lg bg-white px-3 py-2 text-[12px] font-medium transition hover:opacity-80"
            style={{ border: `1px solid ${P.line}`, color: P.ink }}
          >
            Start blank
          </button>
        </div>
      </div>
    </div>
  );
}
