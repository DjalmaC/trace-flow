"use client";
import { motion, useTransform, type MotionValue } from "framer-motion";
import type { FlowConfig } from "../data/schema";
import { C } from "./tokens";
import type { FlowLayout } from "./layout";
import { AnimatedToken, CurrencyToken, SwapCapsule, displayCurrency } from "./FlowSvg";

// Stage 1 — "the desired transaction" (build brief §4). A clean A→B headline:
// the configured client, a single arc to the beneficiary, and a token of the
// collected currency that converts mid-arc and lands on the beneficiary.

function HeadlineNode({
  box,
  isClient,
  label,
  config,
}: {
  box: FlowLayout["headline"]["a"];
  isClient: boolean;
  label: string;
  config: FlowConfig;
}) {
  const { x, y, w, h, cx } = box;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={9} fill={C.greenFill} stroke={C.green} />
      {isClient ? (
        <>
          {config.clientLogoUrl ? (
            <image href={config.clientLogoUrl} x={cx - 26} y={y + 6} width={52} height={16} preserveAspectRatio="xMidYMid meet" />
          ) : (
            <>
              <rect x={cx - 28} y={y + 6} width={56} height={15} rx={4} fill="none" stroke={C.green} strokeDasharray="3 2" />
              <text x={cx} y={y + 17} fontSize={8} fill={C.green} textAnchor="middle">
                client logo
              </text>
            </>
          )}
          <text x={cx} y={y + h - 10} fontSize={11} fontWeight={600} fill={C.greenText} textAnchor="middle">
            {config.clientName}
          </text>
        </>
      ) : (
        <text x={cx} y={y + h / 2 + 4} fontSize={12} fontWeight={600} fill={C.greenText} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}

export function HeadlineStage({
  layout,
  config,
  flowTag,
  loop,
  animate,
  showChrome = true,
}: {
  layout: FlowLayout;
  config: FlowConfig;
  flowTag: string;
  loop: MotionValue<number>;
  animate: boolean;
  /** SVG title + flow tag. Off when the section supplies its own HTML heading. */
  showChrome?: boolean;
}) {
  const h = layout.headline;
  const carries = displayCurrency(h.carries, config);
  const convertsTo = h.convertsTo ? displayCurrency(h.convertsTo, config) : undefined;
  const reverse = layout.reverse;
  const tokenOpacity = useTransform(loop, [0, 0.07, 0.9, 1], [0, 1, 1, 0]);

  return (
    <g>
      {showChrome && (
        <>
          <text x={34} y={50} fontSize={15} fontWeight={600} fill={C.title}>
            What the client wants
          </text>
          <text x={layout.width - 34} y={42} fontSize={12} fill={C.muted} textAnchor="end">
            {flowTag}
          </text>
        </>
      )}

      {/* the desired-transaction arc */}
      <path
        d={h.d}
        fill="none"
        stroke={C.green}
        strokeWidth={3}
        strokeLinecap="round"
        markerEnd={reverse ? undefined : "url(#tf-arc)"}
        markerStart={reverse ? "url(#tf-arc)" : undefined}
      />
      <text x={h.mid.x} y={h.a.y + 10} fontSize={11} fill={C.client} textAnchor="middle">
        the desired transaction
      </text>

      <HeadlineNode box={h.a} isClient={h.aIsClient} label={h.aLabel} config={config} />
      <HeadlineNode box={h.b} isClient={h.bIsClient} label={h.bLabel} config={config} />

      {/* conversion capsule on the arc */}
      {convertsTo && (
        <g transform={`translate(${h.mid.x},${h.mid.y})`}>
          <SwapCapsule left={reverse ? convertsTo : carries} right={reverse ? carries : convertsTo} green coin={config.stablecoin} />
        </g>
      )}

      {/* the traveling value */}
      {animate ? (
        <AnimatedToken d={h.d} progress={loop} opacity={tokenOpacity} reverse={reverse} carries={carries} convertsTo={convertsTo} coin={config.stablecoin} />
      ) : (
        !convertsTo && (
          <g transform={`translate(${h.mid.x},${h.mid.y})`}>
            <CurrencyToken currency={carries} coin={config.stablecoin} />
          </g>
        )
      )}
    </g>
  );
}
