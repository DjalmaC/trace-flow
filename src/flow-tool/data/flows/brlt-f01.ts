import type { Currency, Flow } from "../schema";
import { brltNotes } from "./brlt-common";

// F01 — Overseas funding → BRLT → Brazilian payout (proposed).
// Final design (Sep 2026): an overseas institution uses BRLT as the bridge
// asset for payments into Brazil. It submits the payment request through
// Mastercard, which orchestrates the participants inside the proposed
// orchestration scope (coordination, not ownership or custody). Funds: USD or
// USD stablecoin to Trace or an LP, BRLT to the institution's balance, BRLT to
// Trace / Intex on execution, BRL to the beneficiary through Pix. The one FX
// moment is at Trace / Intex, which converts or redeems the BRLT.
export const brltF01: Flow = {
  id: "brlt-f01",
  displayId: "F01",
  specId: "F01",
  title: "Overseas funding → BRLT → Brazilian payout",
  proposed: true,
  ownInitiator: true,
  dials: { model: "Foreigner-to-BR", rail: "stablecoin-sandwich", nraOwnership: "none", pixRole: "settler", localLp: false },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "The institution initiates through Mastercard; execution occurs through the coordinated providers.",
    disbursement: "The institution initiates through Mastercard; execution occurs through the coordinated providers.",
  },
  blurb: "Proposed. Cross-border, into Brazil. An overseas institution uses BRLT as the bridge asset: Mastercard orchestrates, Trace or a liquidity provider funds BRLT, Trace / Intex pays BRL through Pix.",
  narrative:
    "An overseas institution uses BRLT as the bridge asset for making payments into Brazil. It submits a Brazilian payment request through Mastercard, which orchestrates the transaction across the required participants: the institution funds USD or an accepted USD stablecoin to Trace or a liquidity provider, receives BRLT in its balance, and on execution the required BRLT moves to Trace / Banco Intex, which converts or redeems it and pays BRL to the beneficiary through Pix.",
  headline: { partyA: "A", partyB: "E", carries: "USD/USDC" as Currency, convertsTo: "BRL" },
  nodes: [
    { id: "A", label: "Overseas institution", kind: "client", lane: "abroad" },
    { id: "B", label: "Trace Finance or liquidity provider", kind: "trace", lane: "abroad" },
    { id: "C", label: "Institution's BRLT balance", kind: "client", lane: "abroad" },
    { id: "D", label: "Trace Finance + Intex Bank", kind: "trace", lane: "brazil" },
    { id: "E", label: "Brazilian beneficiary", kind: "merchant", lane: "brazil" },
    { id: "M", label: "Payment orchestration", kind: "operational", lane: "abroad", authorizer: true },
  ],
  legs: [
    { id: "F01-E01", from: "A", to: "B", carries: "USD/USDC" as Currency, label: "1. USD or USD stablecoin" },
    { id: "F01-E02", from: "B", to: "C", carries: "BRLT", label: "2. BRLT" },
    { id: "F01-E03", from: "C", to: "D", carries: "BRLT", convertsTo: "BRL", crosses: true, label: "3. BRLT for payment" },
    { id: "F01-E04", from: "D", to: "E", carries: "BRL", label: "4. BRL through Pix" },
    { id: "F01-E05", from: "A", to: "M", carries: "USD/USDC" as Currency, kind: "instruction", label: "Payment request" },
    { id: "F01-E06", from: "M", to: "B", carries: "BRLT", kind: "instruction", label: "Arrange BRLT funding" },
    { id: "F01-E07", from: "M", to: "D", carries: "BRLT", kind: "instruction", label: "Execute Brazilian payout" },
  ],
  scope: { label: "Mastercard · proposed orchestration scope", caption: "Not ownership or custody", nodes: ["B", "C", "D", "M"] },
  sameActor: [
    { headlineNode: "A", machineryNode: "A" },
    { headlineNode: "E", machineryNode: "E" },
  ],
  steps: [
    "The overseas institution submits a Brazilian payment request through Mastercard.",
    "Mastercard orchestrates the transaction across the required participants.",
    "The institution sends USD or an accepted USD stablecoin to Trace or a liquidity provider.",
    "Trace or the liquidity provider delivers the corresponding BRLT to the institution's BRLT balance.",
    "When the payment is executed, the required BRLT is transferred to Trace / Banco Intex.",
    "Trace / Banco Intex converts or redeems the BRLT and pays BRL to the Brazilian beneficiary through Pix.",
  ],
  notes: brltNotes([
    "Mastercard's role is to coordinate BRLT funding and execution of the Brazilian payout. Mastercard does not necessarily hold the BRLT or BRL; the orchestration boundary represents operational coordination rather than custody.",
    "USD fiat and USD-stablecoin funding are alternatives; the diagram is not split into extra routes.",
    "BRLT may come from existing inventory or approved primary issuance; there is no mint or burn tree in this flow.",
    "Custody, account ownership, quote timing, fees, token and chain acceptance and payout completion rules remain to be specified.",
    "Shared treasury behaviour (allocation, resale, redemption) is explained in the separate mechanism M01.",
  ]),
};
