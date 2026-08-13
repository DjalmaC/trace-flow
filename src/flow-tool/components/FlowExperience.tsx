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
import { applySettlement, clientFlowName, directionLabel, directionOptions, fundingChoices, isPlatformFlow, settlementChoices } from "../data/schema";
import { getFlow } from "../data";
import { computeLayout, CONT_Y, CONT_H } from "./layout";
import { Defs, displayCurrency } from "./FlowSvg";
import { HeroFlow } from "./HeroFlow";
import { MachineryStage } from "./MachineryStage";
import { HubStage } from "./HubStage";
import { NettingStage } from "./NettingStage";
import { ASSETS, C, TRACE_LOGO_AR } from "./tokens";
import { MobileFlow } from "./MobileFlow";
import { glassStyle, SpecularEdge } from "./Glass";
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
  editable = false,
  skin,
  architecture,
  panelSlots,
}: {
  config: FlowConfig;
  presentation?: boolean;
  /** Render a single section statically (QA / the future two-page option). */
  only?: "surface" | "depth";
  /** Wires the always-visible on-canvas Pay-in / Pay-out toggle. */
  onDirectionChange?: (d: Direction) => void;
  /** Force the stacked, non-dive layout (used for print / PDF export). */
  forceStatic?: boolean;
  /** Build canvas only: show the "add a note" placeholder for the per-flow
   *  comment when none is set. The client view never shows the placeholder. */
  editable?: boolean;
  /** "glass" (the shared /f/ link): the page goes transparent over the silk
   *  backdrop and the flow floats on a liquid-glass panel. Purely
   *  presentational — the dive, layers and interactions are untouched. */
  skin?: "glass";
  /** "panels" (the shared /f/ link, desktop): the BRLT deck architecture —
   *  the surface story and the machinery live in two stacked liquid-glass
   *  panels in one natural page scroll (no dive). The flow diagrams, their
   *  animations and every interaction render exactly as everywhere else. */
  architecture?: "panels";
  /** Panel-architecture slots, provided by the shared view: the top controls
   *  row (variant tabs + direction pills), the pricing rail, and the closing
   *  rep-contact row at the bottom of the machinery panel. `railPosition`
   *  "below" moves dense pricing under the canvas into its own section —
   *  reserved for pricing tall enough to crowd or scroll the side rail. */
  panelSlots?: { controls?: React.ReactNode; rail?: React.ReactNode; railPosition?: "beside" | "below"; closing?: React.ReactNode };
}) {
  const glass = skin === "glass";
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
    config.nodeBranded ?? null,
    config.nodePartner ?? null,
    config.partnerLogoUrl ?? null,
    config.nodeBankLogo ?? null,
    config.bankLogoUrl ?? null,
  ]);
  const layout = useMemo(
    () => (flow ? computeLayout(flow, config) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, config.direction, editsKey],
  );

  const sectionRef = useRef<HTMLDivElement>(null);
  // "panels" architecture: the machinery panel the surface strip scrolls to.
  const howRef = useRef<HTMLDivElement>(null);
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
      // glass dive: the stage lives INSIDE the inset panel, so its height
      // budget is the panel's, not the viewport's
      style={{ ...svgStyle, maxHeight: glass && !architecture ? "min(58vh, calc(100vh - 400px))" : "64vh" }}
      role="img"
      aria-label={`How Trace makes it happen — ${flow.title}`}
    >
      <Defs />
      {flow.archetype === "hub" ? (
        <HubStage layout={layout} config={config} animate={animate} />
      ) : flow.archetype === "netting" ? (
        <NettingStage layout={layout} config={config} animate={animate} showHeading={false} />
      ) : (
        <MachineryStage layout={layout} config={config} animate={animate} showHeading={false} onPassComplete={onPassComplete} />
      )}
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
  // Glass skin: a section reads as a liquid-glass panel — the pure mock recipe,
  // no deck vignette (the silk plate provides the ambience through the blur).
  const glassSection = glass ? { ...glassStyle } : undefined;

  // Per-proposal override first (double-click the line on the build canvas),
  // then the flow's own copy, then the direction defaults.
  const support =
    config.heroSupport?.[`${config.flowId}:${config.direction}`] ??
    (flow.heroSupport
      ? flow.heroSupport[config.direction]
      : config.direction === "collection"
        ? "Collect in Brazil, settle to their merchant abroad, in one move."
        : "Fund from abroad, pay out into Brazil, in one move.");

  // Per-flow explanatory note (optional), shown under the depth heading to
  // situate the viewer. Double-click editable on the build canvas.
  const flowComment = config.comments?.[config.flowId]?.trim();


  const SurfaceHeading = (
    // width min(…, 100%): sized by the PARENT, so the heading never overflows
    // the inset glass panel on phones (100vw ignores the panel's margins).
    <div className="mx-auto mb-5 w-full text-center" style={{ maxWidth: "36rem" }}>
      <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#6f8a7f] md:text-[12px] md:tracking-[0.34em]">
        The desired transaction
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.01em] text-[#f2f5f3] md:text-5xl">
        Built for <ClientMark config={config} />
      </h1>
      <p className="mt-3 text-[15px] font-normal leading-relaxed text-[#8b948f] md:text-base" data-hero-support>
        {support}
      </p>
    </div>
  );

  const DepthHeading = (
    <div className="mx-auto mb-5 flex w-full flex-col items-center text-center" style={{ maxWidth: "54rem" }}>
      <div className="w-full" style={{ maxWidth: "36rem" }}>
        <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-muted md:text-[11px] md:tracking-[0.32em]">
          Beneath the surface
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] text-title md:text-4xl">
          How Trace makes it happen
        </h2>
        <p className="mt-2.5 text-sm font-medium text-mint md:text-base">{clientFlowName(flow.title)}</p>
      </div>
      {(flowComment || editable) && (
        <div data-flow-comment className="mt-3 max-h-[26vh] w-full overflow-y-auto text-[13.5px] leading-relaxed text-subtitle">
          {flowComment ? (
            <NoteBody text={flowComment} />
          ) : (
            <span className="mx-auto block max-w-[40rem] cursor-text rounded-md border border-dashed border-white/12 px-3 py-1.5 text-[12.5px] italic text-muted/70">
              Double-click to add a note that situates the viewer
            </span>
          )}
        </div>
      )}
    </div>
  );

  // ── single-section static render (QA hook + future two-page mode) ────────
  if (only) {
    return (
      <div
        className={`relative flex min-h-screen w-full flex-col items-center justify-center px-6 ${glass ? "overflow-hidden" : ""}`}
        style={glassSection ?? { background: deckGlow }}
      >
        {glass ? <SpecularEdge /> : <div className="absolute left-0 top-0 h-[3px] w-full" style={{ background: C.rule }} />}
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
      <div
        className={`w-full overflow-x-hidden px-4 pb-7 pt-5 ${glass ? "relative" : ""}`}
        style={glassSection ? { ...glassSection, borderRadius: 24, margin: "12px 12px 24px", width: "auto" } : { background: deckGlow }}
      >
        {glass && <SpecularEdge />}
        {/* On /build there's no other Pay-in/Pay-out control on a phone; the
            shared /f/ view supplies its own toggle, so skip it in presentation. */}
        {onDirectionChange && !presentation && (
          <DirectionToggle direction={config.direction} onChange={onDirectionChange} options={directionOptions(config, config.flowId)} fixed />
        )}
        {SurfaceHeading}
        {flowComment && (
          <div className="mx-auto mb-4 max-w-[34rem] text-center text-[14px] leading-relaxed text-subtitle">
            <NoteBody text={flowComment} />
          </div>
        )}
        {(choices.length > 1 || fundChoices.length > 1) && (
          <div className="mb-4 flex w-full flex-wrap justify-center gap-2">
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
            <p className="mt-3 text-center text-[12px] leading-normal text-muted">
              {config.platform?.caption?.trim() || `Native to the ${config.clientName} platform. Trace operates the rails underneath.`}
            </p>
          </div>
        ) : flow.archetype === "hub" || flow.archetype === "netting" ? (
          // Hub/netting diagrams are wide by nature; squeezed to phone width
          // they turn illegible. Render near design size in a swipeable pan.
          <MobileWidePan>{MachinerySvg}</MobileWidePan>
        ) : (
          <MobileFlow flow={flow} config={config} />
        )}
      </div>
    );
  }

  // ── "panels" architecture (shared /f/ link, desktop): the BRLT deck shell.
  // Two stacked liquid-glass panels in one natural scroll — the surface story
  // with the pricing rail beside it, then the machinery panel. The diagrams
  // and their animations are the same SVGs the dive renders; only the shell
  // around them changed. Below 1000px the rail drops under the canvas
  // (globals.css .tf-panel/.tf-rail rules, mirroring the mock).
  if (architecture === "panels") {
    const goHow = () => howRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    const eyebrow = `${clientFlowName(flow.title)} · ${directionLabel(config.direction, config, config.flowId)}`;
    const rail = panelSlots?.rail;
    const railBelow = panelSlots?.railPosition === "below";
    // Tiny tailored flows don't earn a second panel. A 2-station machinery IS
    // the desired transaction (skip "Beneath the surface" entirely); a
    // 3-station one is small enough to join the top panel under the hero. The
    // rep-contact row gets its own small panel when the machinery panel goes.
    const machNodes = layout.nodes.filter((n) => n.kind !== "engine").length;
    const branched = layout.legs.some((l) => l.offTrunk);
    const tinyFlow = flow.archetype == null && !branched && machNodes <= 2;
    const inlineMach = flow.archetype == null && !branched && machNodes === 3;
    const showDepthPanel = !tinyFlow && !inlineMach;
    return (
      <div className="w-full px-4 md:px-11">
        {/* Panel 1 — the desired transaction; pricing rides beside it, or
            takes its own section below when it's too tall for the rail */}
        <div
          className={`tf-panel tf-rise relative grid overflow-hidden ${railBelow ? "tf-below" : ""}`}
          style={{
            ...glassStyle,
            gridTemplateColumns: rail && !railBelow ? "minmax(0,1fr) minmax(300px,380px)" : "minmax(0,1fr)",
            minHeight: "calc(100vh - 190px)",
          }}
        >
          <SpecularEdge />
          <div className="relative flex min-w-0 flex-col px-8 pb-0 pt-6" onDoubleClick={goHow}>
            {panelSlots?.controls && (
              <div className="no-print flex flex-none flex-wrap items-center justify-between gap-4">{panelSlots.controls}</div>
            )}
            <div className="flex min-h-0 flex-1 flex-col justify-center py-7">
              <div className="font-jbmono text-[11px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">{eyebrow}</div>
              <h1 className="mt-3 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#eef1ee]">
                Built for <ClientMark config={config} />
              </h1>
              <p className="mt-3 max-w-[560px] text-[14.5px] leading-[1.55] text-subtitle" data-hero-support>
                {support}
              </p>
              {/* the machinery panel's note moves up here when that panel goes */}
              {!showDepthPanel && flowComment && (
                <div data-flow-comment className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed text-subtitle">
                  <NoteBody text={flowComment} />
                </div>
              )}
              <div className="mt-2.5">{SurfaceSvg}</div>
              {/* small flows: the full machinery joins the top panel — no scroll */}
              {inlineMach && (
                <div className="mt-4 flex flex-col items-center">
                  {settlementToggle}
                  <div className="w-full">{MachinerySvg}</div>
                </div>
              )}
            </div>
            {showDepthPanel && (
              <button
                onClick={goHow}
                className="no-print -mx-8 flex flex-none items-center justify-between gap-5 border-t border-white/[.12] bg-[rgba(10,17,13,.35)] px-8 py-3.5 text-left transition duration-200 ease-ds hover:bg-[rgba(19,32,26,.5)]"
              >
                <span className="font-jbmono text-[11px] font-medium uppercase tracking-[0.34em] text-[#bfe8d4]">
                  Beneath the surface · how Trace makes it happen
                </span>
                <span className="text-[14px] text-mint">↓</span>
              </button>
            )}
          </div>
          {rail && (
            <div className="tf-rail relative box-border flex scroll-mt-[96px] flex-col border-l border-white/[.14] bg-[rgba(7,11,9,.4)] px-7 pb-6 pt-7">
              {rail}
            </div>
          )}
        </div>

        {/* Panel 2 — beneath the surface: the full machinery */}
        {/* scroll-mt clears the stuck header banner (~80px) so "How Trace
            makes it happen" lands fully visible below it */}
        {showDepthPanel ? (
          <div ref={howRef} data-flow-dive className="tf-rise relative mt-8 scroll-mt-[96px] overflow-hidden px-8 pb-7 pt-9 md:px-10" style={glassStyle}>
            <SpecularEdge />
            <div className="font-jbmono text-[11px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">Beneath the surface</div>
            <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.01em] text-[#eef1ee]">How Trace makes it happen</h2>
            <p className="mt-2 text-sm font-medium text-mint">{clientFlowName(flow.title)}</p>
            {flowComment && (
              <div data-flow-comment className="mt-2.5 max-w-[640px] text-[13.5px] leading-relaxed text-subtitle">
                <NoteBody text={flowComment} />
              </div>
            )}
            <div className="mt-2 flex flex-col items-center">
              {settlementToggle}
              <div className="w-full">{MachinerySvg}</div>
            </div>
            {panelSlots?.closing && <div className="mt-6 border-t border-white/[.12] pt-6">{panelSlots.closing}</div>}
          </div>
        ) : (
          panelSlots?.closing && (
            <div className="tf-rise relative mt-8 overflow-hidden px-8 py-7 md:px-10" style={glassStyle}>
              <SpecularEdge />
              {panelSlots.closing}
            </div>
          )
        )}
      </div>
    );
  }

  // ── reduced motion / print: stack the two sections, no dive ──────────────
  if (reduced || forceStatic) {
    const sectionCls = `flex min-h-screen flex-col items-center justify-center px-6 ${glass ? "relative mx-6 my-8 overflow-hidden" : ""}`;
    return (
      <div className="w-full" data-flow-dive style={{ background: glass ? "transparent" : C.base }}>
        {!glass && <div className="absolute left-0 top-0 z-10 h-[3px] w-full" style={{ background: C.rule }} />}
        <section className={sectionCls} style={glassSection ?? { background: deckGlow }}>
          {glass && <SpecularEdge />}
          {SurfaceHeading}
          <div className="w-full max-w-[1200px]">{SurfaceSvg}</div>
        </section>
        <section className={sectionCls} style={glassSection ?? { background: deckGlow }}>
          {glass && <SpecularEdge />}
          {DepthHeading}
          {settlementToggle}
          <div className="w-full max-w-[1500px]">{MachinerySvg}</div>
        </section>
        <Lockup />
      </div>
    );
  }

  return (
    <div ref={sectionRef} data-flow-dive className="relative h-[340vh] w-full" style={{ background: glass ? "transparent" : C.base }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: glass ? "transparent" : C.base }}>
        {glass ? (
          /* the liquid-glass canvas the dive floats on — inset so the silk
             backdrop frames it, below the fixed header and download chrome */
          <div className="absolute inset-x-6 bottom-14 top-[76px] overflow-hidden" style={glassSection}>
            <SpecularEdge />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: deckGlow }} />
        )}
        {!glass && <div className="absolute left-0 top-0 z-30 h-[3px] w-full" style={{ background: C.rule }} />}

        {/* always-visible Pay-in / Pay-out toggle (build brief §5) */}
        {onDirectionChange && (
          <DirectionToggle direction={config.direction} onChange={onDirectionChange} options={directionOptions(config, config.flowId)} />
        )}
        {/* flow tag, bottom-left — internal only; hidden in presentation/client views */}
        {!presentation && (
          <div className="absolute bottom-5 left-44 z-30 text-xs text-muted">{flowTag} · client view</div>
        )}

        {/* DEPTH — behind */}
        <motion.div
          style={{ opacity: depthOpacity, y: depthY, scale: depthScale, filter: depthBlur }}
          className={`absolute z-10 flex flex-col items-center justify-center ${glass ? "inset-x-0 bottom-14 top-[76px] px-14" : "inset-0 px-6"}`}
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
          className={`pointer-events-none absolute z-20 flex flex-col items-center justify-center ${glass ? "inset-x-0 bottom-14 top-[76px] px-14" : "inset-0 px-6"}`}
        >
          <div className="pointer-events-auto">{SurfaceHeading}</div>
          <div className="w-full max-w-[1200px]">{SurfaceSvg}</div>
        </motion.div>

        <motion.div
          style={{ opacity: hintOpacity }}
          className={`pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 text-center ${glass ? "bottom-[72px]" : "bottom-9"}`}
        >
          <div className="mb-1.5 text-sm font-medium tracking-wide text-subtitle">Explore the full flow below</div>
          <div className="animate-bounce text-2xl leading-none text-green-accent">↓</div>
        </motion.div>

        <Lockup />
      </div>
    </div>
  );
}

/** Phone shell for the wide hub/netting stages: the diagram keeps a readable
 *  size and the viewer pans it horizontally. Starts centered on the hub, edge
 *  fades signal the overflow, and a one-line hint invites the swipe. */
function MobileWidePan({ children }: { children: React.ReactNode }) {
  const panRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panRef.current;
    if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, []);
  return (
    <div className="relative -mx-4">
      <div ref={panRef} className="tf-noscrollbar overflow-x-auto px-4" style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ width: 780 }}>{children}</div>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-7"
        style={{ background: "linear-gradient(90deg, rgba(8,12,10,.6), rgba(8,12,10,0))" }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-7"
        style={{ background: "linear-gradient(270deg, rgba(8,12,10,.6), rgba(8,12,10,0))" }}
      />
      <div className="mt-2 text-center text-[12px] font-medium tracking-wide text-muted">Swipe sideways to explore the full flow</div>
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
          className={`min-h-[44px] rounded-lg px-[13px] py-2 text-[13px] font-medium tracking-[0.2px] transition md:min-h-0 md:py-[5px] md:text-[12px] ${
            active === i ? "bg-[#46d39a24] text-[#bfe8d4]" : "text-[#8b948f] hover:text-[#bfe8d4]"
          }`}
        >
          {labelOf(c)}
        </button>
      ))}
    </div>
  );
}

// A flow note: one line per line of text. Lines starting with "- ", "* " or
// "• " render as bullets (left-aligned block, centred as a whole); otherwise
// it's a plain multi-line paragraph with the breaks preserved.
const BULLET_RE = /^[-*•]\s+/;
function NoteBody({ text }: { text: string }) {
  // Blocks split on a blank line (a paragraph break the rep typed); within a
  // block, single newlines are kept. Blank lines are preserved as spacing
  // instead of being collapsed away.
  const blocks = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s+$/, ""))
    .filter((b) => b.trim());
  const lines = blocks.flatMap((b) => b.split(/\n/)).map((l) => l.trim()).filter(Boolean);
  const asBullets = lines.length > 1 && lines.some((l) => BULLET_RE.test(l));
  // Plain prose: render each paragraph as its own block with a gap between,
  // preserving single breaks within a paragraph.
  if (!asBullets)
    return (
      <span className="mx-auto block max-w-[40rem]">
        {blocks.map((b, i) => (
          <span
            key={i}
            className="block"
            style={{ whiteSpace: "pre-line", marginTop: i ? "0.6em" : 0 }}
          >
            {b.split(/\n/).map((l) => l.trim()).filter(Boolean).join("\n")}
          </span>
        ))}
      </span>
    );
  // Bullets: hanging indent (wrapped text lines up under the text, not the
  // dot); two columns once the list gets long so it stays short vertically.
  const twoCol = lines.length > 4;
  const Item = (l: string, i: number) =>
    BULLET_RE.test(l) ? (
      <li key={i} className="flex gap-2">
        <span className="mt-[3px] h-[3px] w-[3px] shrink-0 rounded-full bg-mint" />
        <span className="min-w-0">{l.replace(BULLET_RE, "")}</span>
      </li>
    ) : (
      <li key={i} className="min-w-0">{l}</li>
    );
  return (
    <ul
      className={
        twoCol
          ? "mx-auto block w-full max-w-[52rem] columns-2 gap-x-9 text-left [&>li]:mb-2 [&>li]:break-inside-avoid"
          : "mx-auto flex w-fit max-w-[40rem] flex-col gap-1.5 text-left"
      }
    >
      {lines.map(Item)}
    </ul>
  );
}

function DirectionToggle({
  direction,
  onChange,
  options,
  fixed = false,
}: {
  direction: Direction;
  onChange: (d: Direction) => void;
  /** Ordered [Pay-in, Pay-out] with each label bound to its direction for this
   *  flow (see FlowConfig.swapDirections). */
  options: { value: Direction; label: string }[];
  fixed?: boolean;
}) {
  return (
    <div className={`${fixed ? "fixed" : "absolute"} right-4 top-4 z-40 flex gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] backdrop-blur md:right-5 md:top-5`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={direction === o.value}
          className={`rounded-lg tracking-[0.2px] transition ${fixed ? "px-4 py-2 text-[13px]" : "px-[15px] py-[6px] text-[12.5px]"} font-medium ${
            direction === o.value ? "bg-[#46d39a24] text-[#bfe8d4]" : "text-[#8b948f] hover:text-[#bfe8d4]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
function ClientMark({ config }: { config: FlowConfig }) {
  const name = config.clientName.trim();
  if (name) return <span className="text-mint">{name}</span>;
  const src = config.clientLogoUrl;
  if (!src) return <span className="text-mint">you</span>;
  if (config.clientLogoPlate === "light")
    return (
      <span className="inline-flex translate-y-[0.1em] items-center rounded-[0.28em] bg-white px-[0.34em] py-[0.16em] align-baseline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-[0.62em] w-auto max-w-[7.5em] object-contain" />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="inline-block h-[0.88em] w-auto max-w-[8.5em] object-contain align-[-0.08em]" />;
}
