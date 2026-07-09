import type { Currency, Flow, PriceCard, ProposalPricing, ProposalType } from "../data/schema";
import type { Direction } from "../data/schema";

// ─────────────────────────────────────────────────────────────────────────────
// The agent pipeline's data contract. An LLM (the /proposal-from-call skill or
// a remote Claude driving the MCP tools) extracts facts from a call into an
// Extraction, composes a ProposalSpec, and everything deterministic —
// resolution, validation, config assembly — happens in this directory using
// the same code paths the app itself runs. The LLM never gets to be creative
// past these modules.
// ─────────────────────────────────────────────────────────────────────────────

export interface Extraction {
  company?: string;
  domain?: string;
  contact?: string;
  repId?: string;
  dials?: Record<string, string>; // question id -> option value, per intake/questions.ts
  dialEvidence?: Record<string, string>;
}

export interface SpecFlowRef {
  flowId?: string;
  tailored?: Flow;
  name?: string;
}

export interface ProposalSpec {
  company: string;
  contact?: string;
  domain?: string;
  repId: string;
  proposalType: ProposalType;
  direction: "collection" | "disbursement";
  stablecoin: "USDC" | "USDT" | "both";
  collected?: Currency;
  delivered?: Currency;
  flows: SpecFlowRef[];
  pricing: ProposalPricing;
  pricingEvidence?: { product: string; tier?: string; value: number | string; quote: string }[];
  logo?: { dataUrl: string; plate: "light" | "none"; treatment: string; source: string };
  date?: string;
}

/** A validated spec, ready for config assembly: rep expanded, flows normalized,
 *  pricing normalized, defaults filled. */
export interface NormalizedSpec extends Omit<ProposalSpec, "flows" | "pricing"> {
  date: string;
  salesperson?: { name: string; title?: string; email?: string };
  flows: { flowId: string; name: string; tailored?: Flow }[];
  pricing: ProposalPricing;
  collected: Currency;
  delivered: Currency;
}

export interface ResolveCandidate {
  id: string;
  displayId: string;
  title: string;
  blurb: string;
}

export interface OpenQuestion {
  id: string;
  prompt: string;
  options: { value: string; label: string }[];
}

export type ResolveResult =
  | { status: "invalid-answers"; badKeys: string[]; badValues: string[] }
  | {
      status: "empty" | "partial" | "exact" | "no-match";
      candidates: ResolveCandidate[];
      exactFlowId?: string;
      direction: Direction;
      openQuestions: OpenQuestion[];
    };

/** One failing deck-ready check on a tailored flow, structured so an agent can
 *  fix the flow iteratively instead of parsing a concatenated message. */
export interface TailoredFlowIssue {
  flow: string;
  failing: { label: string; hint?: string }[];
}

export type ValidateResult =
  | {
      ok: false;
      errors: string[];
      questions: string[];
      flags: string[];
      tailoredIssues: TailoredFlowIssue[];
    }
  | { ok: true; flags: string[]; spec: NormalizedSpec };

/** The floors from guardrails.json, keyed by PriceCard key. */
export type PricingFloors = Record<string, number>;

export type { Flow, PriceCard, ProposalPricing, ProposalType };
