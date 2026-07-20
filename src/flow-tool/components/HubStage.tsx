"use client";
import { useReducedMotion } from "framer-motion";
import type { FlowConfig } from "../data/schema";
import type { FlowLayout, NodeLayout } from "./layout";
import { ASSETS, C, TRACE_LOGO_AR } from "./tokens";
import { displayCurrency } from "./FlowSvg/Tokens";
import { FlowNodeShape } from "./FlowSvg/Nodes";

// Liquidity-hub renderer (archetype "hub"). Draws what computeHubLayout laid
// out: a horizontal client-journey rail with the Trace desk (the spinning mark)
// at its centre, and a pool of liquidity participants below, each trading
// two-way with the desk (BRL one way, USDT/USDC back). Deliberately calm — no
// relay timeline yet; the quote→pick→net motion is a later decision.

const HUB_R = 44;

export function HubStage({ layout, config }: { layout: FlowLayout; config: FlowConfig }) {
  const reduced = useReducedMotion();
  const hub = layout.nodes.find((n) => n.onTrunk && n.kind === "trace");
  const rail = layout.nodes.filter((n) => n.onTrunk && n !== hub);
  const pool = layout.nodes.filter((n) => !n.onTrunk);
  const byId = new Map(layout.nodes.map((n) => [n.id, n] as const));

  const stable = displayCurrency("USDC/USDT", config);
  const brl = "BRL";
  const markH = HUB_R * 1.1;
  const markW = markH * TRACE_LOGO_AR;

  // A two-way conduit between a counterparty box and the hub. `sent` is the
  // currency the counterparty pushes toward the hub; the hub returns the other.
  function Conduit({ node, sent }: { node: NodeLayout; sent: string }) {
    const towardHubGreen = sent === brl;
    const cOut = towardHubGreen ? C.green : C.traceCyan; // counterparty -> hub
    const cBack = towardHubGreen ? C.traceCyan : C.green; // hub -> counterparty
    const lOut = towardHubGreen ? brl : stable;
    const lBack = towardHubGreen ? stable : brl;
    const onRail = node.onTrunk;
    // connection endpoints on box edge and hub rim
    let ax: number, ay: number, hx: number, hy: number;
    if (onRail) {
      const left = node.cx < (hub?.cx ?? 0);
      ax = left ? node.x + node.w : node.x;
      ay = node.cy;
      hx = (hub?.cx ?? 0) + (left ? -HUB_R : HUB_R);
      hy = hub?.cy ?? 0;
    } else {
      ax = node.cx;
      ay = node.y; // top edge
      const dx = node.cx - (hub?.cx ?? 0);
      hx = (hub?.cx ?? 0) + Math.max(-HUB_R * 0.7, Math.min(HUB_R * 0.7, dx * 0.25));
      hy = (hub?.cy ?? 0) + HUB_R;
    }
    // perpendicular offset so the two directions read as separate lanes
    const dx = hx - ax, dy = hy - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 6, oy = (dx / len) * 6;
    return (
      <g>
        <line x1={ax + ox} y1={ay + oy} x2={hx + ox} y2={hy + oy} stroke={cOut} strokeOpacity={0.6} strokeWidth={2} markerEnd={`url(#hub-${towardHubGreen ? "gr" : "cy"})`} />
        <line x1={hx - ox} y1={hy - oy} x2={ax - ox} y2={ay - oy} stroke={cBack} strokeOpacity={0.5} strokeWidth={2} markerEnd={`url(#hub-${towardHubGreen ? "cy" : "gr"})`} />
        {onRail && node.cx < (hub?.cx ?? 0) && (
          <g fontFamily="var(--font-inter), system-ui, sans-serif" fontWeight={600} textAnchor="middle">
            <rect x={(ax + hx) / 2 - 20} y={node.cy - 24} width={40} height={16} rx={8} fill="#12261b" stroke={C.green} strokeOpacity={0.5} />
            <text x={(ax + hx) / 2} y={node.cy - 12} fontSize={10.5} fill="#8fe6c2">{lOut}</text>
            <rect x={(ax + hx) / 2 - 30} y={node.cy + 8} width={60} height={16} rx={8} fill="#0e2422" stroke={C.traceCyan} strokeOpacity={0.5} />
            <text x={(ax + hx) / 2} y={node.cy + 20} fontSize={9} fill="#8fe6df">{lBack}</text>
          </g>
        )}
      </g>
    );
  }

  const poolMinX = Math.min(...pool.map((p) => p.x), (hub?.cx ?? 0) - 40);
  const poolMaxX = Math.max(...pool.map((p) => p.x + p.w), (hub?.cx ?? 0) + 40);
  const poolBottom = Math.max(...pool.map((p) => p.y + p.h), 0);

  return (
    <>
      <defs>
        <marker id="hub-gr" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.green} /></marker>
        <marker id="hub-cy" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={C.traceCyan} /></marker>
      </defs>

      {/* conduits (under the boxes) */}
      {layout.legs.map((l) => {
        const counterparty = byId.get(l.from) === hub ? byId.get(l.to) : byId.get(l.from);
        if (!counterparty || counterparty === hub) return null;
        return <Conduit key={l.index} node={counterparty} sent={l.carries} />;
      })}

      {/* pool grouping */}
      {pool.length > 0 && (
        <g fontFamily="var(--font-inter), system-ui, sans-serif">
          {/* backing so the fan conduits don't cut through the caption */}
          <rect x={(hub?.cx ?? 0) - 178} y={pool[0].y - 30} width={356} height={17} rx={4} fill="#08090b" />
          <text x={hub?.cx ?? 0} y={pool[0].y - 18} textAnchor="middle" fontSize={10.5} fill={C.muted} letterSpacing="0.18em">
            LIQUIDITY POOL · QUOTES, BUYS &amp; SELLS
          </text>
          <path d={`M${poolMinX - 14} ${poolBottom + 16} L${poolMinX - 14} ${poolBottom + 26} L${poolMaxX + 14} ${poolBottom + 26} L${poolMaxX + 14} ${poolBottom + 16}`} fill="none" stroke={C.hairline} />
        </g>
      )}

      {/* boxes (rail ends + pool participants) */}
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

      {/* the Trace desk — central spinning-mark hub */}
      {hub && (
        <g data-flow-node={hub.srcId ?? hub.id}>
          <circle cx={hub.cx} cy={hub.cy} r={HUB_R + 8} fill="none" stroke={C.green} strokeOpacity={0.4} className={reduced ? undefined : "hub-halo"} />
          <circle cx={hub.cx} cy={hub.cy} r={HUB_R} fill="#0b110d" stroke={C.green} strokeOpacity={0.46} />
          <image href={ASSETS.traceLogo} x={hub.cx - markW / 2} y={hub.cy - markH / 2} width={markW} height={markH} />
          {/* label sits ABOVE the desk — below it is the pool fan */}
          <text x={hub.cx} y={hub.cy - HUB_R - 12} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.title} fontFamily="var(--font-inter), system-ui, sans-serif">
            {hub.lines[0]}
          </text>
        </g>
      )}
      {!reduced && <style>{`.hub-halo{transform-origin:${hub?.cx ?? 0}px ${hub?.cy ?? 0}px;animation:hubHalo 3.4s ease-in-out infinite}@keyframes hubHalo{0%,100%{opacity:.28}50%{opacity:.6}}`}</style>}
    </>
  );
}
