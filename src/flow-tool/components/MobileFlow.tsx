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
// arrows (rotate + colour-tween on Pay-in/Pay-out), a value token flowing down
// the rail, and the FX hub spinning. Desktop uses the SVG dive instead.
export function MobileFlow({ flow, config }: { flow: Flow; config: FlowConfig }) {
  const reduced = useReducedMotion();
  const layout = computeLayout(flow, config);
  const accent = accentFor(config.direction);
  const down = config.direction === "collection"; // value flows top->bottom on Pay-in
  const nodes = layout.nodes; // authored order; direction is shown via arrows + token, not reorder
  const legFor = (aId: string, bId: string): LegLayout | undefined =>
    layout.legs.find((l) => (l.from === aId && l.to === bId) || (l.from === bId && l.to === aId));

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* continuous rail behind the cards */}
      <span className="pointer-events-none absolute left-1/2 top-7 bottom-7 z-0 w-px -translate-x-1/2" style={{ background: "rgba(255,255,255,0.10)" }} />
      {/* a value token flowing along the rail (hidden behind the cards, seen in the gaps) */}
      {!reduced && (
        <motion.span
          className="pointer-events-none absolute left-1/2 z-0 -translate-x-1/2 rounded-full"
          style={{ height: 9, width: 9, background: accent, boxShadow: `0 0 12px 1px ${accent}` }}
          initial={false}
          animate={{ top: down ? ["4%", "96%"] : ["96%", "4%"], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 3.6, times: [0, 0.1, 0.9, 1], ease: "linear", repeat: Infinity, repeatDelay: 0.2 }}
        />
      )}

      {nodes.map((node, i) => {
        const next = nodes[i + 1];
        const leg = next ? legFor(node.id, next.id) : undefined;
        return (
          <div key={node.id} className="relative z-10">
            <NodeCard node={node} primary={node.id === layout.primaryClientId} config={config} />
            {leg && next && (
              <Connector leg={leg} topLane={node.lane} botLane={next.lane} config={config} accent={accent} reduced={!!reduced} />
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
}: {
  leg: LegLayout;
  topLane: string;
  botLane: string;
  config: FlowConfig;
  accent: string;
  reduced: boolean;
}) {
  const isConv = !!leg.convertsTo;
  const down = config.direction === "collection";
  // currency in the value-flow direction (Pay-in: carries -> convertsTo)
  const fromCur: Currency = isConv ? (down ? leg.carries : leg.convertsTo!) : leg.carries;
  const toCur: Currency = isConv ? (down ? leg.convertsTo! : leg.carries) : leg.carries;
  const crossing = topLane !== botLane;
  const intoLane = (down ? botLane : topLane) === "brazil" ? "Brasil 🇧🇷" : "Abroad";

  return (
    <div className="relative flex flex-col items-center py-1.5">
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
              animate={{ rotate: 360 }}
              transition={{ duration: 4, ease: "linear", repeat: Infinity }}
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
  );
}

// The real Trace arrow (mark-half), pointing down (Pay-in) / up (Pay-out) — it
// rotates + colour-tweens on toggle (the +90° wrapper turns right/left into
// down/up; TraceArrow animates the inner rotation/fill).
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
