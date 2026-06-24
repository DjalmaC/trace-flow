import type { Currency, FlowConfig, Stablecoin } from "../../data/schema";
import { ASSETS, C } from "../tokens";

// Currency tokens, swap capsules, and the Trace mark — all rendered centered at
// the local origin (0,0) so the same component serves static placement (<g
// transform>) and animated placement (<motion.g style={{x,y}}>).
//
// The 'USDC/USDT' token is the semantic stablecoin: which coin actually shows
// (single USDC, single USDT, or the pair) is the client's choice, passed down as
// `coin` (FlowConfig.stablecoin). Pills (BRL, USD/EUR) ignore it.

/** Resolve a data currency to its display label, honouring config overrides. */
export function displayCurrency(c: Currency, config: FlowConfig): Currency {
  if (c === "BRL") return config.collected;
  if (c === "USD/EUR") return config.delivered;
  return c;
}

/** Pixel width of a token, for centering / capsule sizing. */
export function tokenWidth(c: Currency, coin: Stablecoin = "both"): number {
  if (c === "USDC/USDT") return coin === "both" ? 38 : 22;
  return Math.max(38, c.length * 7 + 16);
}

function Pill({ text }: { text: string }) {
  const w = Math.max(38, text.length * 7 + 16);
  return (
    <>
      <rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill={C.pillFill} stroke={C.pillStroke} />
      <text x={0} y={4} fontSize={11} fontWeight={600} fill={C.pillText} textAnchor="middle">
        {text}
      </text>
    </>
  );
}

function Coins({ coin }: { coin: Stablecoin }) {
  if (coin === "USDC") return <image href={ASSETS.usdc} x={-11} y={-11} width={22} height={22} />;
  if (coin === "USDT") return <image href={ASSETS.usdt} x={-11} y={-11} width={22} height={22} />;
  return (
    <>
      <image href={ASSETS.usdc} x={-19} y={-11} width={22} height={22} />
      <image href={ASSETS.usdt} x={-3} y={-11} width={22} height={22} />
    </>
  );
}

/** A single currency token (pill or coin), centered at origin. */
export function CurrencyToken({ currency, coin = "both" }: { currency: Currency; coin?: Stablecoin }) {
  return currency === "USDC/USDT" ? <Coins coin={coin} /> : <Pill text={currency} />;
}

/** A conversion capsule: leftToken ⇄ rightToken, centered at origin. */
export function SwapCapsule({
  left,
  right,
  green = false,
  coin = "both",
}: {
  left: Currency;
  right: Currency;
  green?: boolean;
  coin?: Stablecoin;
}) {
  const lw = tokenWidth(left, coin);
  const rw = tokenWidth(right, coin);
  const gap = 22;
  const total = lw + gap + rw;
  const x0 = -total / 2;
  const lx = x0 + lw / 2;
  const rx = x0 + lw + gap + rw / 2;
  const axc = x0 + lw + gap / 2;
  const fill = green ? C.greenFill : C.capFill;
  const stroke = green ? C.green : C.capStroke;
  const marker = green ? "tf-swap-g" : "tf-swap";
  const acol = green ? C.green : "#b4bcb7";
  return (
    <g>
      <rect x={x0 - 13} y={-19} width={total + 26} height={38} rx={19} fill={fill} stroke={stroke} />
      <g transform={`translate(${lx},0)`}>
        <CurrencyToken currency={left} coin={coin} />
      </g>
      <line x1={axc - 7} y1={-3} x2={axc + 7} y2={-3} stroke={acol} strokeWidth={1.5} markerEnd={`url(#${marker})`} />
      <line x1={axc + 7} y1={3} x2={axc - 7} y2={3} stroke={acol} strokeWidth={1.5} markerEnd={`url(#${marker})`} />
      <g transform={`translate(${rx},0)`}>
        <CurrencyToken currency={right} coin={coin} />
      </g>
    </g>
  );
}

/** The Trace mark (real transparent PNG), centered horizontally on (cx). */
export function TraceMark({ cx, cy, w }: { cx: number; cy: number; w: number }) {
  const h = w / 1.576;
  return <image href={ASSETS.traceLogo} x={cx - w / 2} y={cy - h / 2} width={w} height={h} />;
}
