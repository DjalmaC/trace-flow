"use client";
import { forwardRef, useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { computeLayout, type NodeLayout, type LegLayout } from "./layout";
import { displayCurrency } from "./FlowSvg/Tokens";
import { TraceArrow } from "./FlowSvg/TraceArrow";
import { ASSETS, C, TRACE_LOGO_AR, accentFor } from "./tokens";
import type { Currency, Flow, FlowConfig } from "../data/schema";

// Phone-native VERTICAL flow: the chain reads top -> bottom as full-width cards
// with the currency on each connector and the conversion / border crossing as a
// distinct moment. No horizontal scroll. Keeps the live details: the real Trace
// arrows (rotate + colour-tween on Pay-in/Pay-out), ONE value coin that glides
// the whole stack at a uniform pace (bright in the gaps, dimmed as it passes
// through a card), and an FX hub that spins exactly as the coin reaches it.
// Pay-in (green) flows DOWN; Pay-out (blue) flows UP. Desktop uses the SVG dive.
export function MobileFlow({ flow, config }: { flow: Flow; config: FlowConfig }) {
  const reduced = useReducedMotion();
  const layout = computeLayout(flow, config);
  const accent = accentFor(config.direction);
  // Currency/conversion semantics follow the real direction; on-screen the coin
  // travels DOWN for Pay-in (collection) and UP for Pay-out (disbursement).
  const semanticDown = config.direction === "collection";
  const travelDown = config.direction === "collection";
  const nodes = layout.nodes; // authored order (abroad/top -> Brazil/bottom)
  const legFor = (aId: string, bId: string): LegLayout | undefined =>
    layout.legs.find((l) => (l.from === aId && l.to === bId) || (l.from === bId && l.to === aId));

  // Connectors in DOM (top->bottom) order — their measured spans become the
  // "bright" windows for the gliding coin.
  const connOrder: number[] = [];
  nodes.forEach((node, i) => {
    const next = nodes[i + 1];
    if (next && legFor(node.id, next.id)) connOrder.push(i);
  });
  const segCount = connOrder.length;

  // The coin carries the foreign currency above the FX hub and BRL below it
  // (geometry is fixed; only the travel direction flips with the toggle).
  const convLeg = layout.legs.find((l) => !!l.convertsTo);
  const fallbackCur: Currency = layout.legs[0]?.carries ?? "BRL";
  const aboveDisp = displayCurrency(convLeg ? convLeg.carries : fallbackCur, config);
  const belowDisp = displayCurrency(convLeg ? convLeg.convertsTo! : fallbackCur, config);

  // ── the single coin: one looping progress drives position, brightness, spin ──
  const containerRef = useRef<HTMLDivElement>(null);
  const connRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hubRef = useRef<HTMLSpanElement>(null);
  const gapsRef = useRef<{ a: number; b: number }[]>([]); // connector spans as 0..1 fractions
  const hubFracRef = useRef<number | null>(null); // hub centre as a 0..1 fraction
  const progress = useMotionValue(0);

  useEffect(() => {
    const measure = () => {
      const c = containerRef.current;
      if (!c) return;
      const cRect = c.getBoundingClientRect();
      const H = cRect.height || 1;
      gapsRef.current = connRefs.current
        .filter((el): el is HTMLDivElement => !!el)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { a: (r.top - cRect.top) / H, b: (r.bottom - cRect.top) / H };
        });
      hubFracRef.current = hubRef.current
        ? (hubRef.current.getBoundingClientRect().top + hubRef.current.getBoundingClientRect().height / 2 - cRect.top) / H
        : null;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [config.flowId, config.direction]);

  useEffect(() => {
    if (reduced || segCount === 0) return;
    const controls = animate(progress, 1, {
      duration: Math.max(2.6, segCount * 0.72),
      ease: "linear",
      repeat: Infinity,
      repeatType: "loop",
      repeatDelay: 0.25,
    });
    return () => controls.stop();
  }, [reduced, segCount, config.flowId, progress]);

  // coin position: top->bottom on Pay-in, bottom->top on Pay-out
  const coinTop = useTransform(progress, (p) => `${(travelDown ? p : 1 - p) * 100}%`);
  // bright (1) inside a connector gap, dim (0.22) over a card; fade out at the ends
  const coinOpacity = useTransform(progress, (p) => {
    const f = travelDown ? p : 1 - p;
    let inGap = 0;
    const ramp = 0.02;
    for (const g of gapsRef.current) {
      if (f >= g.a && f <= g.b) { inGap = 1; break; }
      if (f >= g.a - ramp && f < g.a) inGap = Math.max(inGap, (f - (g.a - ramp)) / ramp);
      if (f > g.b && f <= g.b + ramp) inGap = Math.max(inGap, 1 - (f - g.b) / ramp);
    }
    const env = Math.min(1, Math.min(p, 1 - p) / 0.04); // fade in/out at the ends
    return (0.22 + 0.78 * inGap) * env;
  });
  // hub spins one turn as the coin sweeps across it, then rests
  const hubRotation = useTransform(progress, (p) => {
    const hf = hubFracRef.current;
    if (hf == null) return 0;
    const f = travelDown ? p : 1 - p;
    const W = 0.07;
    const d = (f - hf) / W;
    if (d <= -1) return 0;
    if (d >= 1) return travelDown ? 360 : -360;
    return ((d + 1) / 2) * (travelDown ? 360 : -360);
  });
  // the coin's currency label crossfades across the hub: foreign above, BRL below
  const aboveOpacity = useTransform(progress, (p) => {
    const hf = hubFracRef.current;
    if (hf == null) return 1;
    const f = travelDown ? p : 1 - p;
    const W = 0.045;
    if (f <= hf - W) return 1;
    if (f >= hf + W) return 0;
    return (hf + W - f) / (2 * W);
  });
  const belowOpacity = useTransform(progress, (p) => {
    const hf = hubFracRef.current;
    if (hf == null) return 0;
    const f = travelDown ? p : 1 - p;
    const W = 0.045;
    if (f <= hf - W) return 0;
    if (f >= hf + W) return 1;
    return (f - (hf - W)) / (2 * W);
  });

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-md">
      {/* continuous rail behind the cards */}
      <span className="pointer-events-none absolute left-1/2 top-7 bottom-7 z-0 w-px -translate-x-1/2" style={{ background: "rgba(255,255,255,0.10)" }} />

      {/* the single gliding value coin — labelled, converting across the hub */}
      {!reduced && segCount > 0 && (
        <motion.span
          className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
          style={{ top: coinTop, opacity: coinOpacity }}
        >
          <span className="grid place-items-center">
            <motion.span style={{ gridArea: "1 / 1", opacity: aboveOpacity }}>
              <CoinChip currency={aboveDisp} config={config} accent={accent} />
            </motion.span>
            <motion.span style={{ gridArea: "1 / 1", opacity: belowOpacity }}>
              <CoinChip currency={belowDisp} config={config} accent={accent} />
            </motion.span>
          </span>
        </motion.span>
      )}

      {nodes.map((node, i) => {
        const next = nodes[i + 1];
        const leg = next ? legFor(node.id, next.id) : undefined;
        const ord = connOrder.indexOf(i);
        const isConv = !!leg?.convertsTo;
        return (
          <div key={node.id} className="relative z-10">
            <NodeCard node={node} primary={node.id === layout.primaryClientId} config={config} />
            {leg && next && (
              <Connector
                ref={(el) => { connRefs.current[ord] = el; }}
                leg={leg}
                topLane={node.lane}
                botLane={next.lane}
                config={config}
                accent={accent}
                reduced={!!reduced}
                semanticDown={semanticDown}
                hubRef={isConv ? hubRef : undefined}
                hubRotation={isConv ? hubRotation : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NodeCard({ node, primary, config }: { node: NodeLayout; primary: boolean; config: FlowConfig }) {
  const lane = node.lane === "brazil" ? "Brasil" : "Abroad";
  const hasLogo = primary && !!config.clientLogoUrl;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-2.5"
      style={{
        background: primary ? "#0f1814" : C.surface,
        borderColor: primary ? "rgba(70,211,154,0.40)" : "rgba(255,255,255,0.10)",
      }}
    >
      {hasLogo ? (
        config.clientLogoPlate === "light" ? (
          <span className="flex shrink-0 items-center rounded-md bg-white px-1.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.clientLogoUrl} alt="" className="h-5 w-auto max-w-[88px] object-contain" />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.clientLogoUrl} alt="" className="h-6 w-auto max-w-[96px] shrink-0 object-contain" />
        )
      ) : node.kind === "trace" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ASSETS.traceLogo} alt="" className="shrink-0 opacity-90" style={{ height: 18, width: 18 * TRACE_LOGO_AR }} />
      ) : (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: C.subtitle }}
        >
          {node.label.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug" style={{ color: C.title }}>
        {node.label}
      </div>

      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
        {lane}
      </span>
    </div>
  );
}

const Connector = forwardRef<
  HTMLDivElement,
  {
    leg: LegLayout;
    topLane: string;
    botLane: string;
    config: FlowConfig;
    accent: string;
    reduced: boolean;
    semanticDown: boolean;
    hubRef?: React.Ref<HTMLSpanElement>;
    hubRotation?: MotionValue<number>;
  }
>(function Connector({ leg, topLane, botLane, config, accent, reduced, semanticDown, hubRef, hubRotation }, ref) {
  const isConv = !!leg.convertsTo;
  // currency in the value-flow direction (Pay-in: carries -> convertsTo)
  const fromCur: Currency = isConv ? (semanticDown ? leg.carries : leg.convertsTo!) : leg.carries;
  const toCur: Currency = isConv ? (semanticDown ? leg.convertsTo! : leg.carries) : leg.carries;
  const crossing = topLane !== botLane;
  const intoLane = (semanticDown ? botLane : topLane) === "brazil" ? "Brasil 🇧🇷" : "Abroad";

  return (
    <div ref={ref} className="relative flex flex-col items-center justify-center" style={{ minHeight: 58 }}>
      <div className="relative z-10 flex flex-col items-center py-2">
        <VArrow direction={config.direction} accent={accent} />
        {isConv ? (
          <div className="mt-1 flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: "#0e1410", border: "1px solid rgba(70,211,154,0.30)" }}>
            {reduced || !hubRotation ? (
              <span ref={hubRef} className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "#0b110d", border: `1px solid ${accent}55` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ASSETS.traceLogo} alt="" style={{ height: 12, width: 12 * TRACE_LOGO_AR }} />
              </span>
            ) : (
              <motion.span
                ref={hubRef}
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: "#0b110d", border: `1px solid ${accent}55`, rotate: hubRotation }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ASSETS.traceLogo} alt="" style={{ height: 12, width: 12 * TRACE_LOGO_AR }} />
              </motion.span>
            )}
            <CurChip currency={displayCurrency(fromCur, config)} config={config} />
            <span style={{ color: accent }}>→</span>
            <CurChip currency={displayCurrency(toCur, config)} config={config} />
          </div>
        ) : (
          <div className="mt-1">
            <CurChip currency={displayCurrency(fromCur, config)} config={config} />
          </div>
        )}
        {crossing && (
          <div className="mt-1.5 flex w-full items-center gap-2 px-6">
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.10)" }} />
            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: C.subtitle }}>
              into {intoLane}
            </span>
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.10)" }} />
          </div>
        )}
      </div>
    </div>
  );
});

// The real Trace arrow (mark-half), pointing DOWN (Pay-in) / up (Pay-out) — it
// rotates + colour-tweens on toggle. The +90° wrapper + TraceArrow's own inner
// rotation (0° collection / 180° disbursement) net out to down / up, and the
// inner 0°↔180° tween animates the swing on toggle.
function VArrow({ direction, accent }: { direction: FlowConfig["direction"]; accent: string }) {
  return (
    <span className="inline-flex" style={{ transform: "rotate(90deg)" }}>
      <TraceArrow cx={9} cy={9} size={16} direction={direction} color={accent} />
    </span>
  );
}

// The travelling money: a bright accent pill (or the stablecoin) that reads as
// the value in motion, distinct from the dim static leg labels.
function CoinChip({ currency, config, accent }: { currency: Currency; config: FlowConfig; accent: string }) {
  if (currency === "USDC/USDT") {
    const coin = config.stablecoin === "USDC" ? ASSETS.usdc : ASSETS.usdt;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={coin} alt="" className="h-5 w-5 rounded-full" style={{ boxShadow: `0 0 14px 2px ${accent}` }} />
    );
  }
  return (
    <span
      className="block whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
      style={{ background: accent, color: "#06120d", boxShadow: `0 0 16px 3px ${accent}` }}
    >
      {currency}
    </span>
  );
}

function CurChip({ currency, config }: { currency: Currency; config: FlowConfig }) {
  if (currency === "USDC/USDT") {
    const coin = config.stablecoin;
    return (
      <span className="inline-flex items-center gap-0.5">
        {coin !== "USDT" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ASSETS.usdc} alt="USDC" className="h-4 w-4" />
        )}
        {coin !== "USDC" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ASSETS.usdt} alt="USDT" className="h-4 w-4" />
        )}
      </span>
    );
  }
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-0.5 font-mono text-[12px] font-medium"
      style={{ background: "#1a221e", border: "1px solid rgba(255,255,255,0.10)", color: "#d6ddd8" }}
    >
      {currency}
    </span>
  );
}
