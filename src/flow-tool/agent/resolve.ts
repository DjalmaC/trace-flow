import { resolve as resolveFlows } from "../intake/resolver";
import { QUESTIONS as INTAKE_QUESTIONS } from "../intake/questions";
import type { Extraction, ResolveResult } from "./spec";

/** Run an extraction's dial answers through the product's real intake resolver.
 *  Reports the matching flow(s) or exactly which dials are still open. */
export function resolveExtraction(extraction: Extraction): ResolveResult {
  const answers = extraction.dials ?? {};
  const validIds = new Set(INTAKE_QUESTIONS.map((q) => q.id));
  const badKeys = Object.keys(answers).filter((k) => !validIds.has(k));
  const badValues = INTAKE_QUESTIONS.flatMap((q) => {
    const v = answers[q.id];
    return v && !q.options.some((o) => o.value === v) ? [`${q.id}=${v}`] : [];
  });
  if (badKeys.length || badValues.length) {
    return { status: "invalid-answers", badKeys, badValues };
  }
  const r = resolveFlows(answers);
  const open = INTAKE_QUESTIONS.filter((q) => !answers[q.id]).map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options.map((o) => ({ value: o.value, label: o.label })),
  }));
  return {
    status: r.status,
    candidates: r.candidates.map((f) => ({ id: f.id, displayId: f.displayId, title: f.title, blurb: f.blurb })),
    exactFlowId: r.status === "exact" ? r.candidates[0]?.id : undefined,
    direction: r.direction,
    openQuestions: r.status === "exact" ? [] : open,
  };
}
