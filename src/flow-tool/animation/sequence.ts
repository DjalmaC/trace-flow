import { useTime, useTransform, type MotionValue } from "framer-motion";

// A looping master clock and per-leg time windows that sequence value through
// the flow leg-by-leg (build brief §4, Stage 2). One clock drives every leg;
// each leg is "active" inside its own slice of the loop, producing the staggered
// "value moving through rails" motion.

/** A 0..1 value that loops every `periodMs`. */
export function useLoop(periodMs: number): MotionValue<number> {
  const time = useTime();
  return useTransform(time, (t) => (t % periodMs) / periodMs);
}

/**
 * For leg `index` of `count`, derive its local 0..1 progress from the shared
 * loop. Each leg occupies a window; `spread` (>1) overlaps adjacent legs so the
 * flow feels continuous rather than strictly one-at-a-time.
 */
export function useLegProgress(
  loop: MotionValue<number>,
  index: number,
  count: number,
  spread = 1.35,
): MotionValue<number> {
  const slot = 1 / count;
  const start = index * slot;
  const dur = slot * spread;
  return useTransform(loop, (v) => {
    const local = (v - start) / dur;
    return Math.max(0, Math.min(1, local));
  });
}

/** Opacity for a leg's moving token: visible only while traversing its window. */
export function useLegOpacity(
  loop: MotionValue<number>,
  index: number,
  count: number,
  spread = 1.35,
): MotionValue<number> {
  const slot = 1 / count;
  const start = index * slot;
  const dur = slot * spread;
  return useTransform(loop, (v) => {
    const local = (v - start) / dur;
    if (local <= 0 || local >= 1) return 0;
    // quick fade in/out at the ends of the window
    return Math.min(1, Math.min(local, 1 - local) * 6);
  });
}
