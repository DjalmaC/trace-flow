// Shared Notes text for the five BRLT designs (F01 to F04 and the M01
// mechanism). Lives in the Notes drawer / Notes page only, never under a
// diagram. Status and provider candidates are qualifications of proposed
// arrangements, not confirmations. No source links ship in the bundle.

export const BRLT_STATUS_LINE = "Status: proposed architecture, not confirmation of production support.";

export const BRLT_COMMON_NOTES = `Common notes
- Mastercard: proposed routing, coordination and payout-network access in the cross-border flows; designated network settlement in the card flows. Dashed arrows are instructions, not custody or transfers.
- BVNK: may provide wallet, conversion or execution functions. No contract exists; it remains optional.
- Rain: a possible eligible card-program and network-access route, not proof of BRLT support and not an obligatory extra funds hop.
- Anchorage Digital: support belongs in institutional custody and access and in mint and redeem arrangements. Not a node in every payment.
- Banco Intex: Trace's acquired Brazilian FX bank is the working banking layer. Permissions, legal entities and operational account arrangements still require mapping.
- Non-resident or virtual accounts: a possible institutional BRL-access structure; a virtual identifier is not automatically a separate legal account.
- Acceptance: direct BRLT acceptance is a dependency for F03. F04 requires the chosen USD token and chain to be accepted. Trace support spans Ethereum, Polygon, Solana, Base and Optimism; that does not establish network acceptance of every pair.
- FX: specify quote, timing and exposure owner when BRLT funds a foreign-currency obligation. A different conversion location does not remove currency risk.
- Liquidity: identify executable liquidity for the beneficiary or network obligation; later LP resale or redemption is a separate treasury decision.
- Yield: optional vault participation stays separate from available payment balances pending product terms. No promised return or automatic accrual on settlement balances.
- Ownership: record wallet operator, beneficial holder, FX principal and account holder separately even where a commercial view groups functions.
- Failure handling: an unknown transaction state triggers reconciliation before any fallback; token receipt alone is not fiat-payment completion.
- Supply: mint increases BRLT supply against approved reserve funding; secondary purchase, transfer and LP resale do not. Primary redemption retires tokens and tracks the BRL payable. Reserve backing, working liquidity and vault allocations stay distinct.`;

/** A flow's Notes: status, its own bullets, then the common notes. */
export function brltNotes(own: string[]): string {
  return [BRLT_STATUS_LINE, own.map((b) => `- ${b}`).join("\n"), BRLT_COMMON_NOTES].join("\n\n");
}
