// ─────────────────────────────────────────────────────────────────────────────
// Flow data model — THE CONTRACT
// Source of truth: "Flow Machine — Architecture & Build Spec (v0.1)" §3 + the
// verified eleven-flow library. The renderer and the intake resolver only ever
// read this shape, so new flows are *data*, not new components.
// ─────────────────────────────────────────────────────────────────────────────

// 'USDC/USDT' is the semantic stablecoin token; which coin actually shows is a
// client choice carried on FlowConfig.stablecoin and resolved at render time.
// "USD/EUR" is the semantic delivered-fiat token used in flow DATA; the
// client-facing display can resolve it to the combined label or a specific
// "USD" / "EUR" via FlowConfig.delivered.
// "USD/USDT" is a combined cash-or-stablecoin token used by the Foreigner-to-BR
// flow (foreign value funded as USD or USDT); it renders as a labelled pill.
export type Currency = "BRL" | "USD" | "EUR" | "USD/EUR" | "USDC/USDT" | "USD/USDT";
export type Stablecoin = "USDC" | "USDT" | "both";
export type Lane = "brazil" | "abroad";
export type NodeKind = "client" | "trace" | "operational" | "merchant";
export type Direction = "collection" | "disbursement";

/**
 * The dials grammar (Architecture spec §2). A flow is one setting of these.
 * `settlement-form` and `trace-role` are *computed* from these (see §2.1) and so
 * are not part of the coordinate — they live on the Flow as cached/derived data.
 */
export interface DialCoordinate {
  /** D1 — the human-facing model label. */
  model: "eFX-only" | "eFX+NRA" | "NRA-direct" | "VA" | "VA+NRA" | "Foreigner-to-BR";
  /** D3 — the one real conduit input. */
  rail: "direct-fiat" | "treasury-fiat" | "stablecoin-sandwich" | "VA-delivery";
  /** D2 (decomposed) — where/whose value sits offshore. */
  nraOwnership: "none" | "pix-own" | "third-party";
  /** D2 (decomposed) — what Pix Inc does in the flow. */
  pixRole: "none" | "settler" | "treasury" | "liquidity-provider";
  /** D2 (decomposed) — whether a Local Liquidity Provider sources BRL in Brazil. */
  localLp: boolean;
}

export type TraceRole = "Correspondente Cambial" | "VASP";

export interface FlowNode {
  /** Stable anchor id, unique within the flow (spec §3, `anchor-id`). An entity
   *  can appear as multiple nodes (Pix Inc appears twice in #7/#8); each is its
   *  own node. This is what lets the headline reference the same party. */
  id: string;
  label: string;
  kind: NodeKind;
  lane: Lane;
  /** Render this node with the client's logo (e.g. the client's own in-country
   *  entity) instead of its kind's default badge/mark. */
  brandedClient?: boolean;
  /** Layout-internal: when a proposal reorders boxes (FlowConfig.nodeOrder),
   *  the layout permutes node CONTENT (label/kind/branding) across the flow's
   *  fixed slots. `srcId` is the content's original node id — renames and the
   *  build canvas's edit handles key on it so they travel with the box. Never
   *  set in flow data. */
  srcId?: string;
}

/** An additional settlement the FX engine can deliver on a converting leg —
 *  the primary is the leg's own convertsTo. The deck shows a settlement
 *  toggle when a flow offers options; the PDF shows the primary plus a short
 *  "also settles in ..." note. */
export interface SettlementOption {
  /** Toggle pill label; empty = the display currency. */
  label?: string;
  out: Currency;
  /** Per-option relabeling of boxes (nodeId -> label), e.g. the beneficiary
   *  box reading "bank account" on the fiat option and "wallet" on the
   *  stablecoin one. */
  nodeLabels?: Record<string, string>;
}

export interface Leg {
  from: string;
  to: string;
  carries: Currency;
  /** Set => a swap capsule converts mid-leg (usually the border crossing). */
  convertsTo?: Currency;
  /** Additional settlement options this conversion offers (see above). */
  settlements?: SettlementOption[];
  /** Does this leg cross the Brazil | Abroad divide? (the conversion usually sits here) */
  crosses?: boolean;
}

/** Stage 1 — the desired transaction: the two real end parties, machinery skipped. */
export interface Headline {
  partyA: string; // anchor id of the originating client-facing party
  partyB: string; // anchor id of the ultimate beneficiary
  carries: Currency;
  convertsTo?: Currency;
}

/** Projector link tying a headline endpoint to its machinery counterpart. */
export interface SameActor {
  headlineNode: string;
  machineryNode: string;
}

export interface Flow {
  id: string;
  /** e.g. "1", "9.1", "10" — display id from the board. */
  displayId: string;
  title: string;
  dials: DialCoordinate; // used by the intake resolver (Stage B match)
  traceRole: TraceRole[]; // computed: 'VASP' and/or 'Correspondente Cambial'
  directions: Direction[]; // all flows: ['collection','disbursement']
  /** Optional hero-subtitle override per direction (the defaults are
   *  Brazil-centric; flows that originate abroad set their own copy). */
  heroSupport?: { collection: string; disbursement: string };
  /** One-line description for the manual picker. */
  blurb: string;
  /** House-voice narrative ("text underneath"), client-facing. */
  narrative?: string;
  headline: Headline; // Stage 1
  nodes: FlowNode[]; // Stage 2 machinery
  legs: Leg[]; // Stage 2 machinery legs, ordered
  sameActor: SameActor[]; // projector links between stages

  // ── Tailored flows (rep-built in the flow editor) ──────────────────────────
  /** True for rep-built flows. Internal only — the client deck renders a
   *  tailored flow exactly like a library flow, no CUSTOM chip. */
  custom?: boolean;
  /** Client the tailored flow was built for (display only). */
  customFor?: string;
  /** Last-edit timestamp (ms) for the drafts list. */
  updatedAt?: number;
  /** Editor canvas state, ignored by every renderer: free node positions and
   *  internal sticky notes. Chain order for the deck comes from nodes[] order,
   *  which the editor keeps sorted by canvas x. */
  editor?: {
    pos: Record<string, { x: number; y: number }>;
    notes: { id: string; x: number; y: number; text: string }[];
  };
}

// ── Proposal layer ────────────────────────────────────────────────────────
// A "proposal" wraps one or more flows in a branded, downloadable deck built on
// top of a fixed Trace template PDF (see lib/proposal.ts + public/proposals).
// The salesperson sets these up on the intro page (/new) before meeting the
// client, then builds the flow(s) live in the generator.

/** Which template PDF the proposal is assembled on. */
export type ProposalType = "standard" | "brazil-market";

/** A Trace Finance salesperson. Sourced from the Sales contact slides deck:
 *  `slidePage` (0-based) points at that rep's pre-designed closing slide, which
 *  replaces the template's generic contact slide when the proposal is built. */
export interface TraceRep {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  /** 0-based page index of this rep's slide in private-assets/sales-slides.pdf. */
  slidePage?: number;
}

// ── Pricing (design handoff 2a/2b) ───────────────────────────────────────────
// Drives the client's Pricing view and the PDF pricing page(s). Defaults come
// from the proposal template ("deck"); Custom lets the rep rewrite everything:
// values, band labels, tier count, or a free-text rate. Standard prices two
// components (Pix API + FX spread, one shared PDF page); Brazil-market prices
// the deck's five products, one PDF page each.

export interface PriceTier {
  /** Volume-band label, fully editable in Custom ("Up to $5M / month"). */
  label: string;
  /** Numeric rate; ignored when `text` is set. */
  value: number;
  /** Free-text rate ("Negotiable") — replaces the formatted number entirely. */
  text?: string | null;
}

export interface PriceCard {
  /** Stable identity against the deck: per-card reset + PDF page replacement. */
  key: string;
  title: string;
  /** In-card caption under the title. */
  sub: string;
  /** Green subtitle of the card's own PDF page (Brazil-market decks). */
  pageSub?: string;
  /** Rendered value = prefix + value.toFixed(2) + suffix. */
  prefix?: string;
  suffix?: string;
  badge: "pix" | "dollar" | "percent" | "up" | "down";
  accent: "green" | "blue";
  type: "tiered" | "flat";
  tiers: PriceTier[];
  flat?: number;
  flatText?: string | null;
}

export interface ProposalPricing {
  mode: "deck" | "custom";
  cards: PriceCard[];
}

/** A tier's display string — the free text when set, else the formatted rate. */
export function tierText(card: PriceCard, tier: PriceTier): string {
  return tier.text?.trim() ? tier.text.trim() : `${card.prefix ?? ""}${tier.value.toFixed(2)}${card.suffix ?? ""}`;
}
export function flatRowText(card: PriceCard): string {
  return card.flatText?.trim()
    ? card.flatText.trim()
    : `${card.prefix ?? ""}${(card.flat ?? card.tiers[0]?.value ?? 0).toFixed(2)}${card.suffix ?? ""}`;
}

export function cardEqualsDeck(card: PriceCard, deckCard: PriceCard | undefined): boolean {
  if (!deckCard) return false;
  const identity =
    card.type === deckCard.type &&
    !card.flatText?.trim() &&
    // identity text matters too — a renamed product must re-render its page
    card.title === deckCard.title &&
    card.sub === deckCard.sub &&
    (card.prefix ?? "") === (deckCard.prefix ?? "") &&
    (card.suffix ?? "") === (deckCard.suffix ?? "");
  if (!identity) return false;
  if (card.type === "flat")
    return (card.flat ?? card.tiers[0]?.value) === (deckCard.flat ?? deckCard.tiers[0]?.value) && !deckCard.flatText?.trim();
  return (
    card.tiers.length === deckCard.tiers.length &&
    card.tiers.every((t, i) => t.label === deckCard.tiers[i].label && t.value === deckCard.tiers[i].value && !t.text?.trim())
  );
}

/** True when the pricing is structurally and numerically the baseline's own
 *  rates (the live deck by default; pass templatePricing to ask "does the
 *  hand-designed template page already show this?"). */
export function pricingEqualsDeck(p: ProposalPricing, proposalType: ProposalType = "standard", against?: ProposalPricing): boolean {
  const d = against ?? deckPricing(proposalType);
  return p.cards.length === d.cards.length && p.cards.every((c, i) => c.key === d.cards[i].key && cardEqualsDeck(c, d.cards[i]));
}

const tiersOf = (labels: string[], values: number[]): PriceTier[] => labels.map((label, i) => ({ label, value: values[i] }));

/** The template ("deck") defaults, per proposal type. */
export function deckPricing(proposalType: ProposalType = "standard"): ProposalPricing {
  if (proposalType === "brazil-market") {
    // The five priced products of the Brazil-market deck, one page each
    // (labels/values verbatim from public/proposals/templates/brazil-market.pdf).
    const usdBands = ["USD 1M – 5M", "USD 1M – 10M", "Above USD 10M"];
    const brlBands = ["Up to BRL 1M", "BRL 1M – 50M", "Above BRL 50M"];
    return {
      mode: "deck",
      cards: [
        {
          key: "nonres", title: "Non-resident account", sub: "% of volume transacted through the account",
          pageSub: "BRL payins · non-resident routing", suffix: "%", badge: "percent", accent: "green",
          type: "tiered", tiers: tiersOf(usdBands, [0.2, 0.15, 0.1]),
        },
        {
          key: "pixinc", title: "PixInc", sub: "% of volume, tiered",
          pageSub: "BRL payins via PixInc", suffix: "%", badge: "pix", accent: "green",
          type: "tiered", tiers: tiersOf(usdBands, [0.25, 0.15, 0.12]),
        },
        {
          key: "onramp", title: "On-ramp · BRL → USDT", sub: "Tiered FX spread",
          pageSub: "USDT ↔ BRL · stablecoin ramp", suffix: "%", badge: "up", accent: "green",
          type: "tiered", tiers: tiersOf(brlBands, [0.45, 0.35, 0.25]),
        },
        {
          key: "offramp", title: "Off-ramp · USDT → BRL", sub: "Tiered FX spread",
          pageSub: "USDT ↔ BRL · stablecoin ramp", suffix: "%", badge: "down", accent: "green",
          type: "tiered", tiers: tiersOf(brlBands, [0.3, 0.2, 0.15]),
        },
        {
          // Pix is priced FLAT, in USD ($0.06 / tx). The Brazil-market editor
          // offers a $ / R$ unit switch; the rate itself never tiers.
          key: "pixout", title: "Pix", sub: "Per-transaction fee (USD), flat",
          pageSub: "BRL payouts via Pix", prefix: "$ ", badge: "dollar", accent: "green",
          type: "flat", flat: 0.06, tiers: [{ label: "All volumes", value: 0.06 }],
        },
      ],
    };
  }
  const bands = ["Up to $5M / month", "$5M to $10M / month", "$10M to $30M / month", "$30M to $50M / month", "Above $50M / month"];
  return {
    mode: "deck",
    cards: [
      {
        // Pix is priced FLAT, in USD ($0.06 / pix), regardless of volume.
        key: "pix", title: "Pix API", sub: "Per-payment fee (USD), flat",
        prefix: "$", suffix: " / pix", badge: "pix", accent: "green",
        type: "flat", flat: 0.06, tiers: [{ label: "All volumes", value: 0.06 }],
      },
      {
        key: "spread", title: "FX spread", sub: "Spot rate + spread, tiered by volume",
        suffix: "%", badge: "dollar", accent: "blue",
        type: "tiered", tiers: tiersOf(bands, [0.7, 0.65, 0.55, 0.5, 0.35]),
      },
    ],
  };
}

/** What the template PDFs physically show on their hand-designed rate pages —
 *  NOT the live deck defaults. Page-replacement decisions compare against
 *  this: a proposal whose pricing differs from the BAKED page re-renders it
 *  (so the new flat-$0.06 Pix default always re-renders, since the templates
 *  still bake the old tiered rates). */
export function templatePricing(proposalType: ProposalType = "standard"): ProposalPricing {
  if (proposalType === "brazil-market") {
    const p = deckPricing("brazil-market");
    return {
      mode: "deck",
      cards: p.cards.map((c) =>
        c.key === "pixout"
          ? {
              ...c, title: "Pix", sub: "Per-transaction fee (BRL), tiered by volume", prefix: "R$ ",
              type: "tiered", flat: undefined,
              tiers: tiersOf(["Below R$ 50k", "R$ 50k – 100k", "Above R$ 100k"], [0.25, 0.2, 0.1]),
            }
          : c,
      ),
    };
  }
  const p = deckPricing("standard");
  const bands = ["Up to $5M / month", "$5M to $10M / month", "$10M to $30M / month", "$30M to $50M / month", "Above $50M / month"];
  return {
    mode: "deck",
    cards: p.cards.map((c) =>
      c.key === "pix"
        ? {
            ...c, sub: "Per-payment fee (USD), tiered by volume",
            type: "tiered", flat: undefined,
            tiers: tiersOf(bands, [0.1, 0.08, 0.06, 0.04, 0.02]),
          }
        : c,
    ),
  };
}

// ── Legacy pricing (pre-card links) ──────────────────────────────────────────
// Older shared rows store { mode, pix, spread } with { max, value } tiers.
// normalizePricing upgrades any stored shape to the card model above.

interface LegacyTier { max: number | null; value: number }
interface LegacyComponent { type: "tiered" | "flat"; tiers: LegacyTier[]; flat?: number }
interface LegacyProposalPricing { mode: string; pix: LegacyComponent; spread: LegacyComponent }

function legacyVol(n: number): string {
  if (n >= 1_000_000) return `$${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${+(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}
function legacyBandLabel(tiers: LegacyTier[], i: number): string {
  const t = tiers[i];
  const prev = i > 0 ? tiers[i - 1]?.max : null;
  if (t.max == null) return prev != null ? `Above ${legacyVol(prev)} / month` : "All volumes";
  if (prev == null) return `Up to ${legacyVol(t.max)} / month`;
  return `${legacyVol(prev)} to ${legacyVol(t.max)} / month`;
}
function legacyToCard(comp: LegacyComponent, deckCard: PriceCard): PriceCard {
  return {
    ...deckCard,
    type: comp.type,
    flat: comp.flat,
    tiers: comp.tiers.map((t, i) => ({ label: legacyBandLabel(comp.tiers, i), value: t.value })),
  };
}

/** Upgrade any stored pricing (current cards, or legacy pix/spread) to the card
 *  model. Unrecognizable input falls back to the deck for the proposal type. */
export function normalizePricing(p: unknown, proposalType: ProposalType = "standard"): ProposalPricing {
  const deck = deckPricing(proposalType);
  if (!p || typeof p !== "object") return deck;
  const anyP = p as Partial<ProposalPricing> & Partial<LegacyProposalPricing>;
  if (Array.isArray(anyP.cards) && anyP.cards.every((c) => c && typeof c === "object" && Array.isArray(c.tiers))) {
    return { mode: anyP.mode === "deck" ? "deck" : "custom", cards: anyP.cards as PriceCard[] };
  }
  if (anyP.pix && typeof anyP.pix === "object" && anyP.spread && typeof anyP.spread === "object") {
    const std = deckPricing("standard");
    return {
      mode: anyP.mode === "deck" ? "deck" : "custom",
      cards: [legacyToCard(anyP.pix, std.cards[0]), legacyToCard(anyP.spread, std.cards[1])],
    };
  }
  return deck;
}

/** The salesperson-private setup captured on the intro page, carried into the
 *  generator. The company fields map onto FlowConfig's client* fields. */
export interface ProposalSetup {
  proposalType: ProposalType;
  /** Display date for the title slide, e.g. "June 2026". */
  date: string;
  traceRepId?: string;
  company: string;
  companyRep?: string;
  companyLogoUrl?: string;
  companyLogoPlate?: "light" | "none";
  /** The untouched upload, so the builder can re-run logo treatments. */
  companyLogoOriginal?: string;
  /** Dominant logo color (platform frame default), extracted at upload. */
  brandColor?: string;
}

/** Produced by intake OR the manual picker; drives <FlowExperience>. */
export interface FlowConfig {
  flowId: string;
  clientName: string;
  /** Optional point of contact at the client (shown on the shared client view). */
  clientRep?: string;
  clientLogoUrl?: string;
  /** Backing for the logo on the dark deck: "light" = sit it on a white card
   *  (for dark logos), "none" = on the dark deck as-is. Resolved at upload. */
  clientLogoPlate?: "light" | "none";
  collected: Currency; // default 'BRL'
  delivered: Currency; // default 'USD/EUR'
  direction: Direction; // default 'collection'
  /** Which coin a 'USDC/USDT' token shows (stablecoin flows only). Default 'both'. */
  stablecoin: Stablecoin;
  /** Per-proposal node renames (double-click a box on the build canvas),
   *  keyed "<flowId>:<nodeId>". Applied at layout time, so the canvas, the
   *  client link, mobile and the PDF all inherit them — works on library
   *  flows without forking them. */
  nodeLabels?: Record<string, string>;
  /** Per-proposal box reordering (edit mode: drag a box onto another to swap,
   *  or into a gap to move it). Keyed by flowId; the value is the flow's node
   *  ids in their new display order across the flow's ORIGINAL slots. The
   *  structure (legs, currencies, lanes, the border) stays put — only the box
   *  content (label, kind, branding) permutes. Ignored unless it is a full
   *  permutation of the flow's node ids. */
  nodeOrder?: Record<string, string[]>;
  /** Per-proposal lane renames (double-click "Brazil" / "Abroad" on the build
   *  canvas), keyed by flowId — e.g. a Canada corridor. Applied at layout
   *  time like nodeLabels. */
  laneLabels?: Record<string, { brazil?: string; abroad?: string }>;
  /** Per-proposal hero subtitle overrides (double-click the line under "The
   *  desired transaction" on the build canvas), keyed "<flowId>:<direction>".
   *  Shown on the hero and the PDF flow page. */
  heroSupport?: Record<string, string>;
  /** Technology-provider framing: the client wraps the flow instead of
   *  appearing in it. The deck draws a quiet brand-colored frame around the
   *  machinery (logo chip + caption) and suppresses the client's name/logo
   *  INSIDE the flow: boxes, the hero station, the desired-transaction arc. */
  platform?: PlatformFraming;
  /** Dominant color extracted from the uploaded logo (frame default). */
  brandColor?: string;
  /** Hide the Pay-in / Pay-out switch on the client link — the flow presents
   *  only the stored direction. */
  hideDirectionToggle?: boolean;
  /** Which directions the proposal offers the client. "collection" /
   *  "disbursement" lock the link to that single direction and remove the
   *  switch entirely (the other function isn't part of the offer). */
  clientDirections?: "both" | "collection" | "disbursement";
}

export interface PlatformFraming {
  enabled: boolean;
  /** Frame color; defaults to brandColor, then Trace mint. */
  color?: string;
  /** Client-facing caption on the frame (double-click editable on the canvas). */
  caption?: string;
  /** Flow ids that opt OUT of the frame while it's enabled. */
  except?: string[];
}

/** Does this flow render inside the client's platform frame? */
export function isPlatformFlow(config: FlowConfig, flowId: string): boolean {
  return !!config.platform?.enabled && !config.platform.except?.includes(flowId);
}

/** Client-facing flow name: the rep-side " · tailored" marker never ships. */
export function clientFlowName(name: string): string {
  return name.replace(/\s*·\s*tailored\s*$/i, "").trim();
}

// ── Settlement options ────────────────────────────────────────────────────────
// A flow with settlement options is rendered through applySettlement: a pure
// flow→flow transform, so the layout engine and every renderer stay untouched.
// The deck's toggle just picks which variant of the flow they see.

/** The settlement choices a flow offers: the converting leg's primary output
 *  first, then its extra options. Empty when the flow has none. */
export function settlementChoices(flow: Pick<Flow, "legs">): SettlementOption[] {
  const leg = flow.legs.find((l) => l.convertsTo && l.settlements?.length);
  if (!leg) return [];
  return [{ out: leg.convertsTo! }, ...leg.settlements!];
}

/** The flow as settlement option `i` tells it: the converting leg delivers
 *  that option's currency, downstream legs carry it onward (currency
 *  continuity), the headline mirrors it, and the option's box relabels apply.
 *  i = 0 (or no options) returns the flow unchanged. */
export function applySettlement(flow: Flow, i: number): Flow {
  const choices = settlementChoices(flow);
  const opt = choices[i];
  if (!opt || i === 0) return flow;
  const legIdx = flow.legs.findIndex((l) => l.convertsTo && l.settlements?.length);
  const convLeg = flow.legs[legIdx];
  const primary = convLeg.convertsTo!;
  // Everything the converted value flows through — legs reachable from the
  // converting leg's destination while the currency stays continuous. Graph
  // reachability, not array order: a tailored flow's legs may be stored in
  // the order they were drawn.
  const downstream = new Set<number>();
  const frontier = [convLeg.to];
  const visited = new Set<string>();
  while (frontier.length) {
    const at = frontier.pop()!;
    if (visited.has(at)) continue;
    visited.add(at);
    flow.legs.forEach((l, li) => {
      if (l.from === at && l.carries === primary && !downstream.has(li)) {
        downstream.add(li);
        frontier.push(l.to);
      }
    });
  }
  const legs = flow.legs.map((l, li) => {
    if (li === legIdx) return { ...l, convertsTo: opt.out };
    if (downstream.has(li)) return { ...l, carries: opt.out };
    return l;
  });
  const nodes = opt.nodeLabels
    ? flow.nodes.map((n) => (opt.nodeLabels![n.id]?.trim() ? { ...n, label: opt.nodeLabels![n.id].trim() } : n))
    : flow.nodes;
  const headline =
    flow.headline.convertsTo === primary ? { ...flow.headline, convertsTo: opt.out } : flow.headline;
  return { ...flow, legs, nodes, headline };
}

// ── Computed-field rules (spec §2.1), kept here so they're auditable ──────────

/** settlement-form ← rail: virtual-asset iff rail = VA-delivery, else fiat. */
export function settlementForm(rail: DialCoordinate["rail"]): "virtual-asset" | "fiat" {
  return rail === "VA-delivery" ? "virtual-asset" : "fiat";
}

/**
 * trace-role ← two independent triggers (spec §2.1), verified across all eleven:
 *  - VASP iff a virtual asset (USDT/C) appears anywhere in the flow.
 *  - Correspondente Cambial iff rail ≠ stablecoin-sandwich AND value is held in a
 *    bank-held NRA OR a fiat FX runs at the bank/treasury.
 *    (A stablecoin-sandwich suppresses CC even with a bank-held NRA.)
 */
export function computeTraceRole(flow: Pick<Flow, "dials" | "legs">): TraceRole[] {
  const roles: TraceRole[] = [];
  // Any stablecoin-bearing leg makes Trace a VASP — including the "USD/USDT"
  // currency used by the Foreigner-to-BR pair (#11 / #11.1), not just "USDC/USDT".
  const hasVA = flow.legs.some((l) =>
    [l.carries, l.convertsTo].some((c) => c === "USDC/USDT" || c === "USD/USDT"),
  );
  if (hasVA) roles.push("VASP");

  const { rail, nraOwnership } = flow.dials;
  const bankHeldNra = nraOwnership !== "none";
  const fiatFx = flow.legs.some(
    (l) => l.convertsTo === "USD/EUR" && l.carries === "BRL",
  );
  if (rail !== "stablecoin-sandwich" && (bankHeldNra || fiatFx)) {
    roles.push("Correspondente Cambial");
  }
  return roles;
}
