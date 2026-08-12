import { C } from "../tokens";

/** SVG <defs>: deck glow gradient + leg/swap/headline arrowhead markers. */
export function Defs() {
  return (
    <defs>
      <radialGradient id="tf-glow" cx="0.5" cy="1.18" r="0.85">
        <stop offset="0" stopColor={C.glow1} />
        <stop offset="0.55" stopColor={C.glow2} />
        <stop offset="1" stopColor={C.base} stopOpacity="0" />
      </radialGradient>
      {/* soft neutral drop shadow — what lifts the objects (not glow) */}
      <filter id="tf-shadow" x="-50%" y="-50%" width="200%" height="220%">
        <feDropShadow dx="0" dy="16" stdDeviation="22" floodColor="#000000" floodOpacity="0.5" />
      </filter>
      {/* desaturate the mark to a muted monogram on operational Trace nodes */}
      <filter id="tf-mono">
        <feColorMatrix type="saturate" values="0.1" />
      </filter>
      {/* ── liquid-glass box material (SVG can't backdrop-blur, so the recipe
          is faked in three parts): the lit gradient fill, the specular top
          edge, and a soft float shadow. Mirrors the GlassPanel look. ── */}
      <linearGradient id="tf-glass-fill" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.075" />
        <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.02" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.05" />
      </linearGradient>
      <linearGradient id="tf-glass-edge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="0.2" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="0.8" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <filter id="tf-glass-shadow" x="-40%" y="-40%" width="180%" height="200%">
        <feDropShadow dx="0" dy="10" stdDeviation="11" floodColor="#000000" floodOpacity="0.32" />
      </filter>
      <marker id="tf-leg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M2 1L8 5L2 9" fill="none" stroke={C.leg} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      <marker id="tf-arc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M2 1L8 5L2 9" fill="none" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      <marker id="tf-swap" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M2 2L8 5L2 8" fill="none" stroke="#b4bcb7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      <marker id="tf-swap-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M2 2L8 5L2 8" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>
  );
}
