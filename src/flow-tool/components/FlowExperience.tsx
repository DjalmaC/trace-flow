"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

// Phones get a simpler stacked layout with swipeable diagrams instead of the
// scroll-dive; desktop is unchanged. (Resolves before the flow is revealed,
// behind the welcome overlay, so there's no visible switch.)
export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return mobile;
}
import type { FlowConfig, SettlementOption } from "../data/schema";
import { applySettlement, clientFlowName, fundingChoices, isPlatformFlow, settlementChoices } from "../data/schema";
import { getFlow } from "../data";
import { computeLayout, CONT_Y, CONT_H } from "./layout";
import { Defs, displayCurrency } from "./FlowSvg";
import { HeroFlow } from "./HeroFlow";
import { MachineryStage } from "./MachineryStage";
import { ASSETS, C, TRACE_LOGO_AR } from "./tokens";
import { MobileFlow } from "./MobileFlow";
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
  const baseFlow = getFlow(config.flowId);

  // ── settlement toggle: one rail, more than one settlement ────────────────
  // A flow can offer settlement options (Leg.settlements). The active option
  // is applied as a pure flow transform BEFORE layout, so every renderer just
  // sees "a flow". Left idle, the toggle flips itself after two full relay
  // passes — the moving control narrates the currency change; any manual
  // click takes over for the session.
  const choices = useMemo(() => (baseFlow ? settlementChoices(baseFlow) : []), [baseFlow]);
  const fundChoices = useMemo(() => (baseFlow ? fundingChoices(baseFlow) : []), [baseFlow]);
  const [settlementIdx, setSettlementIdx] = useState(0);
  const [fundingIdx, setFundingIdx] = useState(0);
  const manualSettle = useRef(false);
  const passCount = useRef(0);
  useEffect(() => {
    setSettlementIdx(0);
    setFundingIdx(0);
    passCount.current = 0; // manual control, once taken, stays for the session
    // QA hooks: ?settle=<i> / ?fund=<i> pin options deterministically
    const q = new URLSearchParams(window.location.search);
    const v = q.get("settle");
    if (v != null) {
      setSettlementIdx(Math.max(0, Number(v) || 0));
      manualSettle.current = true;
    }
    const w = q.get("fund");
    if (w != null) {
      setFundingIdx(Math.max(0, Number(w) || 0));
      manualSettle.current = true;
    }
  }, [config.flowId]);
  const flow = useMemo(
    () =>
      baseFlow && (choices.length > 1 || fundChoices.length > 1)
        ? applySettlement(
            baseFlow,
            Math.min(settlementIdx, Math.max(0, choices.length - 1)),
            Math.min(fundingIdx, Math.max(0, fundChoices.length - 1)),
            config.stablecoin,
          )
        : baseFlow,
    [baseFlow, choices, fundChoices, settlementIdx, fundingIdx, config.stablecoin],
  );
  const pickSettlement = (i: number) => {
    manualSettle.current = true;
    setSettlementIdx(i);
  };
  const pickFunding = (i: number) => {
    manualSettle.current = true;
    setFundingIdx(i);
  };
  const onPassComplete = () => {
    if (manualSettle.current || (choices.length < 2 && fundChoices.length < 2)) return;
    passCount.current += 1;
    if (passCount.current >= 2) {
      passCount.current = 0;
      // odometer: cycle the settlement side; each wrap advances the funding side
      if (choices.length > 1) {
        setSettlementIdx((i) => {
          const n = (i + 1) % choices.length;
          if (n === 0 && fundChoices.length > 1) setFundingIdx((j) => (j + 1) % fundChoices.length);
          return n;
        });
      } else {
        setFundingIdx((j) => (j + 1) % fundChoices.length);
      }
    }
  };

  // Reduced-motion is null during SSR and on the first client render, then true
  // on a reduced-motion machine — branching on it directly would flip the whole
  // tree between server and client and trip a hydration error on Vercel. Gate it
  // behind a mount flag (same shape as useIsMobile) so first render always
  // matches the server, then settle into the reduced layout after mount.
  const rawReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduced = mounted ? !!rawReduced : false;
  const animate = !reduced;
  const isMobile = useIsMobile();

  // Layout only depends on the flow, travel direction and the per-proposal
  // edit overrides (renames, box order, lane names); memoise on those so the
  // machinery isn't re-laid-out (and its relay restarted) on every keystroke
  // in the control panel, which hands down a fresh config object each render.
  // The overrides are compared by value (they only change on an actual edit).
  const editsKey = JSON.stringify([
    config.nodeLabels ?? null,
    config.nodeOrder ?? null,
    config.laneLabels ?? null,
    config.platform ?? null,
    config.brandColor ?? null,
  ]);
  const layout = useMemo(
    () => (flow ? computeLayout(flow, config) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, config.direction, editsKey],
  );

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

  if (!flow || !layout) {
    return <div className="p-8 text-node-text">Unknown flow: {config.flowId}</div>;
  }

  // One unified machinery diagram per flow — the full chain, always shown and
  // scaled to fit the deck (no collapse/expand split, no horizontal pan).
  const flowTag = `Flow ${flow.displayId} · ${flow.dials.model}`;
  const machineryVB = `0 ${(layout.stageY ?? CONT_Y) - 12} ${layout.width} ${(layout.stageH ?? CONT_H) + 30}`;

  const svgStyle = {
    display: "block",
    width: "100%",
    // real Inter via next/font's hashed family — the deck look stays Inter even
    // though the app chrome moved to the DS fonts (DM Sans/Poppins).
    fontFamily: "var(--font-inter), system-ui, Arial, sans-serif",
  } as const;

  const SurfaceSvg = <HeroFlow flow={flow} config={config} />;

  const MachinerySvg = (
    <svg
      viewBox={machineryVB}
      preserveAspectRatio="xMidYMid meet"
      style={{ ...svgStyle, maxHeight: "64vh" }}
      role="img"
      aria-label={`How Trace makes it happen — ${flow.title}`}
    >
      <Defs />
      <MachineryStage layout={layout} config={config} animate={animate} showHeading={false} onPassComplete={onPassComplete} />
    </svg>
  );

  // The pill groups keep their POSITIONS (carries side first, settlement side
  // second); only the CAPTIONS follow the travel. A flow that starts in BRL
  // and settles in USD on Pay-in starts in USD and settles in BRL on Pay-out.
  const dirReversed = config.direction === "disbursement";
  const fundToggleEl = fundChoices.length > 1 && (
    <SettlementToggle
      key="fund"
      caption={dirReversed ? "Settle in" : "Starts in"}
      choices={fundChoices}
      active={Math.min(fundingIdx, fundChoices.length - 1)}
      onChange={pickFunding}
      config={config}
    />
  );
  const settleToggleEl = choices.length > 1 && (
    <SettlementToggle
      key="settle"
      caption={dirReversed ? "Starts in" : "Settle in"}
      choices={choices}
      active={Math.min(settlementIdx, choices.length - 1)}
      onChange={pickSettlement}
      config={config}
    />
  );
  const settlementToggle = (choices.length > 1 || fundChoices.length > 1) && (
    <div className="relative z-30 mb-2.5 flex w-full max-w-[1500px] flex-wrap justify-end gap-2 pr-1">
      {fundToggleEl}
      {settleToggleEl}
    </div>
  );

  // ambient: a single soft radial light + vignette over the near-black page.
  const deckGlow =
    `radial-gradient(62% 62% at 50% 46%, ${C.ambientGlow1} 0%, ${C.ambientGlow2} 58%, rgba(7,9,11,0) 100%),` +
    `radial-gradient(72% 72% at 50% 50%, rgba(7,9,11,0) 58%, ${C.vignette} 100%)`;

  // Per-proposal override first (double-click the line on the build canvas),
  // then the flow's own copy, then the direction defaults.
  const support =
    config.heroSupport?.[`${config.flowId}:${config.direction}`] ??
    (flow.heroSupport
      ? flow.heroSupport[config.direction]
      : config.direction === "collection"
        ? "Collect in Brazil, settle to their merchant abroad, in one move."
        : "Fund from abroad, pay out into Brazil, in one move.");

  const SurfaceHeading = (
    <div className="mx-auto mb-5 text-center" style={{ width: "min(36rem, calc(100vw - 2rem))" }}>
      <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8a7f] md:text-[12px] md:tracking-[0.34em]">
        The desired transaction
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.01em] text-[#f2f5f3] md:text-5xl">
        Built for <span className="text-mint">{config.clientName}</span>
      </h1>
      <p className="mt-3 text-sm font-normal text-[#8b948f] md:text-base" data-hero-support>
        {support}
      </p>
    </div>
  );

  const DepthHeading = (
    <div className="mx-auto mb-5 text-center" style={{ width: "min(36rem, calc(100vw - 2rem))" }}>
      <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted md:text-[11px] md:tracking-[0.32em]">
        Beneath the surface
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-title md:text-4xl">
        How Trace makes it happen
      </h2>
      <p className="mt-2.5 text-sm font-medium text-mint md:text-base">{clientFlowName(flow.title)}</p>
    </div>
  );

  // ── single-section static render (QA hook + future two-page mode) ────────
  if (only) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center px-6" style={{ background: deckGlow }}>
        <div className="absolute left-0 top-0 h-[3px] w-full" style={{ background: C.rule }} />
        {only === "surface" ? SurfaceHeading : DepthHeading}
        {only === "depth" && settlementToggle}
        <div className={only === "surface" ? "w-full max-w-[1200px]" : "w-full max-w-[1500px]"}>
          {only === "surface" ? SurfaceSvg : MachinerySvg}
        </div>
        <Lockup />
      </div>
    );
  }

  // ── phones: the flow re-laid-out VERTICALLY (no dive, no horizontal scroll) ──
  // Checked before reduced-motion so a reduced-motion phone still gets the
  // purpose-built mobile layout (MobileFlow honours reduced-motion internally)
  // rather than the desktop machinery scaled down to phone width.
  if (isMobile && !forceStatic) {
    return (
      <div className="w-full overflow-x-hidden px-4 pb-8 pt-2" style={{ background: deckGlow }}>
        {/* On /build there's no other Pay-in/Pay-out control on a phone; the
            shared /f/ view supplies its own toggle, so skip it in presentation. */}
        {onDirectionChange && !presentation && (
          <DirectionToggle direction={config.direction} onChange={onDirectionChange} fixed />
        )}
        {SurfaceHeading}
        {(choices.length > 1 || fundChoices.length > 1) && (
          <div className="mb-3 flex w-full flex-wrap justify-center gap-2">
            {fundToggleEl}
            {settleToggleEl}
          </div>
        )}
        {isPlatformFlow(config, config.flowId) ? (
          <div
            className="rounded-2xl p-3 pb-4"
            style={{
              border: `1px solid ${(config.platform?.color ?? config.brandColor ?? "#00f2b1")}55`,
              background: `${config.platform?.color ?? config.brandColor ?? "#00f2b1"}07`,
            }}
          >
            <MobileFlow flow={flow} config={config} />
            <p className="mt-3 text-center text-[11px] leading-normal text-muted">
              {config.platform?.caption?.trim() || `Native to the ${config.clientName} platform. Trace operates the rails underneath.`}
            </p>
          </div>
        ) : (
          <MobileFlow flow={flow} config={config} />
        )}
      </div>
    );
  }

  // ── reduced motion / print: stack the two sections, no dive ──────────────
  if (reduced || forceStatic) {
    return (
      <div className="w-full" data-flow-dive style={{ background: C.base }}>
        <div className="absolute left-0 top-0 z-10 h-[3px] w-full" style={{ background: C.rule }} />
        <section className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: deckGlow }}>
          {SurfaceHeading}
          <div className="w-full max-w-[1200px]">{SurfaceSvg}</div>
        </section>
        <section className="flex min-h-screen flex-col items-center justify-center px-6" style={{ background: deckGlow }}>
          {DepthHeading}
          {settlementToggle}
          <div className="w-full max-w-[1500px]">{MachinerySvg}</div>
        </section>
        <Lockup />
      </div>
    );
  }

  return (
    <div ref={sectionRef} data-flow-dive className="relative h-[340vh] w-full" style={{ background: C.base }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: C.base }}>
        <div className="absolute inset-0" style={{ background: deckGlow }} />
        <div className="absolute left-0 top-0 z-30 h-[3px] w-full" style={{ background: C.rule }} />

        {/* always-visible Pay-in / Pay-out toggle (build brief §5) */}
        {onDirectionChange && (
          <DirectionToggle direction={config.direction} onChange={onDirectionChange} />
        )}
        {/* flow tag, bottom-left — internal only; hidden in presentation/client views */}
        {!presentation && (
          <div className="absolute bottom-5 left-44 z-30 text-xs text-muted">{flowTag} · client view</div>
        )}

        {/* DEPTH — behind */}
        <motion.div
          style={{ opacity: depthOpacity, y: depthY, scale: depthScale, filter: depthBlur }}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-6"
        >
          <motion.div style={{ opacity: depthHeadingOpacity }}>{DepthHeading}</motion.div>
          {settlementToggle}
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
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6"
        >
          <div className="pointer-events-auto">{SurfaceHeading}</div>
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

/** The on-canvas settlement picker — same visual vocabulary as Pay-in/Pay-out.
 *  Sits right above the machinery, only when the flow offers options. */
function SettlementToggle({
  choices,
  active,
  onChange,
  config,
  caption = "Settle in",
}: {
  choices: SettlementOption[];
  active: number;
  onChange: (i: number) => void;
  config: FlowConfig;
  caption?: string;
}) {
  const labelOf = (c: SettlementOption) => {
    if (c.label?.trim()) return c.label.trim();
    const d = displayCurrency(c.out, config);
    if (d === "USDC/USDT") return config.stablecoin === "both" ? "USDC/USDT" : config.stablecoin;
    if (d === "USD/USDT" && config.stablecoin === "USDT") return "USDT";
    return d;
  };
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] backdrop-blur">
      <span className="px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">{caption}</span>
      {choices.map((c, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-pressed={active === i}
          className={`rounded-lg px-[13px] py-[5px] text-[12px] font-medium tracking-[0.2px] transition ${
            active === i ? "bg-[#46d39a24] text-[#bfe8d4]" : "text-[#8b948f] hover:text-[#bfe8d4]"
          }`}
        >
          {labelOf(c)}
        </button>
      ))}
    </div>
  );
}

function DirectionToggle({
  direction,
  onChange,
  fixed = false,
}: {
  direction: Direction;
  onChange: (d: Direction) => void;
  fixed?: boolean;
}) {
  return (
    <div className={`${fixed ? "fixed" : "absolute"} right-4 top-4 z-40 flex gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] backdrop-blur md:right-5 md:top-5`}>
      {(["collection", "disbursement"] as Direction[]).map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          aria-pressed={direction === d}
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
