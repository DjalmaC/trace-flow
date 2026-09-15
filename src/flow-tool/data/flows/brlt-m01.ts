import type { Flow } from "../schema";
import { brltNotes } from "./brlt-common";

// M01 — Shared mechanism: BRLT can remain in circulation (supplementary).
// Exact topology from the design package (M01): 6 nodes, 7 funds links. Not a
// fifth payment flow: an explanatory lifecycle view showing balance
// allocation (a split), LP resale to a later holder (the N → B link is a later
// payment cycle, possibly a different institution, never a payment back to
// the original holder) and primary redemption (two asset legs, BRLT out and
// BRL back, never a self-funding loop). The corridor layout tolerates the two
// return legs and routes them as loops beneath the rail.
export const brltM01: Flow = {
  id: "brlt-m01",
  displayId: "M01",
  specId: "M01",
  title: "Shared mechanism: BRLT can remain in circulation",
  proposed: true,
  ownInitiator: true,
  mechanism: true,
  dials: { model: "VA", rail: "stablecoin-sandwich", nraOwnership: "none", pixRole: "liquidity-provider", localLp: true },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "Supplementary mechanism: how allocated BRLT reaches a liquidity provider and then stays in circulation or is redeemed.",
    disbursement: "Supplementary mechanism: how allocated BRLT reaches a liquidity provider and then stays in circulation or is redeemed.",
  },
  blurb: "Supplementary, not a payment flow. Balance allocation, LP resale to the next institutional buyer (a later payment cycle) and primary redemption with its BRL return leg.",
  narrative:
    "An institution holds BRLT and can allocate portions to different uses. The selected payment route delivers BRLT to a liquidity provider, which can sell existing BRLT to the next eligible buyer, who holds a balance for later payment cycles. Alternatively the LP surrenders BRLT through primary redemption and receives the corresponding BRL payment.",
  headline: { partyA: "B", partyB: "L", carries: "BRLT" },
  nodes: [
    { id: "B", label: "Institution's available BRLT balance", kind: "client", lane: "abroad" },
    { id: "P", label: "Brazilian payout through Trace", kind: "trace", lane: "brazil" },
    { id: "C", label: "Card or overseas-payment settlement", kind: "operational", lane: "abroad" },
    { id: "L", label: "Receiving liquidity provider", kind: "operational", lane: "abroad" },
    { id: "N", label: "Next institutional buyer", kind: "operational", lane: "abroad" },
    { id: "R", label: "Trace primary redemption", kind: "trace", lane: "brazil" },
  ],
  legs: [
    { id: "M01-E01", from: "B", to: "P", carries: "BRLT", crosses: true, label: "Allocate BRLT" },
    { id: "M01-E02", from: "B", to: "C", carries: "BRLT", label: "Allocate BRLT" },
    { id: "M01-E03", from: "C", to: "L", carries: "BRLT", label: "BRLT received through the selected route" },
    { id: "M01-E04", from: "L", to: "N", carries: "BRLT", label: "Resell existing BRLT" },
    { id: "M01-E05", from: "N", to: "B", carries: "BRLT", label: "Hold for subsequent payments" },
    { id: "M01-E06", from: "L", to: "R", carries: "BRLT", crosses: true, label: "Alternatively surrender BRLT" },
    { id: "M01-E07", from: "R", to: "L", carries: "BRL", crosses: true, label: "BRL redemption payment" },
  ],
  sameActor: [
    { headlineNode: "B", machineryNode: "B" },
    { headlineNode: "L", machineryNode: "L" },
  ],
  steps: [
    "An institution holds BRLT and can allocate portions to different uses.",
    "The selected payment route delivers BRLT to a liquidity provider.",
    "The LP can sell existing BRLT to the next eligible buyer.",
    "That buyer holds a balance for later payment cycles.",
    "Alternatively, the LP surrenders BRLT through primary redemption and receives the corresponding BRL payment.",
  ],
  notes: brltNotes([
    "M01 is a conceptual lifecycle view. The link from the next buyer back to the balance re-enters the institutional-balance role in a later cycle; it is not a mandatory transfer back to the original institution.",
    "The two redemption links are the two asset legs of redemption (BRLT surrendered, BRL paid), not a free-money loop.",
    "The LP retention option has no node; it is a balance state described in text, never a transfer to itself.",
    "BRLT can be acquired from existing inventory or approved reserve-funded primary issuance; those alternatives are not nodes in this mechanism.",
    "Reserve backing remains behind circulating tokens; resale does not release backing reserves.",
    "Illustrative allocation: an institution with 10 million BRLT could allocate 6 million to Brazilian payouts, 2 million to card settlement and retain 2 million, as simultaneous allocations. Do not count the acquisition, each resale and the payout as repeated instances of one customer payment.",
  ]),
};
