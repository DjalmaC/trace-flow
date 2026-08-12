"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Currency, FlowConfig } from "../data/schema";
import { RAIL_IN, type FlowLayout, type NodeLayout } from "./layout";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint, GLASS_CARD } from "./tokens";
import { CurrencyToken, displayCurrency } from "./FlowSvg/Tokens";
import { FlowNodeShape } from "./FlowSvg/Nodes";

// Liquidity-hub renderer (archetype "hub"). Same vocabulary as the corridor —
// recessed tube channels and CurrencyToken pills. Every conduit is a two-way
// exchange: a BRL token and a USDC/USDT token travel it in opposite directions
// at a uniform pace, so each counterparty (client, inbound clients, and every
// LP) is visibly buying AND selling with the desk, which spins as it clears.
// The PDF / reduced-motion path rests value instead, like the corridor.

const HUB_R = 44;
const EASE = "cubic-bezier(.4,0,.2,1)";

export function HubStage({ layout, config, animate = true }: { layout: FlowLayout; config: FlowConfig; animate?: boolean }) {
  const reduced = useReducedMotion();
  const moving = animate && !reduced;

  const hub = layout.nodes.find((n) => n.onTrunk && n.kind === "trace");
  const rail = layout.nodes.filter((n) => n.onTrunk && n !== hub);
  const pool = layout.nodes.filter((n) => !n.onTrunk);

  const accent = accentFor(config.direction);
  const tint = tubeTint(config.direction);
  const stable = displayCurrency("USDC/USDT", config);
  const markH = HUB_R * 1.05, markW = markH * TRACE_LOGO_AR;
  const hx = hub?.cx ?? 470, hy = hub?.cy ?? 224;
  const railTransition = reduced ? undefined : `fill .55s ${EASE}, stroke .55s ${EASE}`;

  // The VISIBLE rail spans box edge to box edge; token travel docks RAIL_IN
  // inside the translucent housings (see e0 below) without the pipe showing.
  const railX0 = Math.min(...rail.map((n) => n.x + n.w), hx);
  const railX1 = Math.max(...rail.map((n) => n.x), hx);
  const poolMinX = Math.min(...pool.map((p) => p.x), hx - 40);
  const poolMaxX = Math.max(...pool.map((p) => p.x + p.w), hx + 40);
  const poolBottom = Math.max(...pool.map((p) => p.y + p.h), hy);

  // visible pipe stops at the box top; the travel path (invisible) docks inside
  const poolPathD = (p: { cx: number; y: number }, dock = 0) => `M${hx} ${hy + HUB_R} C ${hx} ${hy + HUB_R + 54}, ${p.cx} ${p.y - 54}, ${p.cx} ${p.y + dock}`;

  // One conduit per leg: the counterparty sends `carries` toward the desk and
  // receives the other currency back.
  const byId = new Map(layout.nodes.map((n) => [n.id, n] as const));
  const conduits = layout.legs
    .map((l) => {
      const cp = byId.get(l.from === hub?.id ? l.to : l.from);
      if (!cp || cp.id === hub?.id) return null;
      const towardBRL = l.carries === "BRL";
      return { id: cp.id, cp, isPool: cp.onTrunk === false, toward: (towardBRL ? "BRL" : stable) as Currency, back: (towardBRL ? stable : "BRL") as Currency };
    })
    .filter((c): c is { id: string; cp: NodeLayout; isPool: boolean; toward: Currency; back: Currency } => !!c);

  // ── animation ──────────────────────────────────────────────────────────
  const tokenRefs = useRef<Record<string, SVGGElement | null>>({});
  const poolPaths = useRef<Record<string, SVGPathElement | null>>({});
  const markRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!moving) return;
    // a position function s∈[0,1] (0 = counterparty edge, 1 = the desk rim)
    const built = conduits.map((c) => {
      if (c.isPool) {
        const path = poolPaths.current[c.id];
        const len = path ? path.getTotalLength() : 220;
        return { c, at: (s: number) => (path ? path.getPointAtLength((1 - s) * len) : { x: hx, y: hy }) };
      }
      const left = c.cp.cx < hx;
      // travel starts INSIDE the glass housing (the pipe docks RAIL_IN deep)
      const e0 = { x: left ? c.cp.x + c.cp.w - RAIL_IN : c.cp.x + RAIL_IN, y: hy };
      const e1 = { x: left ? hx - HUB_R : hx + HUB_R, y: hy };
      return { c, at: (s: number) => ({ x: e0.x + (e1.x - e0.x) * s, y: hy }) };
    });

    // fade a token out as it nears the desk (absorbed) — combined with the
    // in/out fades so the swap at the hub is masked.
    const fade = (pt: { x: number; y: number }, base: number) => {
      const dHub = Math.hypot(pt.x - hx, pt.y - hy);
      return dHub < HUB_R + 12 ? Math.min(base, Math.max(0, (dHub - 12) / (HUB_R - 2))) : base;
    };
    const place = (id: string, pt: { x: number; y: number } | null, op: number) => {
      const el = tokenRefs.current[id];
      if (!el) return;
      if (pt) el.setAttribute("transform", `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
      el.style.opacity = Math.max(0, op).toFixed(3);
    };
    const smooth = (x: number) => x * x * (3 - 2 * x);

    // One orchestrated cycle: everything gathers into the desk together, the
    // desk spins, then everything disburses together.
    const T = 3400, GATHER = 0.36, SPIN = 0.6;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const m = (Math.max(0, now - start) % T) / T;
      for (const b of built) {
        if (m < GATHER) {
          const gp = m / GATHER; // box → desk, arriving together at m=GATHER
          const pt = b.at(smooth(gp));
          place(`${b.c.id}-a`, pt, fade(pt, gp < 0.16 ? gp / 0.16 : 1));
          place(`${b.c.id}-b`, null, 0);
        } else if (m < SPIN) {
          place(`${b.c.id}-a`, null, 0); // absorbed — the desk is converting
          place(`${b.c.id}-b`, null, 0);
        } else {
          const dp = (m - SPIN) / (1 - SPIN); // desk → box, all leaving together
          const pt = b.at(1 - smooth(dp));
          place(`${b.c.id}-b`, pt, fade(pt, dp > 0.84 ? (1 - dp) / 0.16 : 1));
          place(`${b.c.id}-a`, null, 0);
        }
      }
      if (markRef.current) {
        if (m >= GATHER && m < SPIN) {
          const s = (m - GATHER) / (SPIN - GATHER);
          markRef.current.setAttribute("transform", `rotate(${(360 * s).toFixed(1)}) scale(${(1 - 0.34 * Math.sin(s * Math.PI)).toFixed(3)})`);
        } else markRef.current.setAttribute("transform", "rotate(0) scale(1)");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, config.direction, config.stablecoin, layout]);

  return (
    <>
      {/* pool tributary channels — recessed material, curved up into the desk */}
      {pool.map((p) => {
        const d = poolPathD(p);
        return (
          <g key={`ch-${p.id}`}>
            <path d={d} fill="none" stroke={tint} strokeWidth={30} strokeLinecap="butt" style={{ transition: railTransition }} />
            <path d={d} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={1} style={{ transition: railTransition }} />
            {/* invisible docked path — carries the token travel into the housing */}
            <path ref={(el) => { poolPaths.current[p.id] = el; }} d={poolPathD(p, 14)} fill="none" stroke="none" />
          </g>
        );
      })}

      {/* client-journey rail — one recessed channel; the desk interrupts it */}
      <rect x={railX0} y={hy - 15} width={Math.max(0, railX1 - railX0)} height={30} rx={15} fill={tint} stroke={accent} strokeOpacity={0.42} style={{ transition: railTransition }} />

      {/* value — two-way live exchange, or resting (PDF / reduced motion) */}
      {moving ? (
        conduits.map((c) => (
          <g key={`mt-${c.id}`}>
            <g ref={(el) => { tokenRefs.current[`${c.id}-a`] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
              <CurrencyToken currency={c.toward} coin={config.stablecoin} accent={accent} />
            </g>
            <g ref={(el) => { tokenRefs.current[`${c.id}-b`] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
              <CurrencyToken currency={c.back} coin={config.stablecoin} accent={accent} />
            </g>
          </g>
        ))
      ) : (
        conduits.map((c) => {
          const p = c.isPool ? undefined : c.cp;
          const at = c.isPool ? { x: hx + (c.cp.cx - hx) * 0.42, y: hy + HUB_R + (c.cp.y - (hy + HUB_R)) * 0.42 } : { x: (c.cp.cx + hx) / 2, y: hy };
          void p;
          return (
            <g key={`rt-${c.id}`} transform={`translate(${at.x},${at.y})`}>
              <CurrencyToken currency={c.toward} coin={config.stablecoin} accent={accent} />
            </g>
          );
        })
      )}

      {/* station boxes — rail ends + pool participants */}
      {[...rail, ...pool].map((node) => {
        const entity = config.nodeEntities?.[`${config.flowId}:${node.srcId ?? node.id}`]?.trim();
        return (
          <g key={node.id} data-flow-node={node.srcId ?? node.id}>
            <FlowNodeShape node={node} isPrimaryClient={node.id === layout.primaryClientId} clientName={config.clientName} clientLogoUrl={config.clientLogoUrl} clientLogoPlate={config.clientLogoPlate} />
            {entity && (
              <text x={node.cx} y={node.y + node.h + 14} textAnchor="middle" fontSize={11} fill={C.subtitle} fontFamily="var(--font-inter), system-ui, sans-serif">
                ({entity})
              </text>
            )}
          </g>
        );
      })}

      {/* pool grouping — a bracket under the boxes, its caption beneath that */}
      {pool.length > 0 && (
        <g fontFamily="var(--font-inter), system-ui, sans-serif">
          <path d={`M${poolMinX - 14} ${poolBottom + 24} L${poolMinX - 14} ${poolBottom + 14} L${poolMaxX + 14} ${poolBottom + 14} L${poolMaxX + 14} ${poolBottom + 24}`} fill="none" stroke={C.hairline} />
          <text x={hx} y={poolBottom + 44} textAnchor="middle" fontSize={10.5} fill={C.muted} letterSpacing="0.18em">
            LIQUIDITY POOL · QUOTES, BUYS &amp; SELLS
          </text>
        </g>
      )}

      {/* the Trace desk — the spinning-mark hub, drawn over the rail */}
      {hub && (
        <g data-flow-node={hub.srcId ?? hub.id}>
          {/* quiet desk ring — no mint halo; the spinning mark carries identity */}
          <circle cx={hx} cy={hy} r={HUB_R} fill="#0b110d" stroke={GLASS_CARD.hairline} strokeWidth={1.2} />
          <g transform={`translate(${hx},${hy})`}>
            <g ref={markRef}>
              <image href={ASSETS.traceLogo} x={-markW / 2} y={-markH / 2} width={markW} height={markH} />
            </g>
          </g>
          <text x={hx} y={hy - HUB_R - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.title} fontFamily="var(--font-inter), system-ui, sans-serif">
            {hub.lines[0]}
          </text>
        </g>
      )}
    </>
  );
}
