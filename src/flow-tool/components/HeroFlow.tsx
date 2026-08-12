"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Currency, Flow, FlowConfig } from "../data/schema";
import { isPlatformFlow, platformSuppressesClient } from "../data/schema";
import { ASSETS, C, GLASS_CARD, TRACE_LOGO_AR, accentFor, tubeTint } from "./tokens";
import { GlassBox } from "./FlowSvg/Nodes";
import { displayCurrency } from "./FlowSvg/Tokens";
import { TraceArrow } from "./FlowSvg/TraceArrow";
import { Defs } from "./FlowSvg";

// Stage 1 hero — the elevated "desired transaction", ported from
// trace_hero_mock.html. A horizontal rail: client → tube → the Trace-mark
// conversion hub → tube → beneficiary. Value RESTS at each station: a token
// emerges, flows one leg (clipped to the tube), is absorbed into the hub, the
// mark contracts + spins 360° during the conversion, then the converted token
// emerges and is absorbed into the beneficiary. One token in motion at a time,
// no glow, no trailing particles. Honors direction + reduced-motion.

// geometry (mock coordinates; the <svg> viewBox crops to this band)
const Y = 457;
const HUB = { cx: 680, cy: Y, r: 34 };
const VIEWBOX = "150 384 1060 168";

const ACRONYMS = new Set(["eFX", "NRA", "LP", "IP", "Pix", "Inc", "USDC", "USDT", "USDC/USDT", "USD/USDT", "BRL", "USD", "EUR", "USD/EUR", "BR", "A", "B"]);
function sentenceCase(label: string): string {
  const words = label.split(" ").map((w, i) => {
    if (ACRONYMS.has(w) || w === "/") return w;
    const lower = w.toLowerCase();
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  });
  return words.join(" ");
}

function TokenContent({ currency, coin, accent }: { currency: Currency; coin: FlowConfig["stablecoin"]; accent: string }) {
  if (currency === "USDC/USDT") {
    if (coin === "USDC") return <image href={ASSETS.usdc} x={-12} y={-12} width={24} height={24} />;
    if (coin === "USDT") return <image href={ASSETS.usdt} x={-12} y={-12} width={24} height={24} />;
    return (
      <>
        <image href={ASSETS.usdc} x={-20} y={-12} width={24} height={24} />
        <image href={ASSETS.usdt} x={-3} y={-12} width={24} height={24} />
      </>
    );
  }
  const w = Math.max(54, currency.length * 8 + 22);
  return (
    <>
      <rect x={-w / 2} y={-12} width={w} height={24} rx={12} fill={C.tokenFill} stroke={accent} strokeOpacity={0.8} style={{ transition: "stroke .55s cubic-bezier(.4,0,.2,1)" }} />
      <text textAnchor="middle" y={4} fontSize={11} fontWeight={500} fill="#dfeee7">
        {currency}
      </text>
    </>
  );
}

function ElevatedNode({
  x,
  w,
  green,
  children,
}: {
  x: number;
  w: number;
  green?: boolean;
  children: React.ReactNode;
}) {
  void green;
  return (
    <g>
      {/* liquid-glass box material — no mint rim; see FlowSvg/Nodes GlassBox */}
      <GlassBox x={x} y={398} w={w} h={118} rx={16} />
      {children}
    </g>
  );
}

export function HeroFlow({ flow, config }: { flow: Flow; config: FlowConfig }) {
  const reduced = useReducedMotion();
  const aRef = useRef<SVGGElement>(null);
  const bRef = useRef<SVGGElement>(null);
  const hubRef = useRef<SVGGElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);

  const carries = displayCurrency(flow.headline.carries, config);
  const convertsTo = displayCurrency(flow.headline.convertsTo ?? flow.headline.carries, config);
  const dir = config.direction;

  // labels — the desired-transaction boxes can DIVERGE from their machinery
  // counterparts. Each reads a hero-namespaced override first, falling back to
  // the machinery override, then the flow's own label. So by default the two
  // stages match, but a hero-specific edit (e.g. Client -> Client with the logo
  // both ends) leaves the machinery below untouched (client -> merchant).
  const partyA = flow.nodes.find((n) => n.id === flow.headline.partyA);
  const partyB = flow.nodes.find((n) => n.id === flow.headline.partyB);
  const hero = (id: string) => `${flow.id}:__hero__:${id}`;
  const mach = (id: string) => `${flow.id}:${id}`;
  const ov = (m: Record<string, string> | undefined, id: string) => m?.[hero(id)] ?? m?.[mach(id)];
  const ovb = (m: Record<string, boolean> | undefined, id: string) => m?.[hero(id)] ?? m?.[mach(id)];
  const labelA = ov(config.nodeLabels, flow.headline.partyA) ?? partyA?.label ?? "Client";
  const labelB = ov(config.nodeLabels, flow.headline.partyB) ?? partyB?.label ?? "Beneficiary";
  const entityA = ov(config.nodeEntities, flow.headline.partyA)?.trim();
  const entityB = ov(config.nodeEntities, flow.headline.partyB)?.trim();
  const clientSub = sentenceCase(labelA);
  // Technology-provider framing. `platform` draws the frame; `suppressClient`
  // removes the client from the flow (only when the CLIENT is the provider —
  // with Trace as provider the client still shows as the originating party).
  const platform = isPlatformFlow(config, flow.id);
  const suppressClient = platformSuppressesClient(config, flow.id);
  const traceProvider = platform && config.platform?.provider === "trace";
  const heroClientName = suppressClient ? clientSub : config.clientName;
  const heroClientLogo = suppressClient ? undefined : config.clientLogoUrl;
  // The beneficiary box can be branded as a client entity too (a second logo) —
  // e.g. a "Client -> Client" desired transaction with the logo both ends.
  const brandedB = !suppressClient && !!ovb(config.nodeBranded, flow.headline.partyB) && !!config.clientLogoUrl;
  const merchantName = sentenceCase(labelB);
  // the beneficiary isn't always abroad (the Foreigner-to-BR flow settles in Brazil)
  const merchantWhere = partyB?.lane === "brazil" ? "in Brazil" : "abroad";

  useEffect(() => {
    const a = aRef.current, b = bRef.current, hub = hubRef.current, pulse = pulseRef.current;
    if (!a || !b || !hub) return;

    // collection: A (carries) client→hub, convert, B (delivered) hub→merchant
    // disbursement: B (delivered) merchant→hub, convert, A (carries) hub→client
    // Travel ends INSIDE the glass stations (the tubes dock 24px deep), so the
    // token visibly slides all the way in and out through the housing wall.
    const legs =
      dir === "collection"
        ? [{ x0: 474, x1: 658, which: a }, { x0: 702, x1: 886, which: b }]
        : [{ x0: 886, x1: 702, which: b }, { x0: 658, x1: 474, which: a }];

    const LEG = 1650, GAP = 700, CYC = 2 * (LEG + GAP);

    function place(el: SVGGElement, x: number, on: boolean) {
      el.setAttribute("transform", `translate(${x.toFixed(1)},${Y})`);
      el.style.opacity = on ? "1" : "0";
    }

    if (reduced) {
      // static "arrived" state: converted token resting at the beneficiary
      const end = legs[1];
      place(legs[0].which, legs[0].x1, false);
      place(end.which, end.x1, true);
      hub.setAttribute("transform", "rotate(0) scale(1)");
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const e = (now - start) % CYC;
      legs[0].which.style.opacity = "0";
      legs[1].which.style.opacity = "0";
      if (e < LEG) {
        const p = e / LEG;
        place(legs[0].which, legs[0].x0 + (legs[0].x1 - legs[0].x0) * p, true);
        hub.setAttribute("transform", "rotate(0) scale(1)");
        if (pulse) pulse.style.opacity = "0";
      } else if (e < LEG + GAP) {
        const gp = (e - LEG) / GAP;
        hub.setAttribute("transform", `rotate(${(360 * gp).toFixed(1)}) scale(${(1 - 0.4 * Math.sin(gp * Math.PI)).toFixed(3)})`);
        if (pulse) {
          pulse.setAttribute("r", (HUB.r + 13 * gp).toFixed(1));
          pulse.style.opacity = (0.4 * (1 - gp)).toFixed(2);
        }
      } else if (e < 2 * LEG + GAP) {
        const p = (e - LEG - GAP) / LEG;
        place(legs[1].which, legs[1].x0 + (legs[1].x1 - legs[1].x0) * p, true);
        hub.setAttribute("transform", "rotate(0) scale(1)");
        if (pulse) pulse.style.opacity = "0";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dir, reduced, carries, convertsTo, config.stablecoin]);

  const hubW = 34;
  const hubH = hubW / TRACE_LOGO_AR;
  // Technology-provider framing on the desired-transaction layer too: the
  // hero band gets the same quiet brand enclosure + logo chip as the
  // machinery, and the payer station drops the avatar-circle affordance.
  const frameColor = config.platform?.color?.trim() || (traceProvider ? C.green : config.brandColor) || C.green;
  const heroFrame = platform ? { x: 176, y: 380, w: 1008, h: 154 } : null;
  const accent = accentFor(dir);
  // tube tint + token accent tween green↔cyan in sync with the arrow (Option A)
  const tubeTransition = reduced
    ? undefined
    : { transition: "fill .55s cubic-bezier(.4,0,.2,1), stroke .55s cubic-bezier(.4,0,.2,1)" };

  return (
    <svg viewBox={platform ? "150 350 1060 202" : VIEWBOX} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", maxHeight: "44vh", fontFamily: "var(--font-inter), system-ui, sans-serif" }} role="img" aria-label={`Built for ${config.clientName}`}>
      {/* Self-contained defs (e.g. #tf-shadow) so the hero renders correctly even
          when the machinery SVG that also defines them isn't mounted (surface-only). */}
      <Defs />
      {heroFrame && (
        <g>
          <rect x={heroFrame.x} y={heroFrame.y} width={heroFrame.w} height={heroFrame.h} rx={18} fill={frameColor} fillOpacity={0.028} stroke={frameColor} strokeOpacity={0.4} strokeWidth={1.2} />
          {(() => {
            const hasLogo = !traceProvider && !!config.clientLogoUrl;
            const chipW = traceProvider ? 158 : hasLogo ? 148 : Math.max(96, config.clientName.length * 8.5 + 36);
            const chipH = 30;
            const chipX = heroFrame.x + 22;
            const chipY = heroFrame.y - chipH / 2;
            const mH = 16, mW = mH * TRACE_LOGO_AR;
            return (
              <g>
                <rect x={chipX - 10} y={chipY - 3} width={chipW + 20} height={chipH + 6} rx={11} fill="#08090b" />
                <rect x={chipX} y={chipY} width={chipW} height={chipH} rx={9} fill="#0c1210" stroke={frameColor} strokeOpacity={0.55} />
                {traceProvider ? (
                  <g>
                    <image href={ASSETS.traceLogo} x={chipX + 12} y={chipY + (chipH - mH) / 2} width={mW} height={mH} preserveAspectRatio="xMidYMid meet" />
                    <text x={chipX + 12 + mW + 8} y={chipY + 19.5} fontSize={12.5} fontWeight={600} fill="#e6ebe8">
                      Trace Finance
                    </text>
                  </g>
                ) : hasLogo ? (
                  config.clientLogoPlate === "light" ? (
                    <g>
                      <rect x={chipX + 5} y={chipY + 5} width={chipW - 10} height={chipH - 10} rx={5} fill="#ffffff" />
                      <image href={config.clientLogoUrl} x={chipX + 12} y={chipY + 7} width={chipW - 24} height={chipH - 14} preserveAspectRatio="xMidYMid meet" />
                    </g>
                  ) : (
                    <image href={config.clientLogoUrl} x={chipX + 10} y={chipY + 6} width={chipW - 20} height={chipH - 12} preserveAspectRatio="xMidYMid meet" />
                  )
                ) : (
                  <text x={chipX + chipW / 2} y={chipY + 19.5} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#e6ebe8">
                    {config.clientName}
                  </text>
                )}
              </g>
            );
          })()}
        </g>
      )}
      {/* tubes / conduits — flat channels tinted by direction, docking 24px
          INTO the translucent glass stations (visible through the housing) */}
      <clipPath id="tf-tube">
        <rect x={472} y={441} width={188} height={32} rx={11} />
        <rect x={700} y={441} width={188} height={32} rx={11} />
      </clipPath>
      <rect x={496} y={441} width={164} height={32} rx={11} fill={tubeTint(dir)} stroke={accent} strokeOpacity={0.42} style={tubeTransition} />
      <rect x={700} y={441} width={164} height={32} rx={11} fill={tubeTint(dir)} stroke={accent} strokeOpacity={0.42} style={tubeTransition} />

      {/* directional indicators — the Trace mark-half on each tube, sat at the END
          the token emerges from (flips with direction) and pointing in flow.
          left tube [488,660], right tube [700,872], inset 36 from the source end. */}
      <TraceArrow cx={dir === "collection" ? 524 : 624} cy={Y} size={26} direction={dir} />
      <TraceArrow cx={dir === "collection" ? 736 : 836} cy={Y} size={26} direction={dir} />

      {/* client station — once a logo is uploaded it fills nearly the whole
          block (the client's identity); otherwise show an initial + name + role.
          data-hero-node + pointer-events lets the build page double-click it. */}
      <g data-hero-node={flow.headline.partyA} style={{ pointerEvents: "auto" }}>
      <ElevatedNode x={196} w={300} green>
        {heroClientLogo ? (
          config.clientLogoPlate === "light" ? (
            <>
              {/* card + logo centered on the node (cx 346, cy 457), with
                  comfortable padding so the mark reads as a poised lockup */}
              <rect x={206} y={407} width={280} height={100} rx={16} fill="#ffffff" />
              <image href={heroClientLogo} x={236} y={429} width={220} height={56} preserveAspectRatio="xMidYMid meet" />
            </>
          ) : (
            // light/transparent logo sits straight on the deck, padded to breathe
            <image href={heroClientLogo} x={236} y={429} width={220} height={56} preserveAspectRatio="xMidYMid meet" />
          )
        ) : suppressClient ? (
          <text
            x={346}
            y={462}
            textAnchor="middle"
            fontSize={clientSub.length > 24 ? 14.5 : clientSub.length > 16 ? 17 : 20}
            fontWeight={600}
            fill="#f1f4f2"
          >
            {clientSub}
          </text>
        ) : (
          <>
            <circle cx={346} cy={436} r={19} fill="#0f1814" stroke={GLASS_CARD.hairline} />
            <text x={346} y={442} textAnchor="middle" fontSize={15} fontWeight={600} fill="#9cc4b3">
              {heroClientName.charAt(0).toUpperCase()}
            </text>
            <text x={346} y={481} textAnchor="middle" fontSize={20} fontWeight={600} fill="#f1f4f2">
              {heroClientName}
            </text>
            <text x={346} y={502} textAnchor="middle" fontSize={13} fontWeight={400} fill="#6f857b">
              {clientSub}
            </text>
          </>
        )}
      </ElevatedNode>
      {entityA && (
        <text x={346} y={532} textAnchor="middle" fontSize={12} fill="#6f857b">
          ({entityA})
        </text>
      )}
      </g>

      {/* beneficiary station — a plain name + role, unless branded as a client
          entity (then it carries the client logo like the client station). */}
      <g data-hero-node={flow.headline.partyB} style={{ pointerEvents: "auto" }}>
      <ElevatedNode x={864} w={300} green>
        {brandedB ? (
          config.clientLogoPlate === "light" ? (
            <>
              <rect x={874} y={407} width={280} height={100} rx={16} fill="#ffffff" />
              <image href={heroClientLogo} x={904} y={429} width={220} height={56} preserveAspectRatio="xMidYMid meet" />
            </>
          ) : (
            <image href={heroClientLogo} x={904} y={429} width={220} height={56} preserveAspectRatio="xMidYMid meet" />
          )
        ) : (
          <>
            <text x={1014} y={455} textAnchor="middle" fontSize={20} fontWeight={600} fill="#f1f4f2">
              {merchantName}
            </text>
            <text x={1014} y={477} textAnchor="middle" fontSize={13} fontWeight={400} fill="#6f857b">
              Beneficiary, {merchantWhere}
            </text>
          </>
        )}
      </ElevatedNode>
      {entityB && (
        <text x={1014} y={532} textAnchor="middle" fontSize={12} fill="#6f857b">
          ({entityB})
        </text>
      )}
      </g>

      {/* the Trace-mark conversion hub — quiet ring; the mint PULSE on convert
          stays (it narrates the conversion event, meaning not decoration) */}
      <circle cx={HUB.cx} cy={HUB.cy} r={HUB.r} fill="#0b110d" stroke={GLASS_CARD.hairline} strokeWidth={1.2} />
      <circle ref={pulseRef} cx={HUB.cx} cy={HUB.cy} r={HUB.r} fill="none" stroke={C.green} strokeWidth={2} opacity={0} />
      <g transform={`translate(${HUB.cx},${HUB.cy})`}>
        <g ref={hubRef}>
          <image href={ASSETS.traceLogo} x={-hubW / 2} y={-hubH / 2} width={hubW} height={hubH} />
        </g>
      </g>

      {/* the two relay tokens, clipped to the tubes */}
      <g clipPath="url(#tf-tube)">
        <g ref={aRef} opacity={0} transform={`translate(490,${Y})`}>
          <TokenContent currency={carries} coin={config.stablecoin} accent={accent} />
        </g>
        <g ref={bRef} opacity={0} transform={`translate(702,${Y})`}>
          <TokenContent currency={convertsTo} coin={config.stablecoin} accent={accent} />
        </g>
      </g>
    </svg>
  );
}
