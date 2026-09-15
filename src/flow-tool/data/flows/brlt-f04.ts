import type { Currency, Flow } from "../schema";
import { brltNotes } from "./brlt-common";

// F04 — BRLT-funded issuer → USD-stablecoin settlement (proposed).
// Final design (Sep 2026): the issuer funds settlement with BRLT, but
// Mastercard receives an already-supported USD stablecoin. The issuer
// exchanges BRLT with Trace or a liquidity provider (a two-way exchange: BRLT
// out, USD stablecoin back), pays its net obligation in that stablecoin into
// Mastercard's settlement arrangement, Mastercard settles the acquirer in
// fiat, the acquirer pays the merchant. Mastercard never needs to accept BRLT.
const USD_TOKEN = "USD stablecoin" as Currency;
const FIAT = "Fiat" as Currency;

export const brltF04: Flow = {
  id: "brlt-f04",
  displayId: "F04",
  specId: "F04",
  title: "BRLT-funded issuer → USD-stablecoin settlement",
  proposed: true,
  ownInitiator: true,
  dials: { model: "VA", rail: "stablecoin-sandwich", nraOwnership: "none", pixRole: "liquidity-provider", localLp: false },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "BRLT funds the issuer, while Mastercard receives an accepted USD stablecoin.",
    disbursement: "BRLT funds the issuer, while Mastercard receives an accepted USD stablecoin.",
  },
  blurb: "Proposed. Card settlement, USD stablecoin. The issuer exchanges BRLT for a Mastercard-supported USD stablecoin with Trace or a liquidity provider and settles the network in that token; Mastercard settles the acquirer in fiat.",
  narrative:
    "A card issuer funds settlement with BRLT, but Mastercard receives an already-supported USD stablecoin. After authorization and clearing, Mastercard calculates the issuer's net obligation; the issuer transfers BRLT to Trace or a liquidity provider, which exchanges it for an accepted USD stablecoin; the issuer pays that stablecoin into Mastercard's settlement arrangement, Mastercard settles with the acquirer in fiat, and the acquirer pays the merchant.",
  headline: { partyA: "I", partyB: "A", carries: "BRLT", convertsTo: FIAT },
  nodes: [
    { id: "I", label: "Participating Mastercard issuer", kind: "client", lane: "abroad" },
    { id: "L", label: "Trace Finance or liquidity provider", kind: "trace", lane: "abroad" },
    { id: "S", label: "Settlement arrangement", kind: "operational", lane: "abroad", authorizer: true },
    { id: "A", label: "Acquirer", kind: "operational", lane: "abroad" },
    { id: "M", label: "Merchant", kind: "merchant", lane: "abroad" },
  ],
  legs: [
    { id: "F04-E01", from: "I", to: "L", carries: "BRLT", convertsTo: USD_TOKEN, label: "1. BRLT for conversion" },
    { id: "F04-E02", from: "L", to: "I", carries: USD_TOKEN, label: "2. USD stablecoin" },
    { id: "F04-E03", from: "I", to: "S", carries: USD_TOKEN, label: "3. USD stablecoin · net settlement" },
    { id: "F04-E04", from: "S", to: "A", carries: USD_TOKEN, convertsTo: FIAT, label: "4. Fiat network settlement" },
    { id: "F04-E05", from: "A", to: "M", carries: FIAT, label: "5. Fiat merchant payout" },
  ],
  scope: { label: "Mastercard · proposed orchestration scope", caption: "Not ownership or custody", nodes: ["S", "A"] },
  sameActor: [
    { headlineNode: "I", machineryNode: "I" },
    { headlineNode: "A", machineryNode: "A" },
  ],
  steps: [
    "A cardholder completes purchases using a Mastercard-issued card.",
    "Authorization and clearing proceed through Mastercard's existing network.",
    "Mastercard calculates the issuer's net settlement obligation.",
    "The issuer transfers BRLT to Trace or a liquidity provider.",
    "Trace or the liquidity provider exchanges the BRLT for a USD stablecoin accepted by Mastercard.",
    "The issuer transfers that USD stablecoin into Mastercard's settlement arrangement.",
    "Mastercard settles with the acquirer in fiat.",
    "The acquirer pays the merchant in its ordinary settlement currency.",
  ],
  notes: brltNotes([
    "Mastercard does not need to accept BRLT directly. BRLT is the issuer's funding asset, while the final network settlement asset is a Mastercard-supported USD stablecoin.",
    "The distinction from F03: there Mastercard directly accepts BRLT for settlement; here BRLT is converted before settlement and Mastercard receives a supported USD stablecoin.",
    "Accepted token, chain, program and provider arrangements remain to be agreed. Rain is a candidate program and network-access provider; BVNK a candidate execution provider.",
    "BRL/USD exposure, quote timing, fees and liquidity obligations must be allocated.",
    "Fallback liquidity providers and retained USD-token inventory are Notes or a separately requested variant, not branches on this canvas.",
  ]),
};
