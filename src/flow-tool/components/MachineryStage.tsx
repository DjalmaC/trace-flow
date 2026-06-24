"use client";
import { type MotionValue } from "framer-motion";
import type { FlowConfig } from "../data/schema";
import { accentFor, tubeTint } from "./tokens";
import type { FlowLayout } from "./layout";
import { useLegOpacity, useLegProgress } from "../animation/sequence";
import {
  AnimatedToken,
  ConversionHub,
  CurrencyToken,
  FlowNodeShape,
  MachineryContainer,
  TraceArrow,
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

  // tube/conduit: flat channel tinted by direction, running behind the nodes
  const ty = leg.y1;
  const tx0 = Math.min(leg.x1, leg.x2);
  const tw = Math.abs(leg.x2 - leg.x1);
  const accent = accentFor(config.direction);

  return (
    <g>
      <rect x={tx0} y={ty - 15} width={tw} height={30} rx={11} fill={tubeTint(config.direction)} stroke={accent} strokeOpacity={0.42} />
      {/* directional indicator: the actual Trace mark-half at the start of this
          rail segment (one per tube), pointing in the flow direction */}
      <TraceArrow cx={tx0 + 28} cy={ty} size={22} direction={config.direction} />
      {/* the Trace-mark conversion hub sits at every crossing/conversion */}
      {convertsTo && (
        <ConversionHub cx={leg.mid.x} cy={leg.mid.y} progress={animate ? progress : undefined} />
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

      {/* No "same actor" projector lines: those dashed connectors are a PDF-only
          device. The scroll reveal already ties the headline to the machinery,
          so the web build omits them (sameActor stays in the data). */}

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
