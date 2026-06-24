import type { DialCoordinate, Direction } from "../data/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Guided intake (build brief §5a). A short questionnaire whose answers assemble a
// dial coordinate. Each option carries a partial DialCoordinate patch (and Q1
// carries a direction). The resolver (resolver.ts) merges the patches and matches
// against the flow library. Phrasing is for a salesperson; (client) vs (policy)
// follows the "Intake → Dials — Resolution Rules" doc.
// ─────────────────────────────────────────────────────────────────────────────

export interface IntakeOption {
  value: string;
  label: string;
  /** Dials this answer pins down. */
  patch?: Partial<DialCoordinate>;
  /** Q1 only: orientation (orthogonal to the match). */
  direction?: Direction;
}

export interface IntakeQuestion {
  id: string;
  prompt: string;
  /** "client" = stated on the call; "policy" = Trace's call from the playbook. */
  source: "client" | "policy";
  help?: string;
  options: IntakeOption[];
}

export const QUESTIONS: IntakeQuestion[] = [
  {
    id: "direction",
    prompt: "Is Trace collecting into Brazil, or paying out of Brazil?",
    source: "client",
    help: "Orthogonal to the structure — it orients the arrow and the conversion, every flow supports both.",
    options: [
      { value: "collection", label: "Collecting into Brazil (pay-in)", direction: "collection" },
      { value: "disbursement", label: "Paying out of Brazil (pay-out)", direction: "disbursement" },
    ],
  },
  {
    id: "model",
    prompt: "Who is the client, and how do they move funds?",
    source: "client",
    options: [
      { value: "efx-only", label: "eFX / FX service provider, no offshore account", patch: { model: "eFX-only" } },
      { value: "efx-nra", label: "eFX / FX service provider settling through an NRA", patch: { model: "eFX+NRA" } },
      { value: "nra-direct", label: "Pix Inc intermediates directly for an international counterparty", patch: { model: "NRA-direct" } },
      { value: "va", label: "Brazilian company buying / receiving value abroad", patch: { model: "VA" } },
      { value: "va-nra", label: "Foreign entity collecting from Brazil", patch: { model: "VA+NRA" } },
    ],
  },
  {
    id: "nra",
    prompt: "Is a non-resident account (NRA) used to hold value offshore — and whose?",
    source: "policy",
    help: "Usually Trace's call from volume / product / relationship.",
    options: [
      { value: "none", label: "No NRA in the flow", patch: { nraOwnership: "none" } },
      { value: "pix-own", label: "Pix Inc's own NRA", patch: { nraOwnership: "pix-own" } },
      { value: "third-party", label: "A customer's NRA", patch: { nraOwnership: "third-party" } },
    ],
  },
  {
    id: "rail",
    prompt: "How does value cross the border?",
    source: "client",
    options: [
      { value: "direct-fiat", label: "Bank FX — fiat in, fiat out at the partner bank", patch: { rail: "direct-fiat" } },
      { value: "treasury-fiat", label: "Through Pix Inc's treasury (fiat)", patch: { rail: "treasury-fiat" } },
      { value: "stablecoin-sandwich", label: "Stablecoin bridge — crypto only to cross, fiat out", patch: { rail: "stablecoin-sandwich" } },
      { value: "va-delivery", label: "Deliver the stablecoin itself (no fiat-out)", patch: { rail: "VA-delivery" } },
    ],
  },
  {
    id: "liquidity",
    prompt: "What is Pix Inc's role, and is there a local liquidity provider?",
    source: "policy",
    help: "The two-node 'liquidity provider' pattern is what separates #7/#8 from #3/#4.",
    options: [
      { value: "none", label: "Pix Inc is not carrying value", patch: { pixRole: "none", localLp: false } },
      { value: "settler", label: "Pix Inc settles the principal across", patch: { pixRole: "settler", localLp: false } },
      { value: "treasury", label: "Pix Inc runs BRL↔USD/EUR on its own treasury", patch: { pixRole: "treasury", localLp: false } },
      { value: "liquidity-provider", label: "Pix Inc funds the NRA holder as LP (two nodes abroad)", patch: { pixRole: "liquidity-provider", localLp: false } },
      { value: "local-lp", label: "A local provider sources BRL inside Brazil (VA trades)", patch: { pixRole: "settler", localLp: true } },
    ],
  },
];

export type IntakeAnswers = Record<string, string>;
