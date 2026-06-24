"use client";
import { type MotionValue } from "framer-motion";
import type { FlowConfig } from "../data/schema";
import { C } from "./tokens";
import type { FlowLayout } from "./layout";
import { useLegOpacity, useLegProgress } from "../animation/sequence";
import {
  AnimatedToken,
  CurrencyToken,
  FlowNodeShape,
  MachineryContainer,
  SwapCapsule,
  displayCurrency,
} from "./FlowSvg";

// Stage 2 — "how Trace makes it happen" (build brief §4). The operational
// machinery: lane-partitioned nodes, elbow legs, conversion at the border, and
// value flowing leg-by-leg. "same actor" projectors tie back to the headline.

function MachineryLeg({
  layout,
  config,
  index,
  loop,
  animate,
}: {
  layout: FlowLayout;
  config: FlowConfig;
  index: number;
  loop: MotionValue<number>;
  animate: boolean;
}) {
  const leg = layout.legs[index];
  const carries = displayCurrency(leg.carries, config);
  const convertsTo = leg.convertsTo ? displayCurrency(leg.convertsTo, config) : undefined;
  const reverse = layout.reverse;

  const progress = useLegProgress(loop, index, layout.legs.length);
  const opacity = useLegOpacity(loop, index, layout.legs.length);

  // tube/conduit: flat recessed channel with a hairline rim + top rim-light
  const ty = leg.y1;
  const tx0 = Math.min(leg.x1, leg.x2);
  const tw = Math.abs(leg.x2 - leg.x1);
  const arrowX = reverse ? tx0 + 2 : tx0 + tw - 2;
  const arrow = reverse
    ? `M${arrowX + 9} ${ty - 6} L${arrowX} ${ty} L${arrowX + 9} ${ty + 6}`
    : `M${arrowX - 9} ${ty - 6} L${arrowX} ${ty} L${arrowX - 9} ${ty + 6}`;

  return (
    <g>
      <rect x={tx0} y={ty - 15} width={tw} height={30} rx={15} fill={C.surfaceTube} stroke="#ffffff" strokeOpacity={0.07} />
      <line x1={tx0 + 14} y1={ty - 13.6} x2={tx0 + tw - 14} y2={ty - 13.6} stroke="#ffffff" strokeOpacity={0.05} strokeWidth={1} />
      <path d={arrow} fill="none" stroke={C.green} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
      {/* conversion capsule sits statically at the crossing */}
      {convertsTo && (
        <g transform={`translate(${leg.mid.x},${leg.mid.y})`}>
          <SwapCapsule left={reverse ? convertsTo : carries} right={reverse ? carries : convertsTo} coin={config.stablecoin} />
        </g>
      )}
      {/* faint static token anchors a plain leg for legibility */}
      {!convertsTo && !animate && (
        <g transform={`translate(${leg.mid.x},${leg.mid.y})`}>
          <CurrencyToken currency={carries} coin={config.stablecoin} />
        </g>
      )}
      {/* the traveling value */}
      {animate && (
        <AnimatedToken
          d={leg.d}
          progress={progress}
          opacity={opacity}
          reverse={reverse}
          carries={carries}
          convertsTo={convertsTo}
          coin={config.stablecoin}
        />
      )}
    </g>
  );
}

export function MachineryStage({
  layout,
  config,
  loop,
  animate,
  showHeading = true,
}: {
  layout: FlowLayout;
  config: FlowConfig;
  loop: MotionValue<number>;
  animate: boolean;
  showHeading?: boolean;
}) {
  return (
    <g>
      <MachineryContainer layout={layout} showHeading={showHeading} />

      {/* projector ("same actor") lines */}
      {layout.projectors.map((p, i) => (
        <g key={i}>
          <line
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={C.projector}
            strokeWidth={1.4}
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
          <text x={p.x2} y={p.y2 - 10} fontSize={10} fill={C.muted} textAnchor="middle">
            same actor
          </text>
        </g>
      ))}

      {/* legs (drawn under nodes) */}
      {layout.legs.map((_, i) => (
        <MachineryLeg key={i} layout={layout} config={config} index={i} loop={loop} animate={animate} />
      ))}

      {/* nodes */}
      {layout.nodes.map((node) => (
        <FlowNodeShape
          key={node.id}
          node={node}
          isPrimaryClient={node.id === layout.primaryClientId}
          clientName={config.clientName}
          clientLogoUrl={config.clientLogoUrl}
        />
      ))}
    </g>
  );
}
