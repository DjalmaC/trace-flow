"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { FlowConfig } from "../data/schema";
import type { FlowLayout } from "./layout";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint } from "./tokens";
import { CurrencyToken, displayCurrency } from "./FlowSvg/Tokens";
import { TraceArrow } from "./FlowSvg/TraceArrow";
import { FlowNodeShape } from "./FlowSvg/Nodes";

// Liquidity-hub renderer (archetype "hub"). Same visual vocabulary as the
// corridor — recessed tube channels, resting CurrencyToken pills, the Trace-mark
// chevron. Value moves: BRL relays in on the client side, stablecoin out on the
// counterparty side, and each pool participant streams a stablecoin quote up
// into the desk, which spins as it clears. Constant speed (14ms/px), calm. The
// PDF / reduced-motion path rests value instead, like the corridor does.

const HUB_R = 44;
const EASE = "cubic-bezier(.4,0,.2,1)";
const MS_PER_PX = 14;
const MIN_MS = 560;

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

  const leftEnd = rail.filter((n) => n.cx < hx).sort((a, b) => a.cx - b.cx)[0];
  const rightEnd = rail.filter((n) => n.cx > hx).sort((a, b) => b.cx - a.cx)[0];
  const railX0 = leftEnd ? leftEnd.cx : hx;
  const railX1 = rightEnd ? rightEnd.cx : hx;

  const poolMinX = Math.min(...pool.map((p) => p.x), hx - 40);
  const poolMaxX = Math.max(...pool.map((p) => p.x + p.w), hx + 40);
  const poolBottom = Math.max(...pool.map((p) => p.y + p.h), hy);

  const poolPathD = (p: { cx: number; y: number }) => `M${hx} ${hy + HUB_R} C ${hx} ${hy + HUB_R + 54}, ${p.cx} ${p.y - 54}, ${p.cx} ${p.y}`;

  // rail travel endpoints (client edge ↔ hub rim ↔ counterparty edge)
  const railLx0 = leftEnd ? leftEnd.x + leftEnd.w : hx - HUB_R - 120, railLx1 = hx - HUB_R;
  const railRx0 = hx + HUB_R, railRx1 = rightEnd ? rightEnd.x : hx + HUB_R + 120;

  // ── animation ──────────────────────────────────────────────────────────
  const tokenRefs = useRef<Record<string, SVGGElement | null>>({});
  const poolPaths = useRef<Record<string, SVGPathElement | null>>({});
  const markRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!moving) return;
    const durOf = (px: number) => Math.max(MIN_MS, px * MS_PER_PX);
    const railDur = durOf(Math.abs(railLx1 - railLx0));
    const railRDur = durOf(Math.abs(railRx1 - railRx0));
    const poolMeta = pool.map((p) => {
      const path = poolPaths.current[p.id];
      const len = path ? path.getTotalLength() : 200;
      return { id: p.id, path, len, dur: durOf(len) };
    });
    const inbound = config.direction === "collection"; // BRL client→hub, stablecoin hub→counterparty

    const place = (id: string, x: number, y: number, p: number) => {
      const el = tokenRefs.current[id];
      if (!el) return;
      let op = 1;
      if (p < 0.12) op = p / 0.12;
      else if (p > 0.88) op = (1 - p) / 0.12;
      const dHub = Math.hypot(x - hx, y - hy);
      if (dHub < HUB_R + 8) op = Math.min(op, Math.max(0, (dHub - 14) / (HUB_R - 6)));
      el.setAttribute("transform", `translate(${x.toFixed(1)},${y.toFixed(1)})`);
      el.style.opacity = Math.max(0, op).toFixed(3);
    };

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const e = Math.max(0, now - start);
      // rail-left: client ↔ hub
      {
        const p = (e / railDur) % 1;
        const t = inbound ? p : 1 - p;
        place("rail-left", railLx0 + (railLx1 - railLx0) * t, hy, p);
      }
      // rail-right: hub ↔ counterparty
      {
        const p = ((e / railRDur) + 0.5) % 1;
        const t = inbound ? p : 1 - p;
        place("rail-right", railRx0 + (railRx1 - railRx0) * t, hy, p);
      }
      // pool: each participant streams a quote up into the desk
      poolMeta.forEach((m, i) => {
        if (!m.path) return;
        const p = ((e / m.dur) + i * 0.24) % 1;
        const pt = m.path.getPointAtLength((1 - p) * m.len); // box → hub
        place(`pool-${m.id}`, pt.x, pt.y, p);
      });
      // desk spins as it clears — contract + 360° each cycle, then rest
      if (markRef.current) {
        const CYC = 2600, SPIN = 1000;
        const ph = e % CYC;
        if (ph < SPIN) {
          const s = ph / SPIN;
          markRef.current.setAttribute("transform", `rotate(${(360 * s).toFixed(1)}) scale(${(1 - 0.32 * Math.sin(s * Math.PI)).toFixed(3)})`);
        } else {
          markRef.current.setAttribute("transform", "rotate(0) scale(1)");
        }
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

      {/* value — travelling (live) or resting (PDF / reduced motion) */}
      {moving ? (
        <>
          <g ref={(el) => { tokenRefs.current["rail-left"] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
            <CurrencyToken currency="BRL" coin={config.stablecoin} accent={accent} />
          </g>
          <g ref={(el) => { tokenRefs.current["rail-right"] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
            <CurrencyToken currency={stable} coin={config.stablecoin} accent={accent} />
          </g>
          {pool.map((p) => (
            <g key={`mt-${p.id}`} ref={(el) => { tokenRefs.current[`pool-${p.id}`] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
              <CurrencyToken currency={stable} coin={config.stablecoin} accent={accent} />
            </g>
          ))}
        </>
      ) : (
        <>
          {leftEnd && (
            <g transform={`translate(${(leftEnd.cx + hx) / 2},${hy})`}>
              <CurrencyToken currency="BRL" coin={config.stablecoin} accent={accent} />
            </g>
          )}
          {rightEnd && (
            <g transform={`translate(${(rightEnd.cx + hx) / 2},${hy})`}>
              <CurrencyToken currency={stable} coin={config.stablecoin} accent={accent} />
            </g>
          )}
          {pool.map((p) => {
            const t = 0.4;
            return (
              <g key={`rt-${p.id}`} transform={`translate(${hx + (p.cx - hx) * t},${hy + HUB_R + (p.y - (hy + HUB_R)) * t})`}>
                <CurrencyToken currency={stable} coin={config.stablecoin} accent={accent} />
              </g>
            );
          })}
        </>
      )}

      {/* direction chevrons on the rail — the Trace mark-half, like the corridor */}
      {leftEnd && <TraceArrow cx={hx - HUB_R - 32} cy={hy} size={24} direction={config.direction} />}
      {rightEnd && <TraceArrow cx={hx + HUB_R + 32} cy={hy} size={24} direction={config.direction} />}

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
