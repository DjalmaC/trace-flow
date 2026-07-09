// Deterministic core of the /proposal-from-call skill. Two commands:
//
//   npx tsx scripts/agent/resolve-and-validate.ts resolve  <extraction.json>
//   npx tsx scripts/agent/resolve-and-validate.ts validate <spec.json>
//
// `resolve` runs the extracted dial answers through the product's real intake
// resolver and reports the matching flow(s) or exactly which dials are still
// open. `validate` takes the composed ProposalSpec and gates every part of it
// through the same code the app uses (roster, flow library, normalizeTailored
// + deckReadyChecks, normalizePricing + floor guardrails), emitting either a
// normalized spec ready for create-link.mjs or a list of errors/questions.
// The LLM never gets to be creative past this file.

import { readFileSync } from "node:fs";
import { resolve as resolveFlows } from "../../src/flow-tool/intake/resolver";
import { QUESTIONS as INTAKE_QUESTIONS } from "../../src/flow-tool/intake/questions";
import { FLOWS, getFlow } from "../../src/flow-tool/data";
import { TRACE_REPS } from "../../src/flow-tool/data/reps";
import {
  deckPricing,
  normalizePricing,
  type Currency,
  type Flow,
  type ProposalPricing,
  type ProposalType,
} from "../../src/flow-tool/data/schema";
import { deckReadyChecks, normalizeTailored } from "../../src/flow-tool/data/custom-flows";
import guardrails from "./guardrails.json";

interface Extraction {
  company?: string;
  domain?: string;
  contact?: string;
  repId?: string;
  dials?: Record<string, string>; // question id -> option value, per questions.ts
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

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const [, , command, file] = process.argv;
if (!command || !file) die("usage: resolve-and-validate.ts <resolve|validate> <json-file>");
const input = JSON.parse(readFileSync(file, "utf8"));

if (command === "resolve") {
  const ex = input as Extraction;
  const answers = ex.dials ?? {};
  const validIds = new Set(INTAKE_QUESTIONS.map((q) => q.id));
  const badKeys = Object.keys(answers).filter((k) => !validIds.has(k));
  const badValues = INTAKE_QUESTIONS.flatMap((q) => {
    const v = answers[q.id];
    return v && !q.options.some((o) => o.value === v) ? [`${q.id}=${v}`] : [];
  });
  if (badKeys.length || badValues.length) {
    console.log(JSON.stringify({ status: "invalid-answers", badKeys, badValues }, null, 2));
    process.exit(2);
  }
  const r = resolveFlows(answers);
  const open = INTAKE_QUESTIONS.filter((q) => !answers[q.id]).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options.map((o) => ({ value: o.value, label: o.label })),
  }));
  console.log(
    JSON.stringify(
      {
        status: r.status,
        candidates: r.candidates.map((f) => ({ id: f.id, displayId: f.displayId, title: f.title, blurb: f.blurb })),
        exactFlowId: r.status === "exact" ? r.candidates[0]?.id : undefined,
        direction: r.direction,
        openQuestions: r.status === "exact" ? [] : open,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (command !== "validate") die(`unknown command: ${command}`);

const spec = input as ProposalSpec;
const errors: string[] = [];
const flags: string[] = [];
const questions: string[] = [];

// ── identity ──
if (!spec.company?.trim()) errors.push("company is required");
const rep = TRACE_REPS.find((r) => r.id === spec.repId);
if (!rep) errors.push(`repId "${spec.repId}" is not in the roster (${TRACE_REPS.map((r) => r.id).join(", ")})`);
if (spec.proposalType !== "standard" && spec.proposalType !== "brazil-market")
  errors.push(`proposalType must be standard|brazil-market, got "${spec.proposalType}"`);
if (spec.direction !== "collection" && spec.direction !== "disbursement")
  errors.push(`direction must be collection|disbursement, got "${spec.direction}"`);

// ── flows ──
const flows: { id: string; name: string; tailored?: Flow }[] = [];
for (const ref of spec.flows ?? []) {
  if (ref.flowId) {
    const f = getFlow(ref.flowId) ?? FLOWS.find((x) => x.id === ref.flowId);
    if (!f) {
      errors.push(`flowId "${ref.flowId}" not found in the library`);
      continue;
    }
    flows.push({ id: f.id, name: ref.name ?? f.title });
  } else if (ref.tailored) {
    const normalized = normalizeTailored({ ...ref.tailored, custom: true, customFor: spec.company });
    const checks = deckReadyChecks(normalized);
    const failing = checks.filter((c) => !c.ok);
    if (failing.length) {
      errors.push(
        `tailored flow "${normalized.title}" fails deck-ready checks: ${failing.map((c) => `${c.label} (${c.hint ?? ""})`).join("; ")}`,
      );
      continue;
    }
    const stripped: Flow = { ...normalized, editor: undefined };
    flows.push({ id: stripped.id, name: ref.name ?? stripped.title, tailored: stripped });
  } else {
    errors.push("each flow entry needs flowId or tailored");
  }
}
if (!flows.length) errors.push("at least one flow is required");

// ── pricing ──
const floors: Record<string, number> = (guardrails as { floors: Record<string, number> }).floors;
let pricing: ProposalPricing | null = null;
if (!spec.pricing) {
  errors.push("pricing is required (start from the deck)");
} else {
  pricing = normalizePricing(spec.pricing, spec.proposalType);
  const deck = deckPricing(spec.proposalType);
  const deckKeys = new Set(deck.cards.map((c) => c.key));
  const removedProducts = deck.cards.filter((dc) => !pricing!.cards.some((c) => c.key === dc.key));
  if (removedProducts.length)
    flags.push(`deck products removed from the offer: ${removedProducts.map((c) => c.title).join(", ")} (their PDF pages drop out)`);
  for (const card of pricing.cards) {
    if (!deckKeys.has(card.key))
      flags.push(`pricing card "${card.key}" ("${card.title}") is a custom product group — confirm it belongs in the offer`);
    const floor = floors[card.key];
    const numericTiers = card.type === "flat"
      ? [{ label: "flat", value: card.flat ?? 0, text: card.flatText }]
      : card.tiers;
    let prev = Infinity;
    for (const t of numericTiers) {
      if (t.text?.trim()) {
        flags.push(`"${card.key}" tier "${t.label}" is free text ("${t.text.trim()}") — confirm it's intentional`);
        continue;
      }
      if (floor != null && t.value < floor) {
        questions.push(
          `"${card.key}" ${t.label} = ${t.value} is below the floor (${floor}). Approve explicitly or correct it.`,
        );
      }
      if (t.value > prev) flags.push(`"${card.key}" tiers are not non-increasing at "${t.label}" — volume discounts usually fall`);
      prev = t.value;
    }
  }
}

// ── logo ──
if (spec.logo) {
  if (!spec.logo.dataUrl?.startsWith("data:image/")) errors.push("logo.dataUrl must be a data:image/* URL (upload result from /logo-lab)");
} else {
  flags.push("no logo — the deck will show the client-name monogram (acceptable fallback, but flag it in the report)");
}

if (errors.length || questions.length) {
  console.log(JSON.stringify({ ok: false, errors, questions, flags }, null, 2));
  process.exit(errors.length ? 2 : 3);
}

// ── normalized output for create-link.mjs ──
const now = new Date();
const normalized = {
  ...spec,
  date: spec.date ?? now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  salesperson: rep ? { name: rep.name, title: rep.title, email: rep.email } : undefined,
  flows: flows.map((f) => ({ flowId: f.id, name: f.name, tailored: f.tailored })),
  pricing,
  collected: spec.collected ?? "BRL",
  delivered: spec.delivered ?? "USD",
};
console.log(JSON.stringify({ ok: true, flags, spec: normalized }, null, 2));
