"use client";
import { computeLayout, type NodeLayout, type LegLayout } from "./layout";
import { displayCurrency } from "./FlowSvg/Tokens";
import { ASSETS, C, TRACE_LOGO_AR, accentFor } from "./tokens";
import type { Currency, Flow, FlowConfig } from "../data/schema";

// Phone-native VERTICAL flow: the chain reads top -> bottom as full-width cards
// with the currency on each connector and the conversion / border crossing as a
// distinct moment. No horizontal scroll. Desktop uses the SVG dive instead.
export function MobileFlow({ flow, config }: { flow: Flow; config: FlowConfig }) {
  const layout = computeLayout(flow, config);
  const accent = accentFor(config.direction);
  // value reads top -> bottom for the active direction
  const nodes = layout.reverse ? [...layout.nodes].reverse() : layout.nodes;
  const legFor = (aId: string, bId: string): LegLayout | undefined =>
    layout.legs.find((l) => (l.from === aId && l.to === bId) || (l.from === bId && l.to === aId));

  return (
    <div className="mx-auto w-full max-w-md">
      {nodes.map((node, i) => {
        const next = nodes[i + 1];
        const leg = next ? legFor(node.id, next.id) : undefined;
        return (
          <div key={node.id}>
            <NodeCard node={node} primary={node.id === layout.primaryClientId} config={config} />
            {leg && next && (
              <Connector leg={leg} topId={node.id} topLane={node.lane} botLane={next.lane} config={config} accent={accent} />
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
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{
        background: primary ? "#0f1814" : C.surface,
        borderColor: primary ? "rgba(70,211,154,0.35)" : "rgba(255,255,255,0.10)",
      }}
    >
      {/* badge */}
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: C.subtitle }}
        >
          {node.label.charAt(0).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1 text-[15px] font-semibold leading-snug" style={{ color: C.title }}>
        {node.label}
      </div>

      <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-wide" style={{ color: C.muted }}>
        {lane}
      </span>
    </div>
  );
}

function Connector({
  leg,
  topId,
  topLane,
  botLane,
  config,
  accent,
}: {
  leg: LegLayout;
  topId: string;
  topLane: string;
  botLane: string;
  config: FlowConfig;
  accent: string;
}) {
  const isConv = !!leg.convertsTo;
  const forward = leg.from === topId; // leg's authored "from" is the top node
  const fromCur: Currency = isConv ? (forward ? leg.carries : leg.convertsTo!) : leg.carries;
  const toCur: Currency = isConv ? (forward ? leg.convertsTo! : leg.carries) : leg.carries;
  const crossing = topLane !== botLane;
  const intoLane = botLane === "brazil" ? "Brasil 🇧🇷" : "Abroad";

  return (
    <div className="flex flex-col items-center">
      <Rail />
      {isConv ? (
        <div
          className="my-0.5 flex items-center gap-2 rounded-xl px-3 py-2"
          style={{ background: "#0e1410", border: "1px solid rgba(70,211,154,0.30)" }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "#0b110d", border: `1px solid ${accent}55` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSETS.traceLogo} alt="" style={{ height: 13, width: 13 * TRACE_LOGO_AR }} />
          </span>
          <CurChip currency={displayCurrency(fromCur, config)} config={config} />
          <span style={{ color: accent }}>→</span>
          <CurChip currency={displayCurrency(toCur, config)} config={config} />
        </div>
      ) : (
        <div className="my-0.5">
          <CurChip currency={displayCurrency(fromCur, config)} config={config} />
        </div>
      )}
      {crossing && (
        <div className="my-1 flex w-full items-center gap-2 px-6">
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.10)" }} />
          <span className="text-[10.5px] font-medium uppercase tracking-wide" style={{ color: C.subtitle }}>
            into {intoLane}
          </span>
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.10)" }} />
        </div>
      )}
      <svg width="14" height="9" viewBox="0 0 14 9" className="-mt-0.5" aria-hidden>
        <path d="M2 2 L7 7 L12 2" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Rail />
    </div>
  );
}

function Rail() {
  return <span className="h-3 w-px" style={{ background: "rgba(255,255,255,0.14)" }} />;
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
