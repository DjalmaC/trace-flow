"use client";
import { useReducedMotion } from "framer-motion";
import { C } from "../tokens";

// The directional arrow IS half of the Trace mark (the green right-group),
// drawn once as two rounded bars. Direction is conveyed by ROTATION, not by a
// different shape: pay-in rests at 0° (green, right-facing); pay-out rotates
// 180° (cyan, left-facing). On toggle the rotation + fill tween together over
// ~0.55s (Option A) — never a hard cut. Reduced motion snaps to the end state.
type Dir = "collection" | "disbursement";

const SHAPE = {
  vw: 303,
  vh: 417,
  rects: [
    { x: 10.3, y: 86.2, width: 282.9, height: 130.2, rx: 26.0, transform: "rotate(45.03 151.7 151.3)" },
    { x: 29.4, y: 261.6, width: 130.2, height: 122.4, rx: 24.5, transform: "rotate(134.95 94.5 322.8)" },
  ] as React.SVGProps<SVGRectElement>[],
};

const EASE = "cubic-bezier(.4,0,.2,1)";

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
  const reduced = useReducedMotion();
  const fill = color ?? (direction === "collection" ? C.green : C.traceCyan);
  const deg = direction === "collection" ? 0 : 180;
  const h = size;
  const w = h * (SHAPE.vw / SHAPE.vh);
  // Outer <g> carries the POSITION as a CSS transform so it SLIDES along the rail
  // when cx changes on toggle (the nested <svg> x/y attributes wouldn't animate);
  // the inner <g> SPINS (rotation) + colour-tweens. Both run together over .55s.
  return (
    <g
      style={{
        transform: `translate(${cx}px, ${cy}px)`,
        transition: reduced ? undefined : `transform .55s ${EASE}`,
      }}
    >
      <svg x={-w / 2} y={-h / 2} width={w} height={h} viewBox={`0 0 ${SHAPE.vw} ${SHAPE.vh}`} overflow="visible">
        <g
          style={{
            fill,
            transform: `rotate(${deg}deg)`,
            transformBox: "fill-box",
            transformOrigin: "center",
            transition: reduced ? undefined : `transform .55s ${EASE}, fill .55s ${EASE}`,
          }}
        >
          {SHAPE.rects.map((r, i) => (
            <rect key={i} {...r} />
          ))}
        </g>
      </svg>
    </g>
  );
}

/** Small static monochrome monogram for operational Trace nodes (Pix Inc, etc.).
 *  The full colored mark is reserved for the conversion hub. */
export function TraceMonogram({ cx, cy, w, href }: { cx: number; cy: number; w: number; href: string }) {
  const h = w / 1.576;
  return <image href={href} x={cx - w / 2} y={cy - h / 2} width={w} height={h} filter="url(#tf-mono)" opacity={0.7} />;
}
