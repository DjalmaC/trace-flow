"use client";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { FlowConfig } from "../data/schema";
import { getFlow } from "../data";
import { computeLayout, VIEW_H } from "./layout";
import { useLoop } from "../animation/sequence";
import { Background, CornerLockup, Defs } from "./FlowSvg";
import { HeadlineStage } from "./HeadlineStage";
import { MachineryStage } from "./MachineryStage";

// Public surface of the flow-tool module (build brief §8). Render with a
// FlowConfig from the control panel or, later, the Trace Router.
//
//   <FlowExperience config={config} />                 — scroll-driven story
//   <FlowExperience config={config} presentation />    — full-bleed, no scroll
export function FlowExperience({
  config,
  presentation = false,
}: {
  config: FlowConfig;
  presentation?: boolean;
}) {
  const flow = getFlow(config.flowId);
  const reduced = useReducedMotion();
  const animate = !reduced;

  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Stage 2 reveal driven by scroll (ignored in presentation mode).
  const revealOpacity = useTransform(scrollYProgress, [0, 0.22, 0.6], [0, 0.12, 1]);
  const revealY = useTransform(scrollYProgress, [0, 0.6], [34, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  // One clock per stage; periods scale with complexity.
  const headlineLoop = useLoop(3400);
  const machineryLoop = useLoop(flow ? flow.legs.length * 1250 + 900 : 4000);

  if (!flow) {
    return <div className="p-8 text-node-text">Unknown flow: {config.flowId}</div>;
  }

  const layout = computeLayout(flow, config);
  const flowTag = `Flow ${flow.displayId} · ${flow.dials.model} · client view`;

  const Svg = (
    <svg
      viewBox={`0 0 ${layout.width} ${VIEW_H}`}
      width="100%"
      style={{ fontFamily: "Inter, system-ui, Arial, sans-serif", display: "block" }}
      role="img"
      aria-label={`Trace flow ${flow.displayId}: ${flow.title}`}
    >
      <Defs />
      <Background width={layout.width} height={VIEW_H} />
      <motion.g
        style={presentation ? undefined : { opacity: revealOpacity, y: revealY }}
      >
        <MachineryStage layout={layout} config={config} loop={machineryLoop} animate={animate} />
      </motion.g>
      <HeadlineStage
        layout={layout}
        config={config}
        flowTag={flowTag}
        loop={headlineLoop}
        animate={animate}
      />
      <CornerLockup width={layout.width} />
    </svg>
  );

  if (presentation) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-deck-base px-4">
        <div className="w-full max-w-[1400px]">{Svg}</div>
      </div>
    );
  }

  return (
    <div ref={sectionRef} className="relative h-[220vh] w-full">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden bg-deck-base">
        <div className="w-full max-w-[1400px] px-4">{Svg}</div>
        <motion.div
          style={{ opacity: hintOpacity }}
          className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-center text-sm text-muted"
        >
          <div className="mb-1">scroll to see how Trace makes it happen</div>
          <div className="text-green-accent">↓</div>
        </motion.div>
      </div>
    </div>
  );
}
