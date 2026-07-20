"use client";
import { useReducedMotion } from "framer-motion";
import type { FlowConfig } from "../data/schema";
import type { FlowLayout } from "./layout";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint } from "./tokens";
import { CurrencyToken, displayCurrency } from "./FlowSvg/Tokens";
import { TraceArrow } from "./FlowSvg/TraceArrow";
import { FlowNodeShape } from "./FlowSvg/Nodes";

// Liquidity-hub renderer (archetype "hub"). Same visual vocabulary as the
// corridor: recessed tube channels (tubeTint + hairline spine), resting
// CurrencyToken pills, and the Trace-mark chevron for direction. The client
// journey is a horizontal rail through the Trace desk; the liquidity pool joins
// from below on tributary channels, exactly like a corridor's merging legs.
// Motion (the quote→pick→net relay) is deliberately deferred — this rests value
// like the reduced-motion corridor does.

const HUB_R = 44;
const EASE = "cubic-bezier(.4,0,.2,1)";

export function HubStage({ layout, config }: { layout: FlowLayout; config: FlowConfig }) {
  const reduced = useReducedMotion();
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
  const poolBottom = Math.max(...pool.map((p) => p.y + p.h), 0);
  const poolTop = pool.length ? Math.min(...pool.map((p) => p.y)) : hy;

  return (
    <>
      {/* pool tributary channels — the same recessed-channel material as the
          rail, curved up into the desk (behind everything). */}
      {pool.map((p) => {
        const d = `M${hx} ${hy + HUB_R} C ${hx} ${hy + HUB_R + 54}, ${p.cx} ${p.y - 54}, ${p.cx} ${p.y}`;
        return (
          <g key={`ch-${p.id}`}>
            <path d={d} fill="none" stroke={tint} strokeWidth={30} strokeLinecap="round" style={{ transition: railTransition }} />
            <path d={d} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={1} style={{ transition: railTransition }} />
          </g>
        );
      })}

      {/* client-journey rail — one recessed channel behind the boxes, the desk
          interrupts it (drawn on top). Ends tuck under the box centres. */}
      <rect x={railX0} y={hy - 15} width={Math.max(0, railX1 - railX0)} height={30} rx={15} fill={tint} stroke={accent} strokeOpacity={0.42} style={{ transition: railTransition }} />

      {/* value at rest — BRL entering on the client side, stablecoin on the
          counterparty side, stablecoin quoted up from each pool participant. */}
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
        const tx = hx + (p.cx - hx) * t;
        const ty = hy + HUB_R + (p.y - (hy + HUB_R)) * t;
        return (
          <g key={`tok-${p.id}`} transform={`translate(${tx},${ty})`}>
            <CurrencyToken currency={stable} coin={config.stablecoin} accent={accent} />
          </g>
        );
      })}

      {/* direction chevrons on the rail — the Trace mark-half, like the corridor */}
      {leftEnd && <TraceArrow cx={hx - HUB_R - 32} cy={hy} size={24} direction={config.direction} />}
      {rightEnd && <TraceArrow cx={hx + HUB_R + 32} cy={hy} size={24} direction={config.direction} />}

      {/* pool grouping label + bracket */}
      {pool.length > 0 && (
        <g fontFamily="var(--font-inter), system-ui, sans-serif">
          <rect x={hx - 180} y={poolTop - 32} width={360} height={17} rx={4} fill="#08090b" />
          <text x={hx} y={poolTop - 20} textAnchor="middle" fontSize={10.5} fill={C.muted} letterSpacing="0.18em">
            LIQUIDITY POOL · QUOTES, BUYS &amp; SELLS
          </text>
          <path d={`M${poolMinX - 14} ${poolBottom + 16} L${poolMinX - 14} ${poolBottom + 26} L${poolMaxX + 14} ${poolBottom + 26} L${poolMaxX + 14} ${poolBottom + 16}`} fill="none" stroke={C.hairline} />
        </g>
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

      {/* the Trace desk — the spinning-mark hub, drawn over the rail */}
      {hub && (
        <g data-flow-node={hub.srcId ?? hub.id}>
          <circle cx={hx} cy={hy} r={HUB_R + 8} fill="none" stroke={C.green} strokeOpacity={0.4} className={reduced ? undefined : "hub-halo"} />
          <circle cx={hx} cy={hy} r={HUB_R} fill="#0b110d" stroke={C.green} strokeOpacity={0.46} />
          <image href={ASSETS.traceLogo} x={hx - markW / 2} y={hy - markH / 2} width={markW} height={markH} />
          <text x={hx} y={hy - HUB_R - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.title} fontFamily="var(--font-inter), system-ui, sans-serif">
            {hub.lines[0]}
          </text>
        </g>
      )}
      {!reduced && <style>{`.hub-halo{transform-origin:${hx}px ${hy}px;animation:hubHalo 3.4s ease-in-out infinite}@keyframes hubHalo{0%,100%{opacity:.28}50%{opacity:.6}}`}</style>}
    </>
  );
}
