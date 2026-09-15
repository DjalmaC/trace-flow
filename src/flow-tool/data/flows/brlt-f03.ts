import type { Currency, Flow } from "../schema";
import { brltNotes } from "./brlt-common";

// F03 — Issuer settles its Mastercard obligation in BRLT (proposed).
// Final design (Sep 2026): a participating card issuer uses BRLT directly to
// settle its Mastercard obligations. The diagram begins with the issuer
// already holding BRLT (its earlier acquisition is outside the flow): one
// BRLT payment settles many cleared purchases into Mastercard's settlement
// arrangement, Mastercard completes fiat settlement with the acquirer, the
// acquirer pays the merchant. The key proposal: Mastercard recognizes BRLT as
// an eligible network settlement asset. "Fiat" is the acquirer's ordinary
// settlement currency.
const FIAT = "Fiat" as Currency;

export const brltF03: Flow = {
  id: "brlt-f03",
  displayId: "F03",
  specId: "F03",
  title: "Issuer settles its Mastercard obligation in BRLT",
  proposed: true,
  ownInitiator: true,
  dials: { model: "VA", rail: "stablecoin-sandwich", nraOwnership: "none", pixRole: "liquidity-provider", localLp: false },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "The issuer has acquired BRLT before settlement; one payment can settle many cleared purchases.",
    disbursement: "The issuer has acquired BRLT before settlement; one payment can settle many cleared purchases.",
  },
  blurb: "Proposed. Card settlement, direct BRLT. A participating issuer pays its net Mastercard obligation in BRLT; Mastercard settles the acquirer in fiat and the merchant is paid as usual.",
  narrative:
    "A participating card issuer uses BRLT directly to settle its Mastercard card obligations. Authorization and clearing occur through Mastercard's existing processes, Mastercard calculates the issuer's net settlement obligation, and the issuer transfers BRLT to the designated Mastercard settlement arrangement. Mastercard completes the corresponding fiat settlement with the acquirer, which pays the merchant in its ordinary settlement currency.",
  headline: { partyA: "I", partyB: "A", carries: "BRLT", convertsTo: FIAT },
  nodes: [
    { id: "I", label: "Participating Mastercard issuer", kind: "client", lane: "abroad" },
    { id: "S", label: "Settlement arrangement", kind: "operational", lane: "abroad", authorizer: true },
    { id: "A", label: "Acquirer", kind: "operational", lane: "abroad" },
    { id: "M", label: "Merchant", kind: "merchant", lane: "abroad" },
  ],
  legs: [
    { id: "F03-E01", from: "I", to: "S", carries: "BRLT", convertsTo: FIAT, label: "1. BRLT · net settlement" },
    { id: "F03-E02", from: "S", to: "A", carries: FIAT, label: "2. Fiat network settlement" },
    { id: "F03-E03", from: "A", to: "M", carries: FIAT, label: "3. Fiat merchant payout" },
  ],
  scope: { label: "Mastercard · proposed orchestration scope", caption: "Not ownership or custody", nodes: ["S", "A"] },
  sameActor: [
    { headlineNode: "I", machineryNode: "I" },
    { headlineNode: "A", machineryNode: "A" },
  ],
  steps: [
    "A cardholder completes purchases using a Mastercard-issued card.",
    "Authorization and clearing occur through Mastercard's existing card-network processes.",
    "Mastercard calculates the issuer's net settlement obligation after clearing.",
    "The issuer transfers BRLT to the designated Mastercard settlement arrangement.",
    "Mastercard completes the corresponding fiat settlement with the acquirer.",
    "The acquirer pays the merchant in the merchant's ordinary settlement currency.",
  ],
  notes: brltNotes([
    "The diagram begins with the issuer already holding BRLT; its earlier acquisition of that inventory is outside the flow.",
    "The key proposal is that Mastercard recognizes BRLT as an eligible network settlement asset. Merchants and acquirers do not need to accept BRLT directly.",
    "Direct BRLT network acceptance remains an approval dependency; these are proposed functions, not proof of a live integration.",
    "The settlement wallet operator, fiat account holder and FX principal must be identified; the boundary is coordination, not ownership or custody.",
    "Obligation currency, FX rate and timing, liquidity, fees and refund and failure handling are assigned separately.",
  ]),
};
