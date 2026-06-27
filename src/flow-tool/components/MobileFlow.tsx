"use client";
import { motion, useReducedMotion } from "framer-motion";
import { computeLayout, type NodeLayout, type LegLayout } from "./layout";
import { displayCurrency } from "./FlowSvg/Tokens";
import { TraceArrow } from "./FlowSvg/TraceArrow";
import { ASSETS, C, TRACE_LOGO_AR, accentFor } from "./tokens";
import type { Currency, Flow, FlowConfig } from "../data/schema";

// Phone-native VERTICAL flow: the chain reads top -> bottom as full-width cards
// with the currency on each connector and the conversion / border crossing as a
// distinct moment. No horizontal scroll. Keeps the live details: the real Trace
// arrows (rotate + colour-tween on Pay-in/Pay-out), plus a value token that
// RELAYS down the rail one connector at a time and an FX hub that spins ONLY as
// the token reaches it. Desktop uses the SVG dive instead.
const SEG = 0.8; // seconds the token spends crossing one connector
const PAUSE = 0.7; // beat between cycles

export function MobileFlow({ flow, config }: { flow: Flow; config: FlowConfig }) {
  const reduced = useReducedMotion();
  const layout = computeLayout(flow, config);
  const accent = accentFor(config.direction);
  // Pay-in (green/collection) flows DOWN the stack; Pay-out (blue/disbursement)
  // flows UP. Arrows + travel + currency semantics all follow this same sense.
  const semanticDown = config.direction === "collection";
  const travelDown = config.direction === "collection";
  const nodes = layout.nodes; // authored order; direction is shown via arrows + token
  const legFor = (aId: string, bId: string): LegLayout | undefined =>
    layout.legs.find((l) => (l.from === aId && l.to === bId) || (l.from === bId && l.to === aId));

  // The connectors, in DOM (top->bottom) order — used to schedule the relay so
  // the token hands off from one connector to the next with no gap.
  const connOrder: number[] = [];
  nodes.forEach((node, i) => {
    const next = nodes[i + 1];
    if (next && legFor(node.id, next.id)) connOrder.push(i);
  });
  const segCount = connOrder.length;
  const cycle = segCount * SEG + PAUSE;

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* continuous rail behind the cards */}
      <span className="pointer-events-none absolute left-1/2 top-7 bottom-7 z-0 w-px -translate-x-1/2" style={{ background: "rgba(255,255,255,0.10)" }} />

      {nodes.map((node, i) => {
        const next = nodes[i + 1];
        const leg = next ? legFor(node.id, next.id) : undefined;
        const ord = connOrder.indexOf(i); // this connector's place in the relay
        return (
          <div key={node.id} className="relative z-10">
            <NodeCard node={node} primary={node.id === layout.primaryClientId} config={config} />
            {leg && next && (
              <Connector
                leg={leg}
                topLane={node.lane}
                botLane={next.lane}
                config={config}
                accent={accent}
                reduced={!!reduced}
                semanticDown={semanticDown}
                travelDown={travelDown}
                ord={ord}
                segCount={segCount}
                cycle={cycle}
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

function Connector({
  leg,
  topLane,
  botLane,
  config,
  accent,
  reduced,
  semanticDown,
  travelDown,
  ord,
  segCount,
  cycle,
}: {
  leg: LegLayout;
  topLane: string;
  botLane: string;
  config: FlowConfig;
  accent: string;
  reduced: boolean;
  semanticDown: boolean;
  travelDown: boolean;
  ord: number;
  segCount: number;
  cycle: number;
}) {
  const isConv = !!leg.convertsTo;
  // currency in the value-flow direction (Pay-in: carries -> convertsTo)
  const fromCur: Currency = isConv ? (semanticDown ? leg.carries : leg.convertsTo!) : leg.carries;
  const toCur: Currency = isConv ? (semanticDown ? leg.convertsTo! : leg.carries) : leg.carries;
  const crossing = topLane !== botLane;
  const intoLane = (semanticDown ? botLane : topLane) === "brazil" ? "Brasil 🇧🇷" : "Abroad";

  // Relay timing: the token enters this connector when value reaches it. Whichever
  // end the travel starts from fires first (Pay-in rises, so the bottom connector
  // leads; Pay-out descends, so the top one does).
  const fireDelay = (travelDown ? ord : segCount - 1 - ord) * SEG;
  const tokenTransition = {
    duration: SEG,
    times: [0, 0.18, 0.82, 1],
    ease: "linear" as const,
    repeat: Infinity,
    repeatDelay: cycle - SEG,
    delay: fireDelay,
  };
  // The hub spins exactly one turn as the token crosses it, then rests.
  const spinTransition = {
    duration: SEG,
    ease: "easeInOut" as const,
    repeat: Infinity,
    repeatDelay: cycle - SEG,
    delay: fireDelay,
  };

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ minHeight: 58 }}>
      {/* the value token, relaying down the rail (above the rail, in the gap) */}
      {!reduced && (
        <motion.span
          className="pointer-events-none absolute left-1/2 z-20"
          style={{ transform: "translateX(-50%)" }}
          initial={{ opacity: 0, top: travelDown ? "-8%" : "108%" }}
          animate={{ top: travelDown ? ["-8%", "108%"] : ["108%", "-8%"], opacity: [0, 1, 1, 0] }}
          transition={tokenTransition}
        >
          <MovingToken currency={displayCurrency(fromCur, config)} config={config} accent={accent} />
        </motion.span>
      )}

      <div className="relative z-10 flex flex-col items-center py-2">
        <VArrow direction={config.direction} accent={accent} />
        {isConv ? (
          <div className="mt-1 flex items-center gap-2 rounded-xl px-3 py-1.5" style={{ background: "#0e1410", border: "1px solid rgba(70,211,154,0.30)" }}>
            {reduced ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "#0b110d", border: `1px solid ${accent}55` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ASSETS.traceLogo} alt="" style={{ height: 12, width: 12 * TRACE_LOGO_AR }} />
              </span>
            ) : (
              <motion.span
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: "#0b110d", border: `1px solid ${accent}55` }}
                initial={{ rotate: 0 }}
                animate={{ rotate: travelDown ? 360 : -360 }}
                transition={spinTransition}
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
}

// The travelling value: the actual stablecoin when the leg carries one, else a
// glowing accent bead. Either way it visibly moves down the rail.
function MovingToken({ currency, config, accent }: { currency: Currency; config: FlowConfig; accent: string }) {
  if (currency === "USDC/USDT") {
    const coin = config.stablecoin === "USDC" ? ASSETS.usdc : ASSETS.usdt;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={coin} alt="" className="h-5 w-5 rounded-full" style={{ boxShadow: `0 0 14px 2px ${accent}` }} />
    );
  }
  return <span className="block rounded-full" style={{ height: 12, width: 12, background: accent, boxShadow: `0 0 16px 3px ${accent}` }} />;
}

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
