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
  fxOutputs,
  outputsLabel,
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

/** Per-cycle effective currencies: a multi-output hub (Leg.alsoConvertsTo)
 *  delivers a different currency on each relay pass, and every data-downstream
 *  leg that carried the primary output follows the switch. */
function cycleCurrencies(layout: FlowLayout, cycle: number) {
  const carriesOf = new Map<number, Currency>();
  const outOf = new Map<number, Currency>();
  let sub: { from: Currency; to: Currency } | null = null;
  for (const L of layout.legs) {
    if (L.offTrunk) continue;
    let carries = L.carries;
    if (sub) {
      if (carries === sub.from) carries = sub.to;
      else sub = null; // currency continuity ended — stop substituting
    }
    carriesOf.set(L.index, carries);
    if (L.convertsTo) {
      const outs = fxOutputs(L);
      const chosen = outs[cycle % outs.length];
      outOf.set(L.index, chosen);
      sub = chosen !== L.convertsTo ? { from: L.convertsTo, to: chosen } : null;
    }
  }
  return { carriesOf, outOf };
}

/** Build the relay timeline from the legs, oriented for the configured
 *  direction. `cycle` picks which output a multi-output hub delivers. */
function buildTimeline(layout: FlowLayout, config: FlowConfig, byId: Map<string, NodeLayout>, cycle = 0) {
  const reverse = config.direction === "disbursement";
  // The relay travels the trunk only; tributary legs (a second payer merging
  // in) show a resting token instead — the same vocabulary as reduced motion.
  const trunkLegs = layout.legs.filter((l) => !l.offTrunk);
  const seq = reverse ? trunkLegs.slice().reverse() : trunkLegs;
  const D = (c: Currency) => displayCurrency(c, config);
  const { carriesOf, outOf } = cycleCurrencies(layout, cycle);
  const phases: Phase[] = [];
  let x: number | null = null;
  // duration ∝ distance → the token holds one steady speed on every leg, and
  // long legs simply cruise longer (no apparent speeding up / slowing down).
  const dur = (d: number) => Math.max(MIN_GO, d * MS_PER_PX);

  for (const L of seq) {
    const n0 = byId.get(reverse ? L.to : L.from)!;
    const n1 = byId.get(reverse ? L.from : L.to)!;
    if (x === null) x = n0.cx;
    const carriesC = carriesOf.get(L.index) ?? L.carries;
    if (L.convertsTo) {
      const outC = outOf.get(L.index) ?? L.convertsTo;
      const hubX = L.mid.x;
      const pre = D(reverse ? outC : carriesC);
      const post = D(reverse ? carriesC : outC);
      phases.push({ kind: "go", x0: x, x1: hubX, cur: pre, dur: dur(Math.abs(hubX - x)), s: 0 });
      phases.push({ kind: "conv", x0: hubX, x1: hubX, cur: post, preCur: pre, hub: L.index, dur: SPIN_MS, s: 0 });
      phases.push({ kind: "go", x0: hubX, x1: n1.cx, cur: post, dur: dur(Math.abs(n1.cx - hubX)), s: 0 });
      x = n1.cx;
    } else {
      const cur = D(carriesC);
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
  const railY = layout.railY ?? nodes[0]?.cy ?? 412;
  const accent = accentFor(config.direction);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n] as const)), [nodes]);
  const hubs = useMemo(
    () => layout.legs.filter((l) => l.convertsTo).map((l) => ({ x: l.mid.x, y: l.mid.y, key: l.index, offTrunk: !!l.offTrunk })),
    [layout.legs],
  );
  const railHubs = useMemo(() => hubs.filter((h) => !h.offTrunk), [hubs]);
  // Depend on the specific config fields these actually read (direction +
  // collected/delivered, via displayCurrency), NOT config's object identity —
  // otherwise every parent re-render (e.g. typing the client name) rebuilds the
  // timeline and restarts the rAF relay from the first node.
  const currencies = useMemo(() => {
    const s = new Set<Currency>();
    layout.legs.forEach((l) => {
      s.add(displayCurrency(l.carries, config));
      fxOutputs(l).forEach((c) => s.add(displayCurrency(c, config)));
    });
    return [...s];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.legs, config.direction, config.collected, config.delivered]);
  // Static views (reduced motion, the PDF): legs downstream of a multi-output
  // hub rest a combined label ("EUR / USDC") instead of picking one output.
  const multiRest = useMemo(() => {
    const m = new Map<number, string>();
    let sub: { from: Currency; label: string } | null = null;
    for (const L of layout.legs) {
      if (L.offTrunk) continue;
      if (sub && L.carries === sub.from) m.set(L.index, sub.label);
      else if (sub) sub = null;
      const outs = fxOutputs(L);
      if (outs.length > 1) sub = { from: outs[0], label: outputsLabel(outs, config) };
      else if (L.convertsTo) sub = null;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.legs, config.stablecoin, config.collected, config.delivered]);
  // One timeline per output cycle: a multi-output hub ("we can deliver EUR or
  // USDC") makes the relay alternate — pass 1 shows the primary, pass 2 the
  // alternate, and so on. Geometry and durations are identical across cycles.
  const timelines = useMemo(() => {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
    const n = Math.min(
      6,
      layout.legs
        .filter((l) => !l.offTrunk && l.convertsTo)
        .map((l) => fxOutputs(l).length)
        .reduce((a, b) => (a * b) / gcd(a, b), 1),
    );
    return Array.from({ length: Math.max(1, n) }, (_, c) => buildTimeline(layout, config, byId, c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, config.direction, config.collected, config.delivered, byId]);
  const timeline = timelines[0];

  // when (in the relay cycle) the token arrives at each node centre — used to
  // fire that box's landing ripple. Earliest phase ending at the node's cx.
  const landings = useMemo(() => {
    const m: Record<string, number> = {};
    const byCx = new Map<number, string>();
    // trunk stations only — a tributary stacked in the same column shares its
    // cx, but the relay never lands on it
    nodes.filter((n) => n.onTrunk !== false).forEach((n) => byCx.set(Math.round(n.cx), n.id));
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
    const total = timeline.total; // identical across cycles (same geometry)
    // `e` is elapsed within the pass; `tl` is that pass's timeline (a
    // multi-output hub delivers a different currency each pass).
    const render = (e: number, tl = timeline) => {
      let p = tl.phases[0];
      let lp = 0;
      for (const ph of tl.phases) {
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
      for (const hb of railHubs) {
        const d = Math.abs(x - hb.x);
        if (d < dmin) dmin = d;
      }
      const op = railHubs.length ? clamp01((dmin - R_HIDE) / (R_SHOW - R_HIDE)) : 1;
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
      // frame > total selects a later pass — QA can freeze any output cycle
      const f = Math.max(0, freezeMs);
      render(f % total, timelines[Math.floor(f / total) % timelines.length]);
      // QA hook: pass timing so a test can aim a frame at a specific pass
      (window as Window & { __tfRelay?: { total: number; cycles: number } }).__tfRelay = { total, cycles: timelines.length };
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const e = now - start;
      render(e % total, timelines[Math.floor(e / total) % timelines.length]);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, timeline, timelines, railY, config.direction, currencies, hubs, railHubs, landings, nodes, freezeMs]);

  const trunkNodes = nodes.filter((n) => n.onTrunk !== false);
  const x0 = trunkNodes[0]?.cx ?? nodes[0]?.cx ?? 0;
  const xN = trunkNodes[trunkNodes.length - 1]?.cx ?? nodes[nodes.length - 1]?.cx ?? 0;
  const railTransition = reduced ? undefined : `fill .55s ${EASE}, stroke .55s ${EASE}`;
  const markW = HUB_R;
  const markH = markW / TRACE_LOGO_AR;

  return (
    <g>
      <MachineryContainer layout={layout} showHeading={showHeading} />

      {/* tributary conduits — a second origin merging into the rail. The same
          recessed-channel material as the rail, drawn as a curve: a soft wide
          channel plus a hairline spine. Behind everything, like the rail. */}
      {layout.legs
        .filter((l) => l.offTrunk)
        .map((l) => (
          <g key={`trib-${l.index}`}>
            <path d={l.d} fill="none" stroke={tubeTint(config.direction)} strokeWidth={30} strokeLinecap="round" style={{ transition: railTransition }} />
            <path d={l.d} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={1} style={{ transition: railTransition }} />
          </g>
        ))}

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
            <g key={c} ref={(el) => { curRefs.current[c] = el; }} style={{ opacity: 0 }} data-token-face={c}>
              <CurrencyToken currency={c} coin={config.stablecoin} accent={accent} />
            </g>
          ))}
        </g>
      ) : (
        // reduced motion: static value resting in each plain gap (a combined
        // label after a multi-output hub — the animation is what alternates)
        layout.legs
          .filter((l) => !l.convertsTo)
          .map((l) => (
            <g key={l.index} transform={`translate(${l.mid.x},${l.mid.y})`}>
              <CurrencyToken currency={(multiRest.get(l.index) as Currency) ?? displayCurrency(l.carries, config)} coin={config.stablecoin} />
            </g>
          ))
      )}

      {/* tributary value at rest — the relay travels the trunk, so each merging
          leg shows its currency resting mid-conduit (reduced-motion vocabulary) */}
      {run &&
        layout.legs
          .filter((l) => l.offTrunk && !l.convertsTo)
          .map((l) => (
            <g key={`trib-token-${l.index}`} transform={`translate(${l.mid.x},${l.mid.y})`}>
              <CurrencyToken currency={displayCurrency(l.carries, config)} coin={config.stablecoin} />
            </g>
          ))}

      {/* station boxes — cover the rail's ends + the resting token.
          data-flow-node lets the build page offer double-click renaming. */}
      {nodes.map((node) => (
        <g key={node.id} data-flow-node={node.kind === "engine" ? undefined : node.srcId ?? node.id}>
          <FlowNodeShape
            node={node}
            isPrimaryClient={node.id === layout.primaryClientId}
            clientName={config.clientName}
            clientLogoUrl={config.clientLogoUrl}
            clientLogoPlate={config.clientLogoPlate}
          />
        </g>
      ))}

      {/* box landing ripples — a single quick green ring each station emits as
          value lands on it (driven by the relay loop). On top of the boxes. */}
      {nodes.map((n) => (
        <g key={`rip-${n.id}`} ref={(el) => { rippleRefs.current[n.id] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
          <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={12} fill="none" stroke={C.green} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g>
      ))}

      {/* conversion hubs — sit ON their conduit (the rail, or a tributary curve),
          drawn over the boxes */}
      {hubs.map((hb) => (
        <g key={hb.key}>
          <circle cx={hb.x} cy={hb.y} r={HUB_R} fill="#0b110d" stroke={C.green} strokeOpacity={0.3} />
          <circle ref={(el) => { pulseRefs.current[hb.key] = el; }} cx={hb.x} cy={hb.y} r={HUB_R} fill="none" stroke={C.green} strokeWidth={2} opacity={0} />
          <g transform={`translate(${hb.x},${hb.y})`}>
            <g ref={(el) => { hubMarkRefs.current[hb.key] = el; }} style={{ willChange: "transform" }}>
              <image href={ASSETS.traceLogo} x={-markW / 2} y={-markH / 2} width={markW} height={markH} />
            </g>
          </g>
        </g>
      ))}

      {/* directional indicators — one per rail segment, sat just ahead of where
          the token emerges (the source end, which flips with direction). The
          resting tributary token already tells that conduit's story. */}
      {layout.legs
        .filter((l) => !l.offTrunk)
        .map((l) => (
          <TraceArrow
            key={l.index}
            cx={config.direction === "collection" ? Math.min(l.x1, l.x2) + 22 : Math.max(l.x1, l.x2) - 22}
            cy={railY}
            size={22}
            direction={config.direction}
          />
        ))}
    </g>
  );
}
