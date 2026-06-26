"use client";
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Currency, FlowConfig } from "../data/schema";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint } from "./tokens";
import type { FlowLayout, NodeLayout } from "./layout";
import {
  CurrencyToken,
  FlowNodeShape,
  MachineryContainer,
  TraceArrow,
  displayCurrency,
} from "./FlowSvg";

// Stage 2 — "how Trace makes it happen". The machinery reads as ONE continuous
// rail running behind every station box (the boxes cover its ends flush, so it
// never protrudes and shows no caps between nodes); the conversion hub is the
// only interruption. Value relays purely by z-order: a single token travels the
// whole rail, hidden behind the boxes/hub and visible only in the gaps, so it
// appears absorbed into each node and re-emerging from the next. At a hub the
// token is absorbed (behind the plinth), the mark spins 360°, and the converted
// currency emerges. Draw order: rail → token → boxes → hubs → arrows.

const EASE = "cubic-bezier(.4,0,.2,1)";
const HUB_R = 22;

// ── motion-design constants ──────────────────────────────────────────────────
const MS_PER_PX = 14; // CONSTANT travel speed across every leg (higher = slower, more deliberate)
const MIN_GO = 560; // floor so a short half-leg into/out of a hub isn't a blink
const PAUSE_MS = 260; // a brief breath as value rests behind each station
const SPIN_MS = 1180; // the FX-engine conversion moment
const END_REST_MS = 700;
const R_HIDE = 12; // token fully hidden within this of a hub centre (deep inside the
                   // plinth, absorbed) — kept well inside HUB_R(22) so the token
                   // visibly travels INTO the hub before vanishing, rather than
                   // blinking out short of it.
const R_SHOW = 44; // token fully shown beyond this — fade only begins as the token
                   // reaches the plinth, so it dissolves as it enters the hub.
const RIPPLE_MS = 460; // box landing ripple — fast, like the FX hub's impact ring
const RIPPLE_MAX = 0.5; // ripple peak opacity (kept gentle, not a steady glow)

// easings
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type Phase = {
  kind: "go" | "conv" | "pause";
  x0: number;
  x1: number;
  cur: Currency;
  preCur?: Currency;
  hub?: number;
  dur: number;
  s: number;
};

/** Build the relay timeline from the legs, oriented for the configured direction. */
function buildTimeline(layout: FlowLayout, config: FlowConfig, byId: Map<string, NodeLayout>) {
  const reverse = config.direction === "disbursement";
  const seq = reverse ? layout.legs.slice().reverse() : layout.legs;
  const D = (c: Currency) => displayCurrency(c, config);
  const phases: Phase[] = [];
  let x: number | null = null;
  // duration ∝ distance → the token holds one steady speed on every leg, and
  // long legs simply cruise longer (no apparent speeding up / slowing down).
  const dur = (d: number) => Math.max(MIN_GO, d * MS_PER_PX);

  for (const L of seq) {
    const n0 = byId.get(reverse ? L.to : L.from)!;
    const n1 = byId.get(reverse ? L.from : L.to)!;
    if (x === null) x = n0.cx;
    if (L.convertsTo) {
      const hubX = L.mid.x;
      const pre = D(reverse ? L.convertsTo : L.carries);
      const post = D(reverse ? L.carries : L.convertsTo);
      phases.push({ kind: "go", x0: x, x1: hubX, cur: pre, dur: dur(Math.abs(hubX - x)), s: 0 });
      phases.push({ kind: "conv", x0: hubX, x1: hubX, cur: post, preCur: pre, hub: L.index, dur: SPIN_MS, s: 0 });
      phases.push({ kind: "go", x0: hubX, x1: n1.cx, cur: post, dur: dur(Math.abs(n1.cx - hubX)), s: 0 });
      x = n1.cx;
    } else {
      const cur = D(L.carries);
      phases.push({ kind: "go", x0: x, x1: n1.cx, cur, dur: dur(Math.abs(n1.cx - x)), s: 0 });
      x = n1.cx;
      phases.push({ kind: "pause", x0: x, x1: x, cur, dur: PAUSE_MS, s: 0 });
    }
  }
  // a brief rest at the final station before the relay loops (and so every
  // node has a clean arrival time, even conversion-ending flows)
  if (phases.length) {
    const last = phases[phases.length - 1];
    if (last.kind === "pause") last.dur = END_REST_MS;
    else phases.push({ kind: "pause", x0: last.x1, x1: last.x1, cur: last.cur, dur: END_REST_MS, s: 0 });
  }
  let t = 0;
  for (const ph of phases) {
    ph.s = t;
    t += ph.dur;
  }
  return { phases, total: t, startX: phases[0]?.x0 ?? 0 };
}

export function MachineryStage({
  layout,
  config,
  animate,
  showHeading = true,
}: {
  layout: FlowLayout;
  config: FlowConfig;
  animate: boolean;
  showHeading?: boolean;
}) {
  const reduced = useReducedMotion();
  const run = animate && !reduced;
  const nodes = layout.nodes;
  const railY = nodes[0]?.cy ?? 412;
  const accent = accentFor(config.direction);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n] as const)), [nodes]);
  const hubs = useMemo(
    () => layout.legs.filter((l) => l.convertsTo).map((l) => ({ x: l.mid.x, key: l.index })),
    [layout.legs],
  );
  const currencies = useMemo(() => {
    const s = new Set<Currency>();
    layout.legs.forEach((l) => {
      s.add(displayCurrency(l.carries, config));
      if (l.convertsTo) s.add(displayCurrency(l.convertsTo, config));
    });
    return [...s];
  }, [layout.legs, config]);
  const timeline = useMemo(() => buildTimeline(layout, config, byId), [layout, config, byId]);

  // when (in the relay cycle) the token arrives at each node centre — used to
  // fire that box's landing ripple. Earliest phase ending at the node's cx.
  const landings = useMemo(() => {
    const m: Record<string, number> = {};
    const byCx = new Map<number, string>();
    nodes.forEach((n) => byCx.set(Math.round(n.cx), n.id));
    const startId = byCx.get(Math.round(timeline.startX));
    if (startId) m[startId] = 0; // value originates at the first node
    for (const ph of timeline.phases) {
      const id = byCx.get(Math.round(ph.x1));
      if (id == null) continue;
      const t = ph.s + ph.dur;
      if (!(id in m) || t < m[id]) m[id] = t;
    }
    return m;
  }, [timeline, nodes]);

  const tokenRef = useRef<SVGGElement>(null);
  const curRefs = useRef<Record<string, SVGGElement | null>>({});
  const hubMarkRefs = useRef<Record<number, SVGGElement | null>>({});
  const pulseRefs = useRef<Record<number, SVGCircleElement | null>>({});
  const rippleRefs = useRef<Record<string, SVGGElement | null>>({});

  // QA hook: ?frame=<ms> freezes the relay at a fixed point in the cycle so a
  // deterministic frame can be captured (the loop is rAF-driven otherwise).
  const freezeMs = useMemo(() => {
    if (typeof window === "undefined") return null;
    const v = new URLSearchParams(window.location.search).get("frame");
    return v == null ? null : Number(v);
  }, []);

  useEffect(() => {
    if (!run || !timeline.phases.length) return;
    const reverse = config.direction === "disbursement";
    const total = timeline.total;
    const render = (e: number) => {
      let p = timeline.phases[0];
      let lp = 0;
      for (const ph of timeline.phases) {
        if (e >= ph.s && e < ph.s + ph.dur) {
          p = ph;
          lp = (e - ph.s) / ph.dur;
          break;
        }
      }
      let x = p.x0;
      let cur: Currency = p.cur;
      let ang = 0;
      let hubScale = 1;
      let pulse = 0;
      let pulseR = HUB_R;
      let activeHub = -1;
      if (p.kind === "go") {
        // LINEAR travel: constant pixels-per-ms, so the token moves at exactly
        // the same speed across every leg (no per-leg accelerate/decelerate).
        x = p.x0 + (p.x1 - p.x0) * lp;
      } else if (p.kind === "pause") {
        x = p.x0;
      } else {
        // the FX engine doing work: receive (contract) → process (spin) →
        // deliver (release, with a slight pop). The token is absorbed before
        // this and emitted after — the mark spins alone.
        x = p.x0;
        activeHub = p.hub!;
        const a = lp;
        ang = (reverse ? -1 : 1) * 360 * easeInOut(a);
        if (a < 0.28) hubScale = 1 - 0.4 * easeOut(a / 0.28); // 1 → 0.6, receive
        else if (a < 0.68) hubScale = 0.6; // hold contracted while spinning
        else hubScale = 0.6 + 0.4 * easeOutBack(clamp01((a - 0.68) / 0.32)); // → 1 (+overshoot), deliver
        if (a < 0.5) {
          const u = a / 0.5; // one impact ring rippling out on receive
          pulse = 0.5 * (1 - u);
          pulseR = HUB_R + 18 * easeOut(u);
        }
        cur = a >= 0.5 ? p.cur : p.preCur ?? p.cur;
      }

      // The token travels at FULL SIZE the whole way (always legible). It only
      // fades — never shrinks — and only right at a conversion hub, so its wide
      // pill never flashes its edges beside the plinth during the swap. Between
      // boxes it stays fully opaque; behind a box it's hidden by z-order while
      // that box lights up (see the box-glow pass below).
      let dmin = Infinity;
      for (const hb of hubs) {
        const d = Math.abs(x - hb.x);
        if (d < dmin) dmin = d;
      }
      const op = hubs.length ? clamp01((dmin - R_HIDE) / (R_SHOW - R_HIDE)) : 1;
      if (tokenRef.current) {
        tokenRef.current.setAttribute("transform", `translate(${x.toFixed(1)},${railY})`);
        tokenRef.current.style.opacity = op.toFixed(3);
      }

      // box ripple: each station fires a single quick green ripple as value
      // lands on it — the same impact-ring gesture the FX hub makes when money
      // goes in. A fast expand-and-fade from the box border, then gone.
      nodes.forEach((n) => {
        const g = rippleRefs.current[n.id];
        if (!g) return;
        const land = landings[n.id];
        if (land == null) {
          g.style.opacity = "0";
          return;
        }
        const dt = (((e - land) % total) + total) % total;
        if (dt > RIPPLE_MS) {
          g.style.opacity = "0";
          return;
        }
        const rp = dt / RIPPLE_MS;
        const s = 1 + 0.11 * easeOut(rp); // expand outward from the border
        g.setAttribute("transform", `translate(${n.cx} ${n.cy}) scale(${s.toFixed(4)}) translate(${-n.cx} ${-n.cy})`);
        g.style.opacity = (RIPPLE_MAX * (1 - rp)).toFixed(3);
      });
      currencies.forEach((c) => {
        const el = curRefs.current[c];
        if (el) el.style.opacity = c === cur ? "1" : "0";
      });
      hubs.forEach((hb) => {
        const m = hubMarkRefs.current[hb.key];
        const pc = pulseRefs.current[hb.key];
        const on = hb.key === activeHub;
        if (m) m.setAttribute("transform", on ? `rotate(${ang.toFixed(1)}) scale(${hubScale.toFixed(3)})` : "rotate(0) scale(1)");
        if (pc) {
          pc.setAttribute("r", (on ? pulseR : HUB_R).toFixed(1));
          pc.style.opacity = on ? pulse.toFixed(2) : "0";
        }
      });
    };

    if (freezeMs != null) {
      render(((freezeMs % total) + total) % total);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      render((now - start) % total);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, timeline, railY, config.direction, currencies, hubs, landings, nodes, freezeMs]);

  const x0 = nodes[0]?.cx ?? 0;
  const xN = nodes[nodes.length - 1]?.cx ?? 0;
  const railTransition = reduced ? undefined : `fill .55s ${EASE}, stroke .55s ${EASE}`;
  const markW = HUB_R;
  const markH = markW / TRACE_LOGO_AR;

  return (
    <g>
      <MachineryContainer layout={layout} showHeading={showHeading} />

      {/* ONE continuous rail behind all boxes — interrupted only by the hub.
          Ends are tucked under the first/last box centers so it never protrudes. */}
      <rect
        x={x0}
        y={railY - 15}
        width={Math.max(0, xN - x0)}
        height={30}
        rx={15}
        fill={tubeTint(config.direction)}
        stroke={accent}
        strokeOpacity={0.42}
        style={{ transition: railTransition }}
      />

      {/* the relay token (behind the boxes → visible only in the gaps) */}
      {run ? (
        <g ref={tokenRef} transform={`translate(${timeline.startX},${railY})`} style={{ willChange: "transform, opacity" }}>
          {currencies.map((c) => (
            <g key={c} ref={(el) => { curRefs.current[c] = el; }} style={{ opacity: 0 }}>
              <CurrencyToken currency={c} coin={config.stablecoin} accent={accent} />
            </g>
          ))}
        </g>
      ) : (
        // reduced motion: static value resting in each plain gap
        layout.legs
          .filter((l) => !l.convertsTo)
          .map((l) => (
            <g key={l.index} transform={`translate(${l.mid.x},${railY})`}>
              <CurrencyToken currency={displayCurrency(l.carries, config)} coin={config.stablecoin} />
            </g>
          ))
      )}

      {/* station boxes — cover the rail's ends + the resting token */}
      {nodes.map((node) => (
        <FlowNodeShape
          key={node.id}
          node={node}
          isPrimaryClient={node.id === layout.primaryClientId}
          clientName={config.clientName}
          clientLogoUrl={config.clientLogoUrl}
          clientLogoPlate={config.clientLogoPlate}
        />
      ))}

      {/* box landing ripples — a single quick green ring each station emits as
          value lands on it (driven by the relay loop). On top of the boxes. */}
      {nodes.map((n) => (
        <g key={`rip-${n.id}`} ref={(el) => { rippleRefs.current[n.id] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={12} fill="none" stroke={C.green} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g>
      ))}

      {/* conversion hubs — sit ON the line, drawn over the boxes */}
      {hubs.map((hb) => (
        <g key={hb.key}>
          <circle cx={hb.x} cy={railY} r={HUB_R} fill="#0b110d" stroke={C.green} strokeOpacity={0.3} />
          <circle ref={(el) => { pulseRefs.current[hb.key] = el; }} cx={hb.x} cy={railY} r={HUB_R} fill="none" stroke={C.green} strokeWidth={2} opacity={0} />
          <g transform={`translate(${hb.x},${railY})`}>
            <g ref={(el) => { hubMarkRefs.current[hb.key] = el; }} style={{ willChange: "transform" }}>
              <image href={ASSETS.traceLogo} x={-markW / 2} y={-markH / 2} width={markW} height={markH} />
            </g>
          </g>
        </g>
      ))}

      {/* directional indicators — one per rail segment, in the flow direction */}
      {layout.legs.map((l) => (
        <TraceArrow key={l.index} cx={Math.min(l.x1, l.x2) + 22} cy={railY} size={22} direction={config.direction} />
      ))}
    </g>
  );
}
