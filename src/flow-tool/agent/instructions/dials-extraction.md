# Transcript → dials

The resolver picks the flow; you only answer its five questions from what was
actually said. Answer a question ONLY when the transcript supports it (quote
required in `dialEvidence`). An unanswered question is fine — the resolver
narrows candidates and the skill asks Diogo the rest.

## The five questions (ids and valid values)

### `direction` — which way is the money moving? (client says)
- `collection` — collecting INTO Brazil (pay-in). Cues: "receber no Brasil", client's payers are Brazilian, "collect from Brazilian customers".
- `disbursement` — paying OUT of Brazil (pay-out). Cues: "pagar fornecedores fora", payouts to merchants abroad.
- Both discussed → pick the one the proposal centers on; note the other (every flow supports both at present-time via the toggle).

### `model` — who is the client, how do they move funds? (client says)
- `efx-only` — an eFX / FX service provider, no offshore account of their own.
- `efx-nra` — an eFX / FX provider settling through a non-resident account.
- `nra-direct` — no eFX in the picture; Pix Inc intermediates directly for an international counterparty.
- `va` — a Brazilian company buying / receiving value abroad (local buyer).
- `va-nra` — a foreign entity collecting from Brazil.
- Cues: "we're a payment provider / eFX" → efx-*; "we're a Brazilian importer/buyer" → va; "we're a US company selling into Brazil" → va-nra.

### `nra` — is a non-resident account used, and whose? (often Trace's policy call)
- `none` — no NRA mentioned or needed.
- `pix-own` — Pix Inc's own NRA ("our account", "Trace's NRA").
- `third-party` — the CUSTOMER's NRA ("their account at the partner bank", "the client already has an NRA").
- If genuinely undiscussed, leave it open — this is a policy dial Diogo often sets.

### `rail` — how does value cross the border? (client says)
- `direct-fiat` — bank FX, fiat in fiat out at the partner bank.
- `treasury-fiat` — through Pix Inc's treasury, fiat only, no crypto.
- `stablecoin-sandwich` — crypto ONLY to cross; the far end receives fiat. Cues: "usar stablecoin só para a ponte", "settle in dollars but bridge with USDT".
- `va-delivery` — the client RECEIVES the stablecoin itself, no fiat-out. Cues: "deliver USDC to their wallet", "they want to hold USDT".

### `liquidity` — Pix Inc's role / local liquidity provider? (policy)
- `none` — Pix Inc not carrying value.
- `settler` — Pix Inc settles the principal across.
- `treasury` — Pix Inc runs BRL↔USD/EUR on its own treasury.
- `liquidity-provider` — Pix Inc funds the NRA holder as LP (the two-node pattern; separates flows 7/8 from 3/4).
- `local-lp` — a local provider sources BRL inside Brazil (VA trades; flows 9/9.1/10). NOTE: the LP never appears on the client deck — it's internal.

## Flow cheat sheet (what exact resolution lands on)

| id | # | title | one-liner |
|---|---|---|---|
| flow-1 | 1 | eFX · direct bank FX | eFX provider, FX executed at Trace's partner bank. The baseline flow. |
| flow-2 | 2 | eFX · deliver stablecoin (client's account) | eFX + third-party NRA; the virtual asset is delivered to the NRA holder's wallet abroad. |
| flow-3 | 3 | eFX · stablecoin bridge (Pix account) | eFX + Pix Inc's own NRA; crypto bridges the border, fiat settles the merchant. |
| flow-4 | 4 | eFX · fiat settlement (Pix account) | eFX + Pix Inc's own NRA; treasury runs BRL↔USD/EUR, no crypto. |
| flow-5 | 5 | Pix-direct · fiat settlement | No eFX; Pix Inc intermediates directly, treasury FX. |
| flow-6 | 6 | Pix-direct · stablecoin bridge | No eFX; Pix Inc intermediates directly, crypto bridges the border. |
| flow-7 | 7 | eFX · fiat settlement (client's account) | eFX + third-party NRA; Pix Inc funds the NRA holder as LP, treasury FX. |
| flow-8 | 8 | eFX · stablecoin bridge (client's account) | Twin of 7; the sandwich's two conversions split across Pix Inc's two nodes. |
| flow-9 | 9 | Local buyer · deliver stablecoin | Local customer buys a virtual asset; local LP sources BRL; asset delivered abroad. |
| flow-9.1 | 9.1 | Local buyer · stablecoin bridge to fiat | Twin of 9 — delivers fiat abroad, stablecoin only as the bridge. |
| flow-10 | 10 | Foreign collector · deliver stablecoin | Foreign NRA holder collects from Brazil; bank-held NRA + local LP; asset delivered abroad. |
| flow-11 | 11 | Foreigner to Brazilian with IP | Foreign USD/USDT → BRL at the border → Brazilian beneficiary via a local payment institution. |
| flow-11.1 | 11.1 | Foreigner to Brazilian | Same route, Pix Inc's NRA settles BRL directly (no payment institution). |

`proposalType`: `brazil-market` when the conversation is about the Brazil product
suite (non-resident account rates, PixInc payins, on/off-ramp, Pix payout fees);
`standard` for the classic cross-border pitch (Pix API + FX spread). Default
`standard` when unclear, and flag it.

## Tailored flows (only when the resolver can't match)

Compose a `Flow` object only when the transcript EXPLICITLY walks the route
("payer A and payer B both pay into our collection account, then…"). Rules:
- Nodes: `kind` ∈ operational (payer/payee) | client | trace | merchant; `lane` ∈ brazil | abroad. Use the client's real names from the call.
- Legs in story order; `carries` continues what arrived at the from-node; conversion ONLY via `convertsTo` on a leg (the FX engine), typically the border crossing.
- Merges (several payers into one account) are supported; splits are not — restructure or ask.
- The validator runs `normalizeTailored` + `deckReadyChecks` and rejects anything failing; you don't need to hand-set headline/sameActor/dials beyond the blank-flow defaults (copy the shape from `blankFlow` in `src/flow-tool/data/custom-flows.ts`).
