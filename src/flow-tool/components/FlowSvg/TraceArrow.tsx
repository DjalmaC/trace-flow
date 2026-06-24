import { C } from "../tokens";

// The directional arrow IS half of the Trace mark, drawn as two rounded bars
// (crisp vector, recolored by direction — never a generic chevron):
//   pay-in  (collection)  = green, right-facing  (the logo's green right group)
//   pay-out (disbursement) = cyan,  left-facing  (the logo's cyan left group)
// One sits at the start of each rail segment, pointing in the flow direction.
type Dir = "collection" | "disbursement";

const SHAPES: Record<Dir, { vw: number; vh: number; rects: React.SVGProps<SVGRectElement>[] }> = {
  collection: {
    vw: 303,
    vh: 417,
    rects: [
      { x: 10.3, y: 86.2, width: 282.9, height: 130.2, rx: 26.0, transform: "rotate(45.03 151.7 151.3)" },
      { x: 29.4, y: 261.6, width: 130.2, height: 122.4, rx: 24.5, transform: "rotate(134.95 94.5 322.8)" },
    ],
  },
  disbursement: {
    vw: 297,
    vh: 405,
    rects: [
      { x: 6.6, y: 195.6, width: 283.7, height: 121.9, rx: 24.4, transform: "rotate(45.05 148.4 256.6)" },
      { x: 141.9, y: 31.3, width: 121.7, height: 114.0, rx: 22.8, transform: "rotate(45.06 202.7 88.2)" },
    ],
  },
};

export function TraceArrow({
  cx,
  cy,
  size = 24,
  direction,
  color,
}: {
  cx: number;
  cy: number;
  /** rendered height of the arrow */
  size?: number;
  direction: Dir;
  color?: string;
}) {
  const { vw, vh, rects } = SHAPES[direction];
  const fill = color ?? (direction === "collection" ? C.green : C.traceCyan);
  const h = size;
  const w = h * (vw / vh);
  // nested <svg> lets the mark keep its own viewBox while we position it at the
  // segment start inside the parent flow <svg>
  return (
    <svg x={cx - w / 2} y={cy - h / 2} width={w} height={h} viewBox={`0 0 ${vw} ${vh}`} fill={fill} overflow="visible">
      {rects.map((r, i) => (
        <rect key={i} {...r} />
      ))}
    </svg>
  );
}

/** Small static monochrome monogram for operational Trace nodes (Pix Inc, etc.).
 *  The full colored mark is reserved for the conversion hub. */
export function TraceMonogram({ cx, cy, w, href }: { cx: number; cy: number; w: number; href: string }) {
  const h = w / 1.576;
  return <image href={href} x={cx - w / 2} y={cy - h / 2} width={w} height={h} filter="url(#tf-mono)" opacity={0.7} />;
}
