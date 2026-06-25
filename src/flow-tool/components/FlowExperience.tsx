"use client";
import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import type { FlowConfig } from "../data/schema";
import { getFlow } from "../data";
import { computeLayout, CONT_Y, CONT_H } from "./layout";
import { Defs } from "./FlowSvg";
import { HeroFlow } from "./HeroFlow";
import { MachineryStage } from "./MachineryStage";
import { ASSETS, C, TRACE_LOGO_AR } from "./tokens";
import type { Direction } from "../data/schema";

// Public surface of the flow-tool module (build brief §8).
//
// The experience is TWO full-screen sections in one continuous scroll:
//   1. The surface  — "what the client wants" (the desired transaction).
//   2. The depth    — "how Trace makes it happen" (the full machinery).
// Scrolling performs a "dive": the surface rises away and fades as the camera
// descends, and the machinery rises from below and sharpens through an
// underwater veil. Honors prefers-reduced-motion (sections simply stack).
export function FlowExperience({
  config,
  presentation = false,
  only,
  onDirectionChange,
  forceStatic = false,
}: {
  config: FlowConfig;
  presentation?: boolean;
  /** Render a single section statically (QA / the future two-page option). */
  only?: "surface" | "depth";
  /** Wires the always-visible on-canvas Pay-in / Pay-out toggle. */
  onDirectionChange?: (d: Direction) => void;
  /** Force the stacked, non-dive layout (used for print / PDF export). */
  forceStatic?: boolean;
}) {
  const flow = getFlow(config.flowId);
  const reduced = useReducedMotion();
  const animate = !reduced;

  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // ── the dive ────────────────────────────────────────────────────────────
  // surface: rises up and off, enlarging as it passes the camera, then fades.
  const surfaceY = useTransform(p, [0, 0.5], ["0%", "-82%"]);
  const surfaceScale = useTransform(p, [0, 0.5], [1, 1.22]);
  const surfaceOpacity = useTransform(p, [0.18, 0.44], [1, 0]);
  // depth: rises from below, sharpening into focus.
  const depthY = useTransform(p, [0.12, 0.62], ["58%", "0%"]);
  const depthScale = useTransform(p, [0.12, 0.62], [0.88, 1]);
  const depthOpacity = useTransform(p, [0.18, 0.56], [0, 1]);
  const depthBlurN = useTransform(p, [0.18, 0.52], [12, 0]);
  const depthBlur = useMotionTemplate`blur(${depthBlurN}px)`;
  const depthHeadingOpacity = useTransform(p, [0.46, 0.72], [0, 1]);
  // underwater veil peaks mid-dive (passing through the surface).
  const veilOpacity = useTransform(p, [0, 0.4, 0.85], [0, 0.65, 0.12]);
  const hintOpacity = useTransform(p, [0, 0.08], [1, 0]);

  if (!flow) {
    return <div className="p-8 text-node-text">Unknown flow: {config.flowId}</div>;
  }

  // One unified machinery diagram per flow — the full chain, always shown and
  // scaled to fit the deck (no collapse/expand split, no horizontal pan).
  const layout = computeLayout(flow, config);
  const flowTag = `Flow ${flow.displayId} · ${flow.dials.model}`;
  const machineryVB = `0 ${CONT_Y - 12} ${layout.width} ${CONT_H + 30}`;

  const svgStyle = {
    display: "block",
    width: "100%",
    fontFamily: "Inter, system-ui, Arial, sans-serif",
  } as const;

  const SurfaceSvg = <HeroFlow flow={flow} config={config} />;

  const MachinerySvg = (
    <svg
      viewBox={machineryVB}
      preserveAspectRatio="xMidYMid meet"
      style={{ ...svgStyle, maxHeight: "64vh" }}
      aria-label={`How Trace makes it happen — ${flow.title}`}
    >
      <Defs />
      <MachineryStage layout={layout} config={config} animate={animate} showHeading={false} />
    </svg>
  );

  // ambient: a single soft radial light + vignette over the near-black page.
  const deckGlow =
    `radial-gradient(62% 62% at 50% 46%, ${C.ambientGlow1} 0%, ${C.ambientGlow2} 58%, rgba(7,9,11,0) 100%),` +
    `radial-gradient(72% 72% at 50% 50%, rgba(7,9,11,0) 58%, ${C.vignette} 100%)`;

  const support =
    config.direction === "collection"
      ? "Collect in Brazil, settle to their merchant abroad, in one move."
      : "Fund from abroad, pay out into Brazil, in one move.";

  const SurfaceHeading = (
    <div className="mb-5 text-center">
      <div className="mb-2 text-[13px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
        The desired transaction
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-[#f2f5f3] md:text-5xl">
        What <span className="text-[#5fd3a0]">{config.clientName}</span> wants
      </h1>
      <p className="mt-3 text-base font-normal text-[#8b948f]">{support}</p>
    </div>
  );

  const DepthHeading = (
    <div className="mb-5 text-center">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.32em] text-muted">
        Beneath the surface
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-title md:text-4xl">
        How Trace makes it happen
      </h2>
    </div>
  );

  // ── single-section static render (QA hook + future two-page mode) ────────
  if (only) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center px-6" style={{ background: deckGlow }}>
        <div className="absolute left-0 top-0 h-[3px] w-full" style={{ background: C.rule }} />
        {only === "surface" ? SurfaceHeading : DepthHeading}
        <div className={only === "surface" ? "w-full max-w-[1200px]" : "w-full max-w-[1500px]"}>
          {only === "surface" ? SurfaceSvg : MachinerySvg}
        </div>
        <Lockup />
      </div>
    );
  }

  // ── reduced motion / print: stack the two sections, no dive ──────────────
  if (reduced || forceStatic) {
    return (
      <div className="w-full" style={{ background: C.base }}>
        <div className="absolute left-0 top-0 z-10 h-[3px] w-full" style={{ background: C.rule }} />
        <section className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: deckGlow }}>
          {SurfaceHeading}
          <div className="w-full max-w-[1200px]">{SurfaceSvg}</div>
        </section>
        <section className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: deckGlow }}>
          {DepthHeading}
          <div className="w-full max-w-[1500px]">{MachinerySvg}</div>
        </section>
        <Lockup />
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="relative h-[340vh] w-full" style={{ background: C.base }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: C.base }}>
        <div className="absolute inset-0" style={{ background: deckGlow }} />
        <div className="absolute left-0 top-0 z-30 h-[3px] w-full" style={{ background: C.rule }} />

        {/* always-visible Pay-in / Pay-out toggle (build brief §5) */}
        {onDirectionChange && (
          <DirectionToggle direction={config.direction} onChange={onDirectionChange} />
        )}
        {/* flow tag, bottom-left — internal only; hidden in presentation/client views */}
        {!presentation && (
          <div className="absolute bottom-5 left-6 z-30 text-xs text-muted">{flowTag} · client view</div>
        )}

        {/* DEPTH — behind */}
        <motion.div
          style={{ opacity: depthOpacity, y: depthY, scale: depthScale, filter: depthBlur }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
        >
          <motion.div style={{ opacity: depthHeadingOpacity }}>{DepthHeading}</motion.div>
          <div className="w-full max-w-[1500px]">{MachinerySvg}</div>
        </motion.div>

        {/* underwater veil — peaks as the camera passes through the surface */}
        <motion.div
          aria-hidden
          style={{
            opacity: veilOpacity,
            background: `linear-gradient(180deg, rgba(8,9,11,0) 0%, ${C.glow1}88 55%, rgba(8,9,11,0.85) 100%)`,
          }}
          className="pointer-events-none absolute inset-0 z-20"
        />

        {/* SURFACE — front */}
        <motion.div
          style={{ opacity: surfaceOpacity, y: surfaceY, scale: surfaceScale }}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6"
        >
          {SurfaceHeading}
          <div className="w-full max-w-[1200px]">{SurfaceSvg}</div>
        </motion.div>

        <motion.div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-9 left-1/2 z-30 -translate-x-1/2 text-center"
        >
          <div className="mb-1.5 text-sm font-medium tracking-wide text-subtitle">Explore the full flow below</div>
          <div className="animate-bounce text-2xl leading-none text-green-accent">↓</div>
        </motion.div>

        <Lockup />
      </div>
    </div>
  );
}

function Lockup() {
  return (
    <div className="absolute bottom-5 right-6 z-30 flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.traceLogo} alt="" style={{ height: 22, width: 22 * TRACE_LOGO_AR }} />
      <span className="text-[15px] font-semibold text-title">Trace Finance</span>
    </div>
  );
}

function DirectionToggle({
  direction,
  onChange,
}: {
  direction: Direction;
  onChange: (d: Direction) => void;
}) {
  return (
    <div className="absolute right-5 top-5 z-40 flex gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] backdrop-blur">
      {(["collection", "disbursement"] as Direction[]).map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`rounded-lg px-[15px] py-[6px] text-[12.5px] font-medium tracking-[0.2px] transition ${
            direction === d ? "bg-[#46d39a24] text-[#bfe8d4]" : "text-[#8b948f] hover:text-[#bfe8d4]"
          }`}
        >
          {d === "collection" ? "Pay-in" : "Pay-out"}
        </button>
      ))}
    </div>
  );
}
