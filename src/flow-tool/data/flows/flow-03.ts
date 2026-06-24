import type { Flow } from "../schema";

// Flow 3 — eFX + NRA, Pix Inc NRA with a stablecoin sandwich. Twin of #4.
// Coordinate: eFX+NRA · rail=stablecoin-sandwich → role=VASP.
export const flow03: Flow = {
  id: "flow-3",
  displayId: "3",
  title: "eFX and NRA — Pix Inc NRA held by Partner Bank with Stablecoin Sandwich",
  blurb: "eFX + Pix Inc's own NRA; crypto bridges the border, fiat settles the merchant.",
  dials: { model: "eFX+NRA", rail: "stablecoin-sandwich", nraOwnership: "pix-own", pixRole: "settler", localLp: false },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  narrative:
    "The eFX Service Provider registers operations in the Pix Inc Non Resident Account, " +
    "settling the BRL; Pix Inc converts BRL to USDT/C and transfers the virtual assets " +
    "abroad; once abroad, Pix Inc converts USDT/C to USD/EUR and settles the End Merchant.",
  headline: { partyA: "efxsp", partyB: "merchant", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "enduser", label: "Brazilian end user", kind: "operational", lane: "brazil" },
    { id: "efxsp", label: "eFX Service Provider", kind: "client", lane: "brazil" },
    { id: "pixnra", label: "Pix Inc NRA", kind: "trace", lane: "brazil" },
    { id: "pixwallet", label: "Pix Inc Wallet", kind: "trace", lane: "abroad" },
    { id: "merchant", label: "End Merchant", kind: "merchant", lane: "abroad" },
  ],
  legs: [
    { from: "enduser", to: "efxsp", carries: "BRL" },
    { from: "efxsp", to: "pixnra", carries: "BRL" },
    { from: "pixnra", to: "pixwallet", carries: "BRL", convertsTo: "USDC/T", crosses: true },
    { from: "pixwallet", to: "merchant", carries: "USDC/T", convertsTo: "USD/EUR" },
  ],
  sameActor: [
    { headlineNode: "efxsp", machineryNode: "efxsp" },
    { headlineNode: "merchant", machineryNode: "merchant" },
  ],
};
