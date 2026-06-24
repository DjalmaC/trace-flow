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
