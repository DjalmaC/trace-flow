"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Currency, FlowConfig } from "../data/schema";
import type { FlowLayout, NodeLayout } from "./layout";
import { NETTING_HUB_R } from "./layout";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint, GLASS_CARD } from "./tokens";
import { CurrencyToken, displayCurrency } from "./FlowSvg/Tokens";
import { FlowNodeShape } from "./FlowSvg/Nodes";
import { MachineryContainer } from "./FlowSvg";

// Treasury-netting renderer (archetype "netting"). Same vocabulary as the
// corridor — recessed tube conduits, CurrencyToken pills, the dashed
// Brazil | Abroad divider — but each side is a closed loop in its own currency:
// BRL circulates on the Brazil side, USD on the Abroad side, and the desk in
// the middle nets one leg against the other. The whole story is that NO token
// ever crosses the divider. Each side carries its own accent (the two arrows of
// the mark): the pay-in side in the direction accent, the other side in its
// counterpart, swapping with the Pay-in / Pay-out toggle.
// One orchestrated cycle: both pay-ins gather into the desk together, the desk
// spins as it offsets, then both deliveries leave together — the BRL that came
// in from one client goes out to the other, and vice versa.
// The PDF / reduced-motion path rests value on each conduit instead.

const R = NETTING_HUB_R;
const EASE = "cubic-bezier(.4,0,.2,1)";

export function NettingStage({
  layout,
  config,
  animate = true,
  showHeading = true,
}: {
  layout: FlowLayout;
  config: FlowConfig;
  animate?: boolean;
  showHeading?: boolean;
}) {
  const reduced = useReducedMotion();
  const moving = animate && !reduced;

  const desk = layout.nodes.find((n) => n.kind === "trace");
  const corners = layout.nodes.filter((n) => n !== desk);
  const hx = desk?.cx ?? 470;
  const hy = desk?.cy ?? 372;
  const byId = new Map(layout.nodes.map((n) => [n.id, n] as const));

  // side accents: the pay-in direction owns its accent, the opposite side the
  // counterpart — so the toggle swaps the two, echoing the mark's two arrows
  const other = config.direction === "collection" ? "disbursement" : "collection";
  const accentOf = (left: boolean) => (left ? accentFor(config.direction) : accentFor(other));
  const tintOf = (left: boolean) => (left ? tubeTint(config.direction) : tubeTint(other));
  const railTransition = reduced ? undefined : `fill .55s ${EASE}, stroke .55s ${EASE}`;

  // conduits, keyed by leg index: inbound run corner→desk, outbound desk→corner
  const conduits = layout.legs.map((l) => {
    const inbound = l.to === desk?.id;
    const corner = byId.get(inbound ? l.from : l.to)!;
    const left = corner.cx < hx;
    return { leg: l, inbound, corner, left, cur: displayCurrency(l.carries, config) as Currency };
  });

  // ── animation ────────────────────────────────────────────────────────────
  const tokenRefs = useRef<Record<number, SVGGElement | null>>({});
  const pathRefs = useRef<Record<number, SVGPathElement | null>>({});
  const markRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    if (!moving) return;
    const built = conduits.map((c) => {
      const path = pathRefs.current[c.leg.index];
      const len = path ? path.getTotalLength() : 320;
      // s∈[0,1]: 0 = the corner edge, 1 = the desk port (both leg directions)
      const at = (s: number) => {
        if (!path) return { x: hx, y: hy };
        return path.getPointAtLength((c.inbound ? s : 1 - s) * len);
      };
      return { c, at };
    });
    const fade = (pt: { x: number; y: number }, base: number) => {
      const dHub = Math.hypot(pt.x - hx, pt.y - hy);
      return dHub < R + 12 ? Math.min(base, Math.max(0, (dHub - 12) / (R - 2))) : base;
    };
    const place = (idx: number, pt: { x: number; y: number } | null, op: number) => {
      const el = tokenRefs.current[idx];
      if (!el) return;
      if (pt) el.setAttribute("transform", `translate(${pt.x.toFixed(1)},${pt.y.toFixed(1)})`);
      el.style.opacity = Math.max(0, op).toFixed(3);
    };
    const smooth = (x: number) => x * x * (3 - 2 * x);

    // gather → offset (the desk nets) → disburse, everything in step
    const T = 3600, GATHER = 0.36, OFFSET = 0.6;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const m = (Math.max(0, now - start) % T) / T;
      for (const b of built) {
        if (b.c.inbound) {
          if (m < GATHER) {
            const gp = m / GATHER;
            const pt = b.at(smooth(gp));
            place(b.c.leg.index, pt, fade(pt, gp < 0.16 ? gp / 0.16 : 1));
          } else place(b.c.leg.index, null, 0);
        } else {
          if (m >= OFFSET) {
            const dp = (m - OFFSET) / (1 - OFFSET);
            const pt = b.at(1 - smooth(dp));
            place(b.c.leg.index, pt, fade(pt, dp > 0.84 ? (1 - dp) / 0.16 : 1));
          } else place(b.c.leg.index, null, 0);
        }
      }
      if (markRef.current) {
        if (m >= GATHER && m < OFFSET) {
          const s = (m - GATHER) / (OFFSET - GATHER);
          markRef.current.setAttribute("transform", `rotate(${(360 * s).toFixed(1)}) scale(${(1 - 0.34 * Math.sin(s * Math.PI)).toFixed(3)})`);
        } else markRef.current.setAttribute("transform", "rotate(0) scale(1)");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, config.direction, config.collected, config.delivered, layout]);

  // role captions under the corners, derived from the legs themselves
  const roleOf = (n: NodeLayout) => {
    const c = conduits.find((cd) => cd.corner.id === n.id);
    if (!c) return null;
    return `${c.inbound ? "Pays" : "Receives"} ${c.cur}`;
  };

  return (
    <>
      <MachineryContainer layout={layout} showHeading={showHeading} />

      {/* conduits — recessed loop channels, each side tinted by its accent */}
      {conduits.map((c) => (
        <g key={`ch-${c.leg.index}`}>
          <path
            d={c.leg.dShow ?? c.leg.d} fill="none" stroke={tintOf(c.left)} strokeWidth={30} strokeLinecap="butt"
            style={{ transition: railTransition }}
          />
          <path d={c.leg.dShow ?? c.leg.d} fill="none" stroke={accentOf(c.left)} strokeOpacity={0.3} strokeWidth={1} style={{ transition: railTransition }} />
          {/* invisible docked path — carries the token travel into the housing */}
          <path ref={(el) => { pathRefs.current[c.leg.index] = el; }} d={c.leg.d} fill="none" stroke="none" />
        </g>
      ))}

      {/* value — the netting cycle, or resting on each conduit (PDF / reduced) */}
      {moving ? (
        conduits.map((c) => (
          <g key={`mt-${c.leg.index}`} ref={(el) => { tokenRefs.current[c.leg.index] = el; }} style={{ opacity: 0, willChange: "transform, opacity" }}>
            <CurrencyToken currency={c.cur} coin={config.stablecoin} accent={accentOf(c.left)} />
          </g>
        ))
      ) : (
        conduits.map((c) => (
          <g key={`rt-${c.leg.index}`} transform={`translate(${c.leg.mid.x},${c.leg.mid.y})`}>
            <CurrencyToken currency={c.cur} coin={config.stablecoin} accent={accentOf(c.left)} />
          </g>
        ))
      )}

      {/* corner stations + their roles */}
      {corners.map((node) => {
        const entity = config.nodeEntities?.[`${config.flowId}:${node.srcId ?? node.id}`]?.trim();
        const role = roleOf(node);
        return (
          <g key={node.id} data-flow-node={node.srcId ?? node.id}>
            <FlowNodeShape node={node} isPrimaryClient={node.id === layout.primaryClientId} clientName={config.clientName} clientLogoUrl={config.clientLogoUrl} clientLogoPlate={config.clientLogoPlate} partnerLogoUrl={config.partnerLogoUrl} partnerLogoPlate={config.partnerLogoPlate} bankLogoUrl={config.bankLogoUrl} bankLogoPlate={config.bankLogoPlate} />
            {role && (
              <text x={node.cx} y={node.y + node.h + 16} textAnchor="middle" fontSize={9.5} fill={C.muted} letterSpacing="0.16em" fontFamily="var(--font-inter), system-ui, sans-serif">
                {role.toUpperCase()}
              </text>
            )}
            {entity && (
              <text x={node.cx} y={node.y + node.h + (role ? 30 : 16)} textAnchor="middle" fontSize={11} fill={C.subtitle} fontFamily="var(--font-inter), system-ui, sans-serif">
                ({entity})
              </text>
            )}
          </g>
        );
      })}

      {/* the treasury desk — the offsetting mark, sat ON the border */}
      {desk && (
        <g data-flow-node={desk.srcId ?? desk.id} fontFamily="var(--font-inter), system-ui, sans-serif">
          {/* quiet desk ring — no mint halo; the spinning mark carries identity */}
          <circle cx={hx} cy={hy} r={R} fill="#0b110d" stroke={GLASS_CARD.hairline} strokeWidth={1.2} />
          <g transform={`translate(${hx},${hy})`}>
            <g ref={markRef}>
              <image href={ASSETS.traceLogo} x={-(R * 1.05 * TRACE_LOGO_AR) / 2} y={-(R * 1.05) / 2} width={R * 1.05 * TRACE_LOGO_AR} height={R * 1.05} />
            </g>
          </g>
          {/* label + caption sit on the divider — back them with the page base */}
          {(() => {
            const lw = desk.lines[0].length * 7.4 + 24;
            return <rect x={hx - lw / 2} y={hy - R - 24} width={lw} height={18} fill={C.base} opacity={0.92} />;
          })()}
          <text x={hx} y={hy - R - 11} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.title}>
            {desk.lines[0]}
          </text>
          {/* the offset story, at the foot of the container (clear of the loops) */}
          <rect x={hx - 148} y={layout.contY + layout.contH - 27} width={296} height={16} fill={C.base} opacity={0.92} />
          <text x={hx} y={layout.contY + layout.contH - 16} textAnchor="middle" fontSize={9.5} fill={C.muted} letterSpacing="0.18em">
            TREASURY OFFSET · EACH LEG FUNDS THE OTHER
          </text>
        </g>
      )}
    </>
  );
}
