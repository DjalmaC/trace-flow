"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Currency, FlowConfig } from "../data/schema";
import type { FlowLayout, NodeLayout } from "./layout";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint } from "./tokens";
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
const MS_PER_PX = 14;
const MIN_MS = 900;

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

  const railX0 = Math.min(...rail.map((n) => n.cx), hx);
  const railX1 = Math.max(...rail.map((n) => n.cx), hx);
  const poolMinX = Math.min(...pool.map((p) => p.x), hx - 40);
  const poolMaxX = Math.max(...pool.map((p) => p.x + p.w), hx + 40);
  const poolBottom = Math.max(...pool.map((p) => p.y + p.h), hy);

  const poolPathD = (p: { cx: number; y: number }) => `M${hx} ${hy + HUB_R} C ${hx} ${hy + HUB_R + 54}, ${p.cx} ${p.y - 54}, ${p.cx} ${p.y}`;

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
        return { c, len, dur: Math.max(MIN_MS, len * MS_PER_PX), at: (s: number) => (path ? path.getPointAtLength((1 - s) * len) : { x: hx, y: hy }) };
      }
      const left = c.cp.cx < hx;
      const e0 = { x: left ? c.cp.x + c.cp.w : c.cp.x, y: hy };
      const e1 = { x: left ? hx - HUB_R : hx + HUB_R, y: hy };
      const dist = Math.abs(e1.x - e0.x);
      return { c, len: dist, dur: Math.max(MIN_MS, dist * MS_PER_PX), at: (s: number) => ({ x: e0.x + (e1.x - e0.x) * s, y: hy }) };
    });

    const place = (id: string, pt: { x: number; y: number }, prog: number) => {
      const el = tokenRefs.current[id];
      if (!el) return;
      let op = 1;
      if (prog < 0.12) op = prog / 0.12;
      else if (prog > 0.88) op = (1 - prog) / 0.12;
      const dHub = Math.hypot(pt.x - hx, pt.y - hy);
      if (dHub < HUB_R + 8) op = Math.min(op, Math.max(0, (dHub - 14) / (HUB_R - 6)));
      el.setAttribute("transform", `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
      el.style.opacity = Math.max(0, op).toFixed(3);
    };

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const e = Math.max(0, now - start);
      for (const b of built) {
        const p = (e / b.dur) % 1; // toward the desk
        place(`${b.c.id}-a`, b.at(p), p);
        const q = ((e / b.dur) + 0.5) % 1; // back out (half a lap behind)
        place(`${b.c.id}-b`, b.at(1 - q), q);
      }
      if (markRef.current) {
        const CYC = 2600, SPIN = 1000;
        const ph = e % CYC;
        if (ph < SPIN) {
          const s = ph / SPIN;
          markRef.current.setAttribute("transform", `rotate(${(360 * s).toFixed(1)}) scale(${(1 - 0.3 * Math.sin(s * Math.PI)).toFixed(3)})`);
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
            <path ref={(el) => { poolPaths.current[p.id] = el; }} d={d} fill="none" stroke={tint} strokeWidth={30} strokeLinecap="round" style={{ transition: railTransition }} />
            <path d={d} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={1} style={{ transition: railTransition }} />
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
          <circle cx={hx} cy={hy} r={HUB_R + 8} fill="none" stroke={C.green} strokeOpacity={0.4} className={reduced ? undefined : "hub-halo"} />
          <circle cx={hx} cy={hy} r={HUB_R} fill="#0b110d" stroke={C.green} strokeOpacity={0.46} />
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
      {!reduced && <style>{`.hub-halo{transform-origin:${hx}px ${hy}px;animation:hubHalo 3.4s ease-in-out infinite}@keyframes hubHalo{0%,100%{opacity:.28}50%{opacity:.6}}`}</style>}
    </>
  );
}
