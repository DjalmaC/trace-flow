import type { NodeLayout } from "../layout";
import { ASSETS, C } from "../tokens";
import { TraceMark } from "./Tokens";

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
  const fill = green ? C.greenFill : C.nodeFill;
  const stroke = green ? C.green : C.nodeStroke;
  const txt = green ? C.greenText : C.nodeText;
  const rect = <rect x={x} y={y} width={w} height={h} rx={9} fill={fill} stroke={stroke} />;

  if (node.kind === "trace") {
    const twoLine = node.lines.length > 1;
    return (
      <g>
        {rect}
        <TraceMark cx={cx} cy={y + 16} w={32} />
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
    return (
      <g>
        {rect}
        {clientLogoUrl ? (
          <image href={clientLogoUrl} x={cx - 28} y={y + 7} width={56} height={20} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <>
            <rect x={cx - 30} y={y + 8} width={60} height={18} rx={4} fill="none" stroke={slotStroke} strokeDasharray="3 2" />
            <text x={cx} y={y + 21} fontSize={9} fill={slotStroke} textAnchor="middle">
              client logo
            </text>
          </>
        )}
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
