import { FLOWS, getFlow } from "../data";
import { TRACE_REPS } from "../data/reps";
import { deckPricing, normalizePricing, type Flow, type ProposalPricing } from "../data/schema";
import { deckReadyChecks, normalizeTailored } from "../data/custom-flows";
import guardrails from "./guardrails.json";
import type { PricingFloors, ProposalSpec, TailoredFlowIssue, ValidateResult } from "./spec";

export function pricingFloors(): PricingFloors {
  return (guardrails as { floors: PricingFloors }).floors;
}

/** Gate a composed ProposalSpec through the same code the app uses (roster,
 *  flow library, normalizeTailored + deckReadyChecks, normalizePricing + floor
 *  guardrails). Emits either a normalized spec ready for config assembly or a
 *  list of errors/questions. */
export function validateSpec(spec: ProposalSpec): ValidateResult {
  const errors: string[] = [];
  const flags: string[] = [];
  const questions: string[] = [];
  const tailoredIssues: TailoredFlowIssue[] = [];

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
        tailoredIssues.push({
          flow: normalized.title,
          failing: failing.map((c) => ({ label: c.label, hint: c.hint })),
        });
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
  const floors = pricingFloors();
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
    return { ok: false, errors, questions, flags, tailoredIssues };
  }

  // ── normalized output for config assembly ──
  const now = new Date();
  return {
    ok: true,
    flags,
    spec: {
      ...spec,
      date: spec.date ?? now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      salesperson: rep ? { name: rep.name, title: rep.title, email: rep.email } : undefined,
      flows: flows.map((f) => ({ flowId: f.id, name: f.name, tailored: f.tailored })),
      pricing: pricing!,
      collected: spec.collected ?? "BRL",
      delivered: spec.delivered ?? "USD",
    },
  };
}
