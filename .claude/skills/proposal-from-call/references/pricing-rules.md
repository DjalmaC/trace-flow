# Pricing rules

The deck is the default. The transcript can only make pricing BETTER-GROUNDED,
never invented.

## Where numbers come from

1. Start from `deckPricing(proposalType)` — the exact card structure lives in
   `src/flow-tool/data/schema.ts`. Standard: Pix API (USD, FLAT $0.06/pix) + FX
   spread (%, 5 tiers). Brazil-market: non-resident account (%), PixInc payins
   (%), on-ramp BRL→USDT (%), off-ramp USDT→BRL (%) — 3 tiers each — and Pix
   payout (USD, FLAT $0.06/tx; the rep can switch its unit to R$ in this deck).
   Pix is ALWAYS flat by policy — never propose Pix tiers.
2. Apply an override ONLY when the call contains a commitment, and record it in
   `pricingEvidence` with the verbatim quote. "We can probably do better on
   spread" is NOT a commitment — flag it as a negotiation note instead.
3. Tier-specific commitments patch that tier; "flat X for everything" switches
   the card to `type: "flat"` with `flat: X`.
4. A rate expressed as text ("free for the pilot", "negotiable above 100M")
   goes in the tier's `text` field — the validator flags it for confirmation.

## Guardrails (enforced by the validator — do not fight them)

- Floors per product in `scripts/agent/guardrails.json`. Below floor → the
  validator emits a question; surface it to Diogo verbatim and stop.
- Tiers should be non-increasing as volume grows; the validator flags
  inversions (they're usually extraction mistakes).
- Never change `prefix`/`suffix`/units — a "0.05" spread quote is %, a "5 cents
  per pix" quote is USD 0.05. Currency confusion is the classic failure: BRL
  quotes belong only on the Brazil-market `pixout` card.

## Presentation

- Keep `mode: "custom"` whenever anything differs from the deck; the deck page
  in the PDF is then live-rendered with the client's numbers (this is automatic).
- In the report, show the full pricing table with each overridden cell marked
  and its quote underneath; deck-default cells are marked "deck".
