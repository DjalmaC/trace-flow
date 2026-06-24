import { useEffect, useMemo } from "react";
import { useMotionValue, useMotionValueEvent, type MotionValue } from "framer-motion";

// Sample a point along an SVG path for a given progress (0..1), per the brief:
// "animate tokens along leg paths via SVG path sampling (path.getPointAtLength)".
// Works for straight legs and the curved headline arc alike.

let scratchSvg: SVGSVGElement | null = null;
function scratch(): SVGSVGElement | null {
  if (typeof document === "undefined") return null;
  if (!scratchSvg) {
    scratchSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    scratchSvg.setAttribute("width", "0");
    scratchSvg.setAttribute("height", "0");
    scratchSvg.style.position = "absolute";
    scratchSvg.style.visibility = "hidden";
    scratchSvg.style.pointerEvents = "none";
    document.body.appendChild(scratchSvg);
  }
  return scratchSvg;
}

/**
 * Returns motion values {x, y} tracking a point along path `d` as `progress`
 * (a MotionValue 0..1) changes. `reverse` flips travel direction.
 */
export function useTokenAlongPath(
  d: string,
  progress: MotionValue<number>,
  reverse = false,
) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const path = useMemo(() => {
    const svg = scratch();
    if (!svg) return null;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return p;
  }, [d]);

  useEffect(() => {
    return () => {
      path?.parentNode?.removeChild(path);
    };
  }, [path]);

  useEffect(() => {
    if (!path) return;
    const len = path.getTotalLength();
    let t = Math.max(0, Math.min(1, progress.get()));
    if (reverse) t = 1 - t;
    const pt = path.getPointAtLength(len * t);
    x.set(pt.x);
    y.set(pt.y);
  }, [path, progress, reverse, x, y]);

  useMotionValueEvent(progress, "change", (v) => {
    if (!path) return;
    const len = path.getTotalLength();
    let t = Math.max(0, Math.min(1, v));
    if (reverse) t = 1 - t;
    const pt = path.getPointAtLength(len * t);
    x.set(pt.x);
    y.set(pt.y);
  });

  return { x, y };
}
