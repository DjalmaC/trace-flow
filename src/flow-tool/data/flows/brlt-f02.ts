import type { Flow } from "../schema";
import { brltNotes } from "./brlt-common";

// F02 — Brazilian collection → BRLT → overseas payout (proposed).
// Final design (Sep 2026): a Brazilian business funds an international payment
// in BRL, with BRLT as the cross-border bridge asset. Trace / Intex collects
// BRL and issues BRLT, submits the cross-border request to Mastercard, which
// orchestrates the payment service, the liquidity provider's conversion and
// the overseas payout inside the proposed orchestration scope. The one FX
// moment is at the liquidity provider. "USD/EUR" is the app's delivered-fiat
// token: the proposal picks the destination currency.
export const brltF02: Flow = {
  id: "brlt-f02",
  displayId: "F02",
  specId: "F02",
  title: "Brazilian collection → BRLT → overseas payout",
  proposed: true,
  ownInitiator: true,
  dials: { model: "VA", rail: "stablecoin-sandwich", nraOwnership: "none", pixRole: "liquidity-provider", localLp: true },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "Trace receives BRL and submits the cross-border payment request to Mastercard for orchestration.",
    disbursement: "Trace receives BRL and submits the cross-border payment request to Mastercard for orchestration.",
  },
  blurb: "Proposed. Cross-border, out of Brazil. A Brazilian business funds in BRL, Trace / Intex issues BRLT, Mastercard orchestrates the conversion by a liquidity provider and the overseas payout.",
  narrative:
    "A Brazilian business funds an international payment in BRL, with BRLT used as the cross-border bridge asset. Trace / Banco Intex converts the collected BRL into BRLT and passes it to the payment service handling the transaction; the liquidity provider converts the BRLT into the destination currency and delivers fiat to the payout institution, which pays the overseas beneficiary through local banking rails. Mastercard receives the cross-border instruction and coordinates the conversion and payout.",
  headline: { partyA: "A", partyB: "F", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "A", label: "Brazilian business", kind: "client", lane: "brazil" },
    { id: "B", label: "Trace Finance + Intex Bank", kind: "trace", lane: "brazil" },
    { id: "C", label: "Payment service", kind: "operational", lane: "abroad" },
    { id: "D", label: "Liquidity provider", kind: "operational", lane: "abroad" },
    { id: "E", label: "Destination payout institution", kind: "operational", lane: "abroad" },
    { id: "F", label: "Overseas beneficiary", kind: "merchant", lane: "abroad" },
    { id: "M", label: "Payment orchestration", kind: "operational", lane: "abroad", authorizer: true },
  ],
  legs: [
    { id: "F02-E01", from: "A", to: "B", carries: "BRL", label: "1. BRL" },
    { id: "F02-E02", from: "B", to: "C", carries: "BRLT", crosses: true, label: "2. BRLT" },
    { id: "F02-E03", from: "C", to: "D", carries: "BRLT", convertsTo: "USD/EUR", label: "3. BRLT for conversion" },
    { id: "F02-E04", from: "D", to: "E", carries: "USD/EUR", label: "4. Destination fiat" },
    { id: "F02-E05", from: "E", to: "F", carries: "USD/EUR", label: "5. Local bank payout" },
    { id: "F02-E06", from: "B", to: "M", carries: "BRLT", kind: "instruction", label: "Cross-border payment request" },
    { id: "F02-E07", from: "M", to: "C", carries: "BRLT", kind: "instruction", label: "Arrange BRLT conversion" },
    { id: "F02-E08", from: "M", to: "E", carries: "USD/EUR", kind: "instruction", label: "Execute overseas payout" },
  ],
  scope: { label: "Mastercard · proposed orchestration scope", caption: "Not ownership or custody", nodes: ["C", "D", "E", "M"] },
  sameActor: [
    { headlineNode: "A", machineryNode: "A" },
    { headlineNode: "F", machineryNode: "F" },
  ],
  steps: [
    "The Brazilian business sends BRL to Trace / Banco Intex.",
    "Trace / Banco Intex converts the collected BRL into BRLT.",
    "The BRLT is transferred to the payment service handling the cross-border transaction.",
    "The payment service sends the BRLT to a liquidity provider for conversion into the destination currency.",
    "The liquidity provider delivers destination fiat to the destination payout institution.",
    "The payout institution transfers the funds through local banking rails to the overseas beneficiary.",
  ],
  notes: brltNotes([
    "Mastercard receives the cross-border payment instruction and coordinates the conversion and overseas payout. Trace / Banco Intex manages the Brazilian collection and BRLT issuance; Mastercard connects that leg to the downstream conversion and payout network.",
    "The payment service, liquidity provider and payout institution are separate nodes even if one contracted provider later fills several roles.",
    "BVNK is a possible execution provider, not a contracted or mandatory participant.",
    "Destination fiat is supplied directly; a USD-stablecoin intermediate leg is an optional future variant, not an extra default node.",
    "The liquidity provider's inventory disposition belongs in the separate mechanism M01.",
    "Record quote, FX and liquidity responsibility, fees and beneficiary-payment finality in Notes and operational data.",
  ]),
};
