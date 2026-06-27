"use client";
import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import type { Currency, Flow, FlowConfig } from "../data/schema";
import { ASSETS, C, TRACE_LOGO_AR, accentFor, tubeTint } from "./tokens";
import { displayCurrency } from "./FlowSvg/Tokens";
import { TraceArrow } from "./FlowSvg/TraceArrow";

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

const ACRONYMS = new Set(["eFX", "NRA", "LP", "IP", "Pix", "Inc", "USDC", "USDT", "USDC/USDT", "USD/USDT", "BRL", "USD", "EUR", "USD/EUR", "BR"]);
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
  return (
    <g filter="url(#tf-shadow)">
      <rect x={x} y={398} width={w} height={118} rx={16} fill={C.surface} stroke={green ? C.green : "#ffffff"} strokeOpacity={green ? 0.22 : 0.1} />
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

  // labels
  const partyA = flow.nodes.find((n) => n.id === flow.headline.partyA);
  const partyB = flow.nodes.find((n) => n.id === flow.headline.partyB);
  const clientSub = sentenceCase(partyA?.label ?? "Client");
  const merchantName = sentenceCase(partyB?.label ?? "Beneficiary");
  // the beneficiary isn't always abroad (the Foreigner-to-BR flow settles in Brazil)
  const merchantWhere = partyB?.lane === "brazil" ? "in Brazil" : "abroad";

  useEffect(() => {
    const a = aRef.current, b = bRef.current, hub = hubRef.current, pulse = pulseRef.current;
    if (!a || !b || !hub) return;

    // collection: A (carries) client→hub, convert, B (delivered) hub→merchant
    // disbursement: B (delivered) merchant→hub, convert, A (carries) hub→client
    const legs =
      dir === "collection"
        ? [{ x0: 490, x1: 658, which: a }, { x0: 702, x1: 870, which: b }]
        : [{ x0: 870, x1: 702, which: b }, { x0: 658, x1: 490, which: a }];

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
  const accent = accentFor(dir);
  // tube tint + token accent tween green↔cyan in sync with the arrow (Option A)
  const tubeTransition = reduced
    ? undefined
    : { transition: "fill .55s cubic-bezier(.4,0,.2,1), stroke .55s cubic-bezier(.4,0,.2,1)" };

  return (
    <svg viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", maxHeight: "44vh", fontFamily: "Inter, system-ui, sans-serif" }} role="img" aria-label={`What ${config.clientName} wants`}>
      {/* tubes / conduits — flat channels tinted by direction, running BEHIND the
          station boxes (boxes are drawn after, covering the tube ends flush) */}
      <clipPath id="tf-tube">
        <rect x={488} y={441} width={172} height={32} rx={11} />
        <rect x={700} y={441} width={172} height={32} rx={11} />
      </clipPath>
      <rect x={488} y={441} width={172} height={32} rx={11} fill={tubeTint(dir)} stroke={accent} strokeOpacity={0.42} style={tubeTransition} />
      <rect x={700} y={441} width={172} height={32} rx={11} fill={tubeTint(dir)} stroke={accent} strokeOpacity={0.42} style={tubeTransition} />

      {/* directional indicators — the actual Trace mark-half, one at the start of
          each rail segment (one per tube), pointing in the flow direction */}
      <TraceArrow cx={524} cy={Y} size={26} direction={dir} />
      <TraceArrow cx={736} cy={Y} size={26} direction={dir} />

      {/* client station — once a logo is uploaded it fills nearly the whole
          block (the client's identity); otherwise show an initial + name + role */}
      <ElevatedNode x={196} w={300} green>
        {config.clientLogoUrl ? (
          config.clientLogoPlate === "light" ? (
            <>
              {/* card + logo centered on the node (cx 346, cy 457), with
                  comfortable padding so the mark reads as a poised lockup */}
              <rect x={206} y={407} width={280} height={100} rx={16} fill="#ffffff" />
              <image href={config.clientLogoUrl} x={236} y={429} width={220} height={56} preserveAspectRatio="xMidYMid meet" />
            </>
          ) : (
            // light/transparent logo sits straight on the deck, padded to breathe
            <image href={config.clientLogoUrl} x={236} y={429} width={220} height={56} preserveAspectRatio="xMidYMid meet" />
          )
        ) : (
          <>
            <circle cx={346} cy={436} r={19} fill="#0f1814" stroke={C.green} strokeOpacity={0.35} />
            <text x={346} y={442} textAnchor="middle" fontSize={15} fontWeight={600} fill="#9cc4b3">
              {config.clientName.charAt(0).toUpperCase()}
            </text>
            <text x={346} y={481} textAnchor="middle" fontSize={20} fontWeight={600} fill="#f1f4f2">
              {config.clientName}
            </text>
            <text x={346} y={502} textAnchor="middle" fontSize={13} fontWeight={400} fill="#6f857b">
              {clientSub}
            </text>
          </>
        )}
      </ElevatedNode>

      {/* beneficiary station */}
      <ElevatedNode x={864} w={300} green>
        <text x={1014} y={455} textAnchor="middle" fontSize={20} fontWeight={600} fill="#f1f4f2">
          {merchantName}
        </text>
        <text x={1014} y={477} textAnchor="middle" fontSize={13} fontWeight={400} fill="#6f857b">
          Beneficiary, {merchantWhere}
        </text>
      </ElevatedNode>

      {/* the Trace-mark conversion hub */}
      <circle cx={HUB.cx} cy={HUB.cy} r={HUB.r} fill="#0b110d" stroke={C.green} strokeOpacity={0.3} />
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
