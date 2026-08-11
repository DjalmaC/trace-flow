import type { CSSProperties, ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// The shared-link "liquid glass" surface (BRLT deck design system).
// Purely presentational. The design system bans frosted glass in everyday
// product UI; the /f/ presentation surface is the sanctioned exception, so
// these primitives live with the flow-tool and are consumed only by the
// shared-link skin.
// ─────────────────────────────────────────────────────────────────────────────

/** Full-bleed photographic backdrop: silk plate under a dark wash, plus the
 *  soft radial green glow at the top-right. Render once, fixed, as the FIRST
 *  child of the page — it sits at z-0, so it paints over the body background
 *  (a negative z-index would land beneath it) while every positioned sibling
 *  that follows paints above. Safe on iOS (no background-attachment:fixed). */
export function SilkBackdrop() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundColor: "#07090b",
          backgroundImage: "linear-gradient(rgba(2,4,7,.3), rgba(2,4,7,.55)), url('/assets/bg/silk.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed z-0"
        style={{
          right: -140,
          top: -100,
          width: 760,
          height: 640,
          background: "radial-gradient(circle, rgba(21,57,45,.5), transparent 62%)",
        }}
      />
    </>
  );
}

/** The liquid-glass panel recipe, as a style object for odd shapes. */
export const glassStyle: CSSProperties = {
  borderRadius: 28,
  background: "linear-gradient(160deg, rgba(10,15,19,.42), rgba(10,15,19,.28) 45%, rgba(10,15,19,.38))",
  backdropFilter: "blur(28px) saturate(1.4)",
  WebkitBackdropFilter: "blur(28px) saturate(1.4)",
  border: "1px solid rgba(255,255,255,.18)",
  boxShadow: "0 30px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.28)",
};

/** Specular 1px top edge — a white gradient line just inside the panel top. */
export function SpecularEdge() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-7 right-7 top-0 h-px"
      style={{
        background:
          "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.7) 20%, rgba(255,255,255,.7) 80%, rgba(255,255,255,0))",
      }}
    />
  );
}

/** A liquid-glass panel: recipe + specular edge, content on top. */
export function GlassPanel({
  className = "",
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className}`} style={{ ...glassStyle, ...style }}>
      <SpecularEdge />
      {children}
    </div>
  );
}
