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
import { useLoop } from "../animation/sequence";
import { Defs } from "./FlowSvg";
import { HeadlineStage } from "./HeadlineStage";
import { MachineryStage } from "./MachineryStage";
import { ASSETS, C, TRACE_LOGO_AR } from "./tokens";

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
}: {
  config: FlowConfig;
  presentation?: boolean;
  /** Render a single section statically (QA / the future two-page option). */
  only?: "surface" | "depth";
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

  const headlineLoop = useLoop(3400);
  const machineryLoop = useLoop(flow ? flow.legs.length * 1250 + 900 : 4000);

  if (!flow) {
    return <div className="p-8 text-node-text">Unknown flow: {config.flowId}</div>;
  }

  const layout = computeLayout(flow, config);
  const flowTag = `Flow ${flow.displayId} · ${flow.dials.model}`;

  // viewBoxes that frame each layer out of the shared geometry.
  const hl = layout.headline;
  const sMinX = Math.max(0, hl.a.x - 96);
  const sMaxX = Math.min(layout.width, hl.b.x + hl.b.w + 96);
  const surfaceVB = `${sMinX} 22 ${sMaxX - sMinX} 168`;
  const machineryVB = `0 ${CONT_Y - 12} ${layout.width} ${CONT_H + 30}`;

  const svgStyle = {
    display: "block",
    width: "100%",
    fontFamily: "Inter, system-ui, Arial, sans-serif",
  } as const;

  const SurfaceSvg = (
    <svg viewBox={surfaceVB} preserveAspectRatio="xMidYMid meet" style={{ ...svgStyle, maxHeight: "46vh" }} aria-label={`What the client wants — ${flow.title}`}>
      <Defs />
      <HeadlineStage layout={layout} config={config} flowTag={flowTag} loop={headlineLoop} animate={animate} showChrome={false} />
    </svg>
  );

  const MachinerySvg = (
    <svg viewBox={machineryVB} preserveAspectRatio="xMidYMid meet" style={{ ...svgStyle, maxHeight: "64vh" }} aria-label={`How Trace makes it happen — ${flow.title}`}>
      <Defs />
      <MachineryStage layout={layout} config={config} loop={machineryLoop} animate={animate} showHeading={false} />
    </svg>
  );

  const deckGlow = `radial-gradient(90% 80% at 50% 122%, ${C.glow1} 0%, ${C.glow2} 55%, ${C.base} 100%)`;

  const SurfaceHeading = (
    <div className="mb-5 text-center">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.32em] text-client">
        The desired transaction
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-title md:text-4xl">
        What <span className="text-green-accent">{config.clientName}</span> wants
      </h1>
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

  // ── reduced motion: stack the two sections, no dive ──────────────────────
  if (reduced) {
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

        {/* flow tag, top-right */}
        <div className="absolute right-5 top-5 z-30 text-xs text-muted">{flowTag} · client view</div>

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

        {!presentation && (
          <motion.div
            style={{ opacity: hintOpacity }}
            className="pointer-events-none absolute bottom-10 left-1/2 z-30 -translate-x-1/2 text-center text-sm text-muted"
          >
            <div className="mb-1">scroll to dive into how Trace makes it happen</div>
            <div className="animate-bounce text-green-accent">↓</div>
          </motion.div>
        )}

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
