---
name: proposal-from-call
description: Turn a sales-call transcript into a verified, client-ready SANDBOX proposal link on trace-flow — rep matched, flow(s) resolved through the intake dials, pricing anchored to quotes, client logo treated through /logo-lab, and the rendered link verified headlessly. Use when Diogo pastes a call transcript / notes or points at a transcript file and wants a proposal drafted. The skill never creates a non-sandbox link and never contacts a client.
---

# /proposal-from-call

Turn a call transcript into a **sandbox** proposal link Diogo can review and send.
You extract facts and make flagged judgment calls; every decision that can be
deterministic goes through the product's own code via the scripts below. Run all
commands from the repo root.

## Hard rules

1. **Sandbox only.** Never pass `--approved` to create-link.ts. Promoting a link is Diogo's action, on his explicit instruction, after he has seen the sandbox.
2. **Never contact the client** or send the link anywhere. Your output is a report to Diogo, in chat.
3. **Quotes or it didn't happen.** Every dial answer and every pricing override carries a verbatim transcript quote. No quote → deck default (pricing) or open question (dials).
4. **Stop and ask** instead of guessing when: the resolver isn't `exact` and the transcript doesn't explicitly describe a custom structure; a rate is below floor; the rep on the call can't be matched to the roster; the client company name is unclear.
5. Every intermediate artifact (extraction, spec, screenshots) goes in the scratchpad, never committed.

## Inputs

Transcript pasted in the message or a file path. Optional overrides: `--client <name>`, `--domain <domain>`, `--rep <rep-id>`, `--local` (target localhost:3123 instead of production).

## Stages

### 1 · Extract
Read the transcript carefully. Write `extraction.json` (scratchpad):
`{ company, domain, contact, repId, dials: {direction, model, nra, rail, liquidity}, dialEvidence: {<id>: "<quote>"}, pricingCommitments: [{product, tier?, value, quote}], stablecoin, proposalType, customStructureNotes }`
Only include a dial answer when the transcript supports it — read `src/flow-tool/agent/instructions/dials-extraction.md` first for the mapping vocabulary and valid option values. Match the rep against the roster in `src/flow-tool/data/reps.ts` (names may be partial: "Bia" → beatriz-lara-de-mello).

### 2 · Resolve flows
```
npx tsx scripts/agent/resolve-and-validate.ts resolve <extraction.json>
```
- `exact` → use `exactFlowId`.
- `partial` / `no-match` → EITHER ask Diogo the `openQuestions` (preferred), OR — only when `customStructureNotes` explicitly describes the route — compose a tailored `Flow` object (see the tailored-flow section of `src/flow-tool/agent/instructions/dials-extraction.md`). Multiple flows discussed on the call → multiple entries, each resolved this way.

### 3 · Pricing
Read `src/flow-tool/agent/instructions/pricing-rules.md`. Start from the deck for the proposal type; apply only quote-backed commitments. Build the full `pricing` cards object.

### 4 · Logo
```
node scripts/agent/logo-ladder.mjs <domain> <scratchpad>/logos
```
Then drive `/logo-lab` headlessly (playwright, rep key in localStorage `tf:rep-key` from `.env.local` `TRACE_REP_KEY`): upload each candidate to `[data-testid="logo-file"]`, wait for `window.__logoLab.status === "done"`, screenshot, and **look at the screenshot**. Pick the best treatment: prefer `cut: true`, avoid `needsModel` unless the plate rescues it, and judge legibility on the dark preview yourself. No candidate passes → omit the logo (monogram fallback) and flag it. Record `{dataUrl, plate, treatment, source}` from the winning result.

### 5 · Compose + validate the spec
Write `spec.json`: `{ company, contact, domain, repId, proposalType, direction, stablecoin, flows: [{flowId | tailored, name}], pricing, pricingEvidence, logo, date? }`, then:
```
npx tsx scripts/agent/resolve-and-validate.ts validate <spec.json> > <spec-normalized.json>
```
`ok: false` → fix errors you can fix, surface `questions` to Diogo verbatim, and stop. Carry `flags` into the final report.

### 6 · Create the sandbox link
```
npx tsx scripts/agent/create-link.ts <spec-normalized.json>      # add --local for localhost
```

### 7 · Verify the render
```
node scripts/agent/verify-link.mjs <code> <spec-normalized.json> --outdir <scratchpad>/verify
```
All non-pdf checks must pass. Then Read the screenshots yourself (hero, pricing, closing) and judge: logo legible on dark, layout sane, nothing internal leaking (no "Local LP", no CUSTOM chips client-side). Any failure → fix the spec, delete the bad link (`DELETE /api/proposals/<code>` with the `x-tf-key` header), and redo from stage 5.

### 8 · Report to Diogo
One message: sandbox URL + password · rep · flows with the dial answers and quotes that chose them · pricing table with supporting quotes (mark deck-defaults as such) · logo source/treatment + preview screenshot · verification table · flags and open questions. Close with: "Review the sandbox; tell me to promote it (I'll regenerate clean) or what to change."

## Evals

After Diogo approves a real proposal, offer to save `{transcript, approved spec}` under `scripts/agent/evals/` — the regression set for future prompt/model changes. To replay: run stages 1–5 on each eval transcript and diff the resulting spec against the approved one.
