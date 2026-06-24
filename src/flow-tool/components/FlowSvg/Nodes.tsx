import type { NodeLayout } from "../layout";
import { ASSETS, C } from "../tokens";
import { TraceMark } from "./Tokens";
import { TraceMonogram } from "./TraceArrow";

// Node renderers, ported from flowrender_dark.py:
//   operational / merchant → gray rounded rect (gnode)
//   client                 → gray rect + dashed "client logo" slot (cnode)
//   trace                  → gray rect + the Trace mark (tnode)

function NodeLines({ node, dy = 0, fill }: { node: NodeLayout; dy?: number; fill: string }) {
  const { lines, cx, cy } = node;
  const start = cy + dy - ((lines.length - 1) * 7) / 2;
  return (
    <>
      {lines.map((line, i) => (
        <text key={i} x={cx} y={start + i * 14 + 4} fontSize={12} fill={fill} textAnchor="middle">
          {line}
        </text>
      ))}
    </>
  );
}

export function FlowNodeShape({
  node,
  green = false,
  isPrimaryClient = false,
  clientName,
  clientLogoUrl,
}: {
  node: NodeLayout;
  green?: boolean;
  /** Only the primary client carries the uploaded logo + client name. */
  isPrimaryClient?: boolean;
  clientName?: string;
  clientLogoUrl?: string;
}) {
  const { x, y, w, h, cx } = node;
  // Elevated material: flat surface fill + hairline border + top rim-light +
  // soft drop shadow. Foreground (client / headline) gets a restrained green
  // border; operational/trace get a neutral hairline.
  const isFg = green || node.kind === "client";
  const txt = green ? C.greenText : C.nodeText;
  const rect = (
    <g filter="url(#tf-shadow)">
      <rect x={x} y={y} width={w} height={h} rx={12} fill={C.surface} stroke={isFg ? C.green : "#ffffff"} strokeOpacity={isFg ? 0.22 : 0.1} />
      <line x1={x + 16} y1={y + 1.3} x2={x + w - 16} y2={y + 1.3} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1} />
    </g>
  );

  if (node.kind === "engine") {
    // the folded "Trace engine": a wide green-rimmed station; the spinning
    // conversion hub is drawn on top (by MachineryStage) at its center.
    return (
      <g>
        <g filter="url(#tf-shadow)">
          <rect x={x} y={y} width={w} height={h} rx={14} fill={C.surface} stroke={C.green} strokeOpacity={0.34} />
          <line x1={x + 16} y1={y + 1.3} x2={x + w - 16} y2={y + 1.3} stroke="#ffffff" strokeOpacity={0.1} strokeWidth={1} />
        </g>
        <text x={cx} y={y + 18} fontSize={11} fontWeight={600} fill={C.green} textAnchor="middle" opacity={0.85}>
          Trace engine
        </text>
        <text x={cx} y={y + h - 20} fontSize={10} fill={C.subtitle} textAnchor="middle">
          cross-border &amp; conversion
        </text>
        <text x={cx} y={y + h - 7} fontSize={9} fill={C.muted} textAnchor="middle">
          {node.engineCount ? `+${node.engineCount} steps · tap to expand` : "tap to expand"}
        </text>
      </g>
    );
  }

  if (node.kind === "trace") {
    // Operational Trace node: small monochrome monogram above the label. The
    // full colored mark is reserved for the conversion hub (no logo repetition).
    const twoLine = node.lines.length > 1;
    return (
      <g>
        {rect}
        <TraceMonogram cx={cx} cy={y + 16} w={24} href={ASSETS.traceLogo} />
        {twoLine && (
          <text x={cx} y={y + h - 22} fontSize={10.5} fill={txt} textAnchor="middle">
            {node.lines[0]}
          </text>
        )}
        <text x={cx} y={y + h - 9} fontSize={10.5} fill={txt} textAnchor="middle">
          {node.lines.at(-1)}
        </text>
      </g>
    );
  }

  if (node.kind === "client" && isPrimaryClient) {
    const slotStroke = green ? C.green : C.clientSlot;
    // an uploaded logo fills nearly the whole node; otherwise dashed slot + name
    if (clientLogoUrl) {
      const pad = 9;
      return (
        <g>
          {rect}
          <image href={clientLogoUrl} x={x + pad} y={y + pad} width={w - pad * 2} height={h - pad * 2} preserveAspectRatio="xMidYMid meet" />
        </g>
      );
    }
    return (
      <g>
        {rect}
        <rect x={cx - 30} y={y + 8} width={60} height={18} rx={4} fill="none" stroke={slotStroke} strokeDasharray="3 2" />
        <text x={cx} y={y + 21} fontSize={9} fill={slotStroke} textAnchor="middle">
          client logo
        </text>
        <text x={cx} y={y + h - 11} fontSize={10} fill={txt} textAnchor="middle">
          {clientName ?? node.label}
        </text>
      </g>
    );
  }

  // operational / merchant
  return (
    <g>
      {rect}
      <NodeLines node={node} fill={txt} />
    </g>
  );
}

/** Bottom-right Trace Finance lockup. */
export function CornerLockup({ width }: { width: number }) {
  return (
    <g>
      <TraceMark cx={width - 170} cy={528} w={30} />
      <text x={width - 30} y={533} fontSize={15} fontWeight={600} fill={C.title} textAnchor="end">
        Trace Finance
      </text>
    </g>
  );
}
