"use client";
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { ASSETS, C, TRACE_LOGO_AR } from "../tokens";

// The Trace-mark conversion hub — the signature "Trace does the work" moment,
// used at EVERY currency conversion (hero and machinery alike). A circular
// plinth with a hairline green rim and the real mark centered; as value reaches
// it the mark contracts and spins 360° (with a faint ring pulse, no glow).
//
// `progress` is the carrying leg's 0..1 progress; the spin fires around the
// midpoint (when the token is absorbed). Omit it for a static (resting) hub.
export function ConversionHub({
  cx,
  cy,
  r = 22,
  progress,
}: {
  cx: number;
  cy: number;
  r?: number;
  progress?: MotionValue<number>;
}) {
  // hooks must run unconditionally; fall back to a constant rest value.
  const rest = useMotionValue(1);
  const p = progress ?? rest;
  const rotate = useTransform(p, [0.35, 0.65], [0, 360]);
  const scale = useTransform(p, [0.35, 0.5, 0.65], [1, 0.62, 1]);
  const pulseOpacity = useTransform(p, [0.35, 0.5, 0.65], [0, 0.4, 0]);
  const pulseR = useTransform(p, [0.35, 0.65], [r, r + 12]);

  const w = r; // mark sits inside the plinth with padding (hero ratio)
  const h = w / TRACE_LOGO_AR;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#0b110d" stroke={C.green} strokeOpacity={0.3} />
      {progress && (
        <motion.circle cx={cx} cy={cy} r={pulseR} fill="none" stroke={C.green} strokeWidth={2} style={{ opacity: pulseOpacity }} />
      )}
      <g transform={`translate(${cx},${cy})`}>
        <motion.g style={progress ? { rotate, scale } : undefined}>
          <image href={ASSETS.traceLogo} x={-w / 2} y={-h / 2} width={w} height={h} />
        </motion.g>
      </g>
    </g>
  );
}
