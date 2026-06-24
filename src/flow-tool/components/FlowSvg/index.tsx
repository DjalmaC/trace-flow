import { C } from "../tokens";
import { CONT_H, CONT_Y, type FlowLayout } from "../layout";

export { Defs } from "./Defs";
export { FlowNodeShape, CornerLockup } from "./Nodes";
export { CurrencyToken, SwapCapsule, TraceMark, displayCurrency } from "./Tokens";
export { AnimatedToken } from "./AnimatedToken";

/** Deck background: base + radial green glow + bright top rule. */
export function Background({ width, height }: { width: number; height: number }) {
  return (
    <g>
      <rect x={0} y={0} width={width} height={height} fill={C.base} />
      <rect x={0} y={0} width={width} height={height} fill="url(#tf-glow)" />
      <rect x={0} y={0} width={width} height={3.2} fill={C.rule} />
    </g>
  );
}

/** The "How Trace makes it happen" engine bay: dashed container + lane divide. */
export function MachineryContainer({
  layout,
  showHeading = true,
}: {
  layout: FlowLayout;
  showHeading?: boolean;
}) {
  const { width, dividerX, brazilLabelX, abroadLabelX } = layout;
  return (
    <g opacity={0.95}>
      <rect
        x={24}
        y={CONT_Y}
        width={width - 48}
        height={CONT_H}
        rx={16}
        fill="#ffffff"
        fillOpacity={0.018}
        stroke={C.divider}
        strokeWidth={1}
        strokeDasharray="3 4"
      />
      {showHeading && (
        <text x={42} y={CONT_Y + 28} fontSize={14} fontWeight={600} fill={C.subtitle}>
          How Trace makes it happen
        </text>
      )}
      <text x={brazilLabelX} y={CONT_Y + 56} fontSize={12} fill={C.muted} textAnchor="middle">
        Brazil
      </text>
      <text x={abroadLabelX} y={CONT_Y + 56} fontSize={12} fill={C.muted} textAnchor="middle">
        Abroad
      </text>
      <line
        x1={dividerX}
        y1={CONT_Y - 2}
        x2={dividerX}
        y2={CONT_Y + CONT_H - 6}
        stroke={C.divider}
        strokeWidth={1}
        strokeDasharray="3 5"
      />
    </g>
  );
}
