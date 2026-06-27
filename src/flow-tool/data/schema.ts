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
// "USD/USDT" is a combined cash-or-stablecoin token used by the Arq Argentina
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
  model: "eFX-only" | "eFX+NRA" | "NRA-direct" | "VA" | "VA+NRA" | "Arq Argentina";
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
}

export interface Leg {
  from: string;
  to: string;
  carries: Currency;
  /** Set => a swap capsule converts mid-leg (usually the border crossing). */
  convertsTo?: Currency;
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
  /** 0-based page index of this rep's slide in /public/proposals/sales-slides.pdf. */
  slidePage?: number;
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
  const hasVA = flow.legs.some((l) =>
    [l.carries, l.convertsTo].some((c) => c === "USDC/USDT"),
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
