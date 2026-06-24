import { ASSETS, TRACE_ARROW_AR } from "../tokens";

// The Trace directional indicator IS the actual half of the mark — the green
// right-group for pay-in, the cyan left-group for pay-out — provided as PNG
// assets (never a drawn/generic chevron). One sits at the start of each rail
// segment, pointing in the flow direction.
export function TraceArrow({
  cx,
  cy,
  size = 20,
  direction,
}: {
  cx: number;
  cy: number;
  /** rendered height of the arrow */
  size?: number;
  direction: "collection" | "disbursement";
}) {
  const right = direction === "collection";
  const href = right ? ASSETS.arrowRight : ASSETS.arrowLeft;
  const ar = right ? TRACE_ARROW_AR.right : TRACE_ARROW_AR.left;
  const h = size;
  const w = h * ar;
  return <image href={href} x={cx - w / 2} y={cy - h / 2} width={w} height={h} />;
}

/** Small static monochrome monogram for operational Trace nodes (Pix Inc, etc.).
 *  The full colored mark is reserved for the conversion hub. */
export function TraceMonogram({ cx, cy, w, href }: { cx: number; cy: number; w: number; href: string }) {
  const h = w / 1.576;
  return <image href={href} x={cx - w / 2} y={cy - h / 2} width={w} height={h} filter="url(#tf-mono)" opacity={0.7} />;
}
