"use client";
import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Currency, FlowConfig } from "../data/schema";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint, GLASS_CARD } from "./tokens";
import { RAIL_IN, type FlowLayout, type NodeLayout } from "./layout";
import {
  CurrencyToken,
  FlowNodeShape,
  MachineryContainer,
  TraceArrow,
  displayCurrency,
  tokenWidth,
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

// "Account held within a bank" enclosure. The bank NAME sits above the wrapped
// box, its LOGO large below the box; the dotted frame wraps all three. Padding
// is computed per-enclosure from what it holds.
const BANK_PAD_X = 16;
const BANK_NAME_H = 24; // name zone above the box
const BANK_LOGO_H = 46; // logo drawn large, below the box
const BANK_LOGO_GAP = 12; // box bottom → logo top
const BANK_LOGO_PAD = 12; // logo → enclosure bottom
const BANK_PLAIN_PAD = 12; // enclosure padding on a side with nothing in it

/** Enclosure padding below a wrapped box: room for the logo when there is one. */
function bankPadBottom(bank?: { logoUrl?: string }): number {
  return bank?.logoUrl ? BANK_LOGO_GAP + BANK_LOGO_H + BANK_LOGO_PAD : BANK_PLAIN_PAD;
}

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
  // The relay travels the trunk only; tributary legs (a second payer merging
  // in) show a resting token instead — the same vocabulary as reduced motion.
  // Trunk legs are sequenced by GEOMETRY (left→right), not authoring order —
  // a tailored flow keeps its legs in the order the rep drew them, and a
  // chain drawn out of order would otherwise send the token backwards.
  const trunkLegs = layout.legs.filter((l) => !l.offTrunk).sort((a, b) => Math.min(a.x1, a.x2) - Math.min(b.x1, b.x2));
  const seq = reverse ? trunkLegs.slice().reverse() : trunkLegs;
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
  onPassComplete,
}: {
  layout: FlowLayout;
  config: FlowConfig;
  animate: boolean;
  showHeading?: boolean;
  /** Fires each time the relay finishes a full pass (used by the settlement
   *  toggle's idle auto-flip). Never fires when frozen (?frame QA hook). */
  onPassComplete?: () => void;
}) {
  const reduced = useReducedMotion();
  const run = animate && !reduced;
  // ref'd so the rAF effect doesn't restart the relay when the parent re-renders
  const passCbRef = useRef(onPassComplete);
  passCbRef.current = onPassComplete;
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
      if (l.convertsTo) s.add(displayCurrency(l.convertsTo, config));
    });
    return [...s];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.legs, config.direction, config.collected, config.delivered]);
  const timeline = useMemo(
    () => buildTimeline(layout, config, byId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, config.direction, config.collected, config.delivered, byId],
  );

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
      render(((freezeMs % total) + total) % total);
      return;
    }
    let raf = 0;
    let lastPass = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // rAF timestamps can precede the performance.now() captured above by a
      // frame — clamp, and only ever count passes FORWARD, or the first two
      // frames read as a whole spurious pass.
      const e = Math.max(0, now - start);
      const pass = Math.floor(e / total);
      if (pass > lastPass) {
        lastPass = pass;
        passCbRef.current?.();
      }
      render(e % total);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, timeline, railY, config.direction, currencies, hubs, railHubs, landings, nodes, freezeMs]);

  // The rail is drawn as one pipe SEGMENT per trunk gap, each end docking
  // RAIL_IN inside its glass housing (leg x1/x2 already carry the inset from
  // the layout). The boxes are translucent, so a continuous rail underneath
  // would show through — segments make the docking intentional. The moving
  // token is clipped to these segments so value visibly slides all the way
  // into (and out of) each housing before vanishing.
  const railSegs = layout.legs.filter((l) => !l.offTrunk && l.y1 === l.y2);
  const railTransition = reduced ? undefined : `fill .55s ${EASE}, stroke .55s ${EASE}`;

  // Static (PDF / reduced-motion) rail furniture. Each trunk gap — split at
  // its conversion hub when it has one — shares its visible pipe between the
  // direction arrow (36px at the source end, kept only when the pill still
  // fits beside it) and a resting currency pill centered in what remains,
  // shrunk to fit so nothing hides under the translucent boxes.
  const resting = useMemo(() => {
    const pills: { x: number; cur: Currency; k: number }[] = [];
    const arrowXs: number[] = [];
    if (run) return { pills, arrowXs };
    const fromLeft = config.direction === "collection";
    const ARROW = 36;
    for (const l of layout.legs) {
      if (l.offTrunk) continue;
      const g0 = Math.min(l.x1, l.x2) + RAIL_IN;
      const g1 = Math.max(l.x1, l.x2) - RAIL_IN;
      const regions = l.convertsTo
        ? [
            { cur: displayCurrency(l.carries, config), a: g0, b: Math.min(l.mid.x - HUB_R - 8, g1), arrow: fromLeft },
            { cur: displayCurrency(l.convertsTo, config), a: Math.max(l.mid.x + HUB_R + 8, g0), b: g1, arrow: !fromLeft },
          ]
        : [{ cur: displayCurrency(l.carries, config), a: g0, b: g1, arrow: true }];
      for (const r of regions) {
        let { a, b } = r;
        if (b - a < 26) continue; // e.g. a hubAtEngine leg has no after-hub gap
        if (r.arrow && b - a - ARROW >= 30) {
          arrowXs.push(fromLeft ? a + 22 : b - 22);
          if (fromLeft) a += ARROW;
          else b -= ARROW;
        }
        const k = Math.min(1, (b - a - 8) / tokenWidth(r.cur, config.stablecoin));
        pills.push({ x: (a + b) / 2, cur: r.cur, k });
      }
    }
    return { pills, arrowXs };
  }, [run, layout, config]);
  const markW = HUB_R;
  const markH = markW / TRACE_LOGO_AR;

  const platformOn = !!layout.platformFrame;
  // The client's name/logo are stripped from the boxes only when the CLIENT is
  // the provider; with Trace as provider the client stays a branded party.
  const clientSuppressed = platformOn && (config.platform?.provider ?? "client") === "client";
  const frame = layout.platformFrame;
  const traceProvider = config.platform?.provider === "trace";
  const frameColor = config.platform?.color?.trim() || (traceProvider ? C.green : config.brandColor) || C.green;
  const frameCaption =
    config.platform?.caption?.trim() ||
    (traceProvider
      ? "Powered by Trace Finance. We operate the rails beneath the flow."
      : `Native to the ${config.clientName} platform. Trace operates the rails underneath.`);

  return (
    <g>
      {/* ── technology-provider framing: the client's platform encloses the
          whole flow — a quiet brand-colored boundary with their logo chip on
          the top edge and a caption beneath. The client never appears INSIDE
          the flow in this mode. ── */}
      {frame && (
        <g>
          <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={18} fill={frameColor} fillOpacity={0.028} stroke={frameColor} strokeOpacity={0.4} strokeWidth={1.2} />
          {(() => {
            const hasLogo = !traceProvider && !!config.clientLogoUrl;
            const chipW = traceProvider ? 158 : hasLogo ? 148 : Math.max(96, config.clientName.length * 8.5 + 36);
            const chipH = 30;
            const chipX = frame.x + 22;
            const chipY = frame.y - chipH / 2;
            const markH = 16, markW = markH * TRACE_LOGO_AR;
            return (
              <g>
                <rect x={chipX - 10} y={chipY - 3} width={chipW + 20} height={chipH + 6} rx={11} fill={C.base} />
                <rect x={chipX} y={chipY} width={chipW} height={chipH} rx={9} fill="#0c1210" stroke={frameColor} strokeOpacity={0.55} />
                {traceProvider ? (
                  <g>
                    <image href={ASSETS.traceLogo} x={chipX + 12} y={chipY + (chipH - markH) / 2} width={markW} height={markH} preserveAspectRatio="xMidYMid meet" />
                    <text x={chipX + 12 + markW + 8} y={chipY + 19.5} fontSize={12.5} fontWeight={600} fill="#e6ebe8">
                      Trace Finance
                    </text>
                  </g>
                ) : hasLogo ? (
                  config.clientLogoPlate === "light" ? (
                    <g>
                      <rect x={chipX + 5} y={chipY + 5} width={chipW - 10} height={chipH - 10} rx={5} fill="#ffffff" />
                      <image href={config.clientLogoUrl} x={chipX + 12} y={chipY + 7} width={chipW - 24} height={chipH - 14} preserveAspectRatio="xMidYMid meet" />
                    </g>
                  ) : (
                    <image href={config.clientLogoUrl} x={chipX + 10} y={chipY + 6} width={chipW - 20} height={chipH - 12} preserveAspectRatio="xMidYMid meet" />
                  )
                ) : (
                  <text x={chipX + chipW / 2} y={chipY + 19.5} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#e6ebe8">
                    {config.clientName}
                  </text>
                )}
              </g>
            );
          })()}
          <text x={frame.x + frame.w / 2} y={frame.y + frame.h + 26} textAnchor="middle" fontSize={12} fill={C.muted} data-platform-caption>
            {frameCaption}
          </text>
        </g>
      )}
      <MachineryContainer layout={layout} showHeading={showHeading} />

      {/* tributary conduits — a second origin merging into the rail. The same
          recessed-channel material as the rail, drawn as a curve: a soft wide
          channel plus a hairline spine. Behind everything, like the rail. */}
      {layout.legs
        .filter((l) => l.offTrunk)
        .map((l) => (
          <g key={`trib-${l.index}`}>
            <path d={l.dShow ?? l.d} fill="none" stroke={tubeTint(config.direction)} strokeWidth={30} strokeLinecap={l.dShow ? "butt" : "round"} style={{ transition: railTransition }} />
            <path d={l.dShow ?? l.d} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={1} style={{ transition: railTransition }} />
          </g>
        ))}

      {/* rail pipe segments — one per trunk gap. The VISIBLE pipe spans only
          box edge to box edge (the docked ends exist for the token's travel
          but stay invisible under the translucent glass). */}
      {railSegs.map((l) => (
        <rect
          key={`rail-${l.index}`}
          x={Math.min(l.x1, l.x2) + RAIL_IN}
          y={railY - 15}
          width={Math.max(0, Math.abs(l.x2 - l.x1) - RAIL_IN * 2)}
          height={30}
          rx={0}
          fill={tubeTint(config.direction)}
          stroke={accent}
          strokeOpacity={0.42}
          style={{ transition: railTransition }}
        />
      ))}

      {/* the relay token, clipped to the pipes: it slides fully into a glass
          housing and vanishes at the pipe's end, then re-emerges from the next */}
      <clipPath id="tf-rail-clip">
        {railSegs.map((l) => (
          <rect key={`rc-${l.index}`} x={Math.min(l.x1, l.x2)} y={railY - 17} width={Math.abs(l.x2 - l.x1)} height={34} rx={15} />
        ))}
      </clipPath>
      {run ? (
        <g clipPath="url(#tf-rail-clip)">
        <g ref={tokenRef} transform={`translate(${timeline.startX},${railY})`} style={{ willChange: "transform, opacity" }}>
          {currencies.map((c) => (
            <g key={c} ref={(el) => { curRefs.current[c] = el; }} style={{ opacity: 0 }}>
              <CurrencyToken currency={c} coin={config.stablecoin} accent={accent} />
            </g>
          ))}
        </g>
        </g>
      ) : (
        // Resting value (PDF / reduced motion): EVERY leg names what it
        // carries — a converting leg shows its input before the hub and its
        // output after it, so the swap reads left to right without the
        // animation. Placement is precomputed (`resting`) so each pill centers
        // in the visible pipe, shrinks to fit a narrow gap, and shares the gap
        // with the direction arrow instead of colliding with it.
        <>
          {resting.pills.map((sp, i) => (
            <g key={`rest-${i}`} transform={`translate(${sp.x},${railY}) scale(${sp.k.toFixed(3)})`}>
              <CurrencyToken currency={sp.cur} coin={config.stablecoin} />
            </g>
          ))}
          {layout.legs
            .filter((l) => l.offTrunk && !l.convertsTo)
            .map((l) => (
              <g key={`rest-trib-${l.index}`} transform={`translate(${l.mid.x},${l.mid.y})`}>
                <CurrencyToken currency={displayCurrency(l.carries, config)} coin={config.stablecoin} />
              </g>
            ))}
        </>
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

      {/* "account held within a bank" enclosures — a dotted container drawn
          BEHIND the box it wraps (after the rail, so the rail reads as crossing
          into the bank). Opt-in per box via config.nodeBank. */}
      {nodes.map((node) => {
        if (node.kind === "engine") return null;
        const bank = config.nodeBank?.[`${config.flowId}:${node.srcId ?? node.id}`];
        if (!bank || (!bank.label?.trim() && !bank.logoUrl)) return null;
        return <BankEnclosure key={`bank-${node.id}`} node={node} bank={bank} />;
      })}

      {/* station boxes — cover the rail's ends + the resting token.
          data-flow-node lets the build page offer double-click renaming. */}
      {nodes.map((node) => {
        // Opt-in entity annotation, shown in parentheses just below the box
        // (e.g. "(Brazilian VASP)"). Keyed like nodeLabels, on the content id.
        const entity =
          node.kind === "engine" ? undefined : config.nodeEntities?.[`${config.flowId}:${node.srcId ?? node.id}`]?.trim();
        // A bank enclosure extends below the box (its logo); drop the entity
        // line below the whole enclosure so the two don't collide.
        const bank = node.kind === "engine" ? undefined : config.nodeBank?.[`${config.flowId}:${node.srcId ?? node.id}`];
        const entityY = node.y + node.h + (bank ? bankPadBottom(bank) + 15 : 14);
        return (
          <g key={node.id} data-flow-node={node.kind === "engine" ? undefined : node.srcId ?? node.id}>
            <FlowNodeShape
              node={node}
              isPrimaryClient={node.id === layout.primaryClientId}
              clientName={clientSuppressed ? undefined : config.clientName}
              clientLogoUrl={clientSuppressed ? undefined : config.clientLogoUrl}
              clientLogoPlate={config.clientLogoPlate}
              partnerLogoUrl={config.partnerLogoUrl}
              partnerLogoPlate={config.partnerLogoPlate}
            />
            {entity && (
              <text x={node.x + node.w / 2} y={entityY} textAnchor="middle" fontSize={11} fill={C.subtitle}>
                ({entity})
              </text>
            )}
          </g>
        );
      })}

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
          <circle cx={hb.x} cy={hb.y} r={HUB_R} fill="#0b110d" stroke={GLASS_CARD.hairline} strokeWidth={1.2} />
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
          resting tributary token already tells that conduit's story. Static
          mode draws only the arrows the resting pills left room for. */}
      {run
        ? layout.legs
            .filter((l) => !l.offTrunk)
            .map((l) => (
              <TraceArrow
                key={l.index}
                cx={config.direction === "collection" ? Math.min(l.x1, l.x2) + RAIL_IN + 22 : Math.max(l.x1, l.x2) - RAIL_IN - 22}
                cy={railY}
                size={22}
                direction={config.direction}
              />
            ))
        : resting.arrowXs.map((x, i) => (
            <TraceArrow key={`ra-${i}`} cx={x} cy={railY} size={22} direction={config.direction} />
          ))}
      {/* branch lanes get the same arrows on their straight segments, so a
          branch reads with an explicit direction too */}
      {layout.legs
        .filter((l) => l.offTrunk && l.y1 === l.y2)
        .map((l) => (
          <TraceArrow
            key={`ba-${l.index}`}
            cx={config.direction === "collection" ? Math.min(l.x1, l.x2) + RAIL_IN + 22 : Math.max(l.x1, l.x2) - RAIL_IN - 22}
            cy={l.y1}
            size={22}
            direction={config.direction}
          />
        ))}
    </g>
  );
}

// A dotted container marking that a box is an account held WITHIN a bank. The
// wrapped box keeps its own label (the account holder, e.g. "Pix Inc NRA"); the
// bank's NAME sits just above the box and its LOGO large below it, the dotted
// frame wrapping all three ("[Bank name] / ( account holder ) / [logo]"). Drawn
// behind the box (see the enclosure pass in MachineryStage) so the rail crosses
// into it. Used on the web canvas, the client link and — via animate={false} —
// the downloaded PDF, where an uploaded logo is already a data URI and renders
// straight through the rasteriser. The logo's background is cut at upload time
// (build page), so it usually needs no backing plate.
function BankEnclosure({
  node,
  bank,
}: {
  node: NodeLayout;
  bank: { label?: string; logoUrl?: string; logoPlate?: "light" | "none" };
}) {
  const label = bank.label?.trim() ?? "";
  const hasLogo = !!bank.logoUrl;
  const light = bank.logoPlate === "light";
  const cx = node.x + node.w / 2;

  const padTop = label ? BANK_NAME_H : BANK_PLAIN_PAD;
  const padBottom = bankPadBottom(bank);
  const encX = node.x - BANK_PAD_X;
  const encY = node.y - padTop;
  const encW = node.w + BANK_PAD_X * 2;
  const encH = node.h + padTop + padBottom;

  // name shrinks to stay inside the enclosure interior on long bank names
  const nameSize = Math.min(13, Math.max(10, (encW - 24) / Math.max(1, label.length * 0.6)));
  const nameBaseline = node.y - 9; // just above the box top

  // logo below the box — large, spanning most of the enclosure width
  const logoW = Math.min(encW - 16, 180);
  const logoTop = node.y + node.h + BANK_LOGO_GAP;

  return (
    <g>
      <rect
        x={encX}
        y={encY}
        width={encW}
        height={encH}
        rx={16}
        fill="none"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth={2}
        strokeDasharray="0.1 8"
        strokeLinecap="round"
      />
      {label && (
        <text x={cx} y={nameBaseline} textAnchor="middle" fontSize={nameSize} fontWeight={700} fill="#eef1ee" letterSpacing={0.2}>
          {label}
        </text>
      )}
      {hasLogo &&
        (light ? (
          <>
            {/* a dark logo we couldn't cut to a light mark → white backing plate */}
            <rect x={cx - logoW / 2} y={logoTop - 4} width={logoW} height={BANK_LOGO_H + 8} rx={8} fill="#ffffff" />
            <image href={bank.logoUrl} x={cx - logoW / 2 + 8} y={logoTop} width={logoW - 16} height={BANK_LOGO_H} preserveAspectRatio="xMidYMid meet" />
          </>
        ) : (
          // background already cut → sits straight on the deck, no plate
          <image href={bank.logoUrl} x={cx - logoW / 2} y={logoTop} width={logoW} height={BANK_LOGO_H} preserveAspectRatio="xMidYMid meet" />
        ))}
    </g>
  );
}
