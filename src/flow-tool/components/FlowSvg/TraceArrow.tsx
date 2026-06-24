// The Trace directional indicator — echoes the logo's arrow motif (two tilted
// rounded bars, with a gap at the tip so it reads as the mark, not a generic
// chevron). Recolored by direction (green = pay-in / right, cyan = pay-out /
// left) and mirrored for pay-out.
export function TraceArrow({
  cx,
  cy,
  size = 20,
  color,
  flip = false,
}: {
  cx: number;
  cy: number;
  size?: number;
  color: string;
  flip?: boolean;
}) {
  const s = size;
  const sw = s * 0.3;
  return (
    <g transform={`translate(${cx},${cy})${flip ? " scale(-1,1)" : ""}`}>
      <line x1={-s * 0.5} y1={-s * 0.55} x2={s * 0.42} y2={-s * 0.06} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <line x1={-s * 0.5} y1={s * 0.55} x2={s * 0.42} y2={s * 0.06} stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </g>
  );
}

/** Small static monochrome monogram for operational Trace nodes (Pix Inc, etc.).
 *  The full colored mark is reserved for the conversion hub. */
export function TraceMonogram({ cx, cy, w, href }: { cx: number; cy: number; w: number; href: string }) {
  const h = w / 1.576;
  return <image href={href} x={cx - w / 2} y={cy - h / 2} width={w} height={h} filter="url(#tf-mono)" opacity={0.5} />;
}
