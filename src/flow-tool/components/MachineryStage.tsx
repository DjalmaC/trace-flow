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

  return (
    <g>
      <path
        d={leg.d}
        fill="none"
        stroke={C.leg}
        strokeWidth={4}
        markerEnd={reverse ? undefined : "url(#tf-leg)"}
        markerStart={reverse ? "url(#tf-leg)" : undefined}
      />
      {/* conversion capsule sits statically at the crossing */}
      {convertsTo && (
        <g transform={`translate(${leg.mid.x},${leg.mid.y})`}>
          <SwapCapsule left={reverse ? convertsTo : carries} right={reverse ? carries : convertsTo} />
        </g>
      )}
      {/* faint static token anchors a plain leg for legibility */}
      {!convertsTo && !animate && (
        <g transform={`translate(${leg.mid.x},${leg.mid.y})`}>
          <CurrencyToken currency={carries} />
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
}: {
  layout: FlowLayout;
  config: FlowConfig;
  loop: MotionValue<number>;
  animate: boolean;
}) {
  return (
    <g>
      <MachineryContainer layout={layout} />

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
          clientName={config.clientName}
          clientLogoUrl={config.clientLogoUrl}
        />
      ))}
    </g>
  );
}
