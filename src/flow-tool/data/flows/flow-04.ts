import type { Flow } from "../schema";

// Flow 4 — eFX + NRA, Pix Inc NRA with fiat (treasury) settlement. Twin of #3.
// Coordinate: eFX+NRA · rail=treasury-fiat → role=Correspondente Cambial.
export const flow04: Flow = {
  id: "flow-4",
  displayId: "4",
  title: "eFX · fiat settlement (Pix account)",
  blurb: "eFX + Pix Inc's own NRA; Pix Inc treasury runs BRL↔USD/EUR, no crypto.",
  dials: { model: "eFX+NRA", rail: "treasury-fiat", nraOwnership: "pix-own", pixRole: "treasury", localLp: false },
  traceRole: ["Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  narrative:
    "The eFX Service Provider registers operations in the Pix Inc Non Resident Account, " +
    "settling the BRL; Pix Inc converts BRL to USD/EUR with its own treasury management and " +
    "transfers the funds to its account abroad, settling USD/EUR to the End Merchant.",
  headline: { partyA: "efxsp", partyB: "merchant", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "enduser", label: "Brazilian end user", kind: "operational", lane: "brazil" },
    { id: "efxsp", label: "eFX Service Provider", kind: "client", lane: "brazil" },
    { id: "pixnra", label: "Pix Inc NRA", kind: "trace", lane: "brazil" },
    { id: "pixacct", label: "Pix Inc Account", kind: "trace", lane: "abroad" },
    { id: "merchant", label: "End Merchant", kind: "merchant", lane: "abroad" },
  ],
  legs: [
    { from: "enduser", to: "efxsp", carries: "BRL" },
    { from: "efxsp", to: "pixnra", carries: "BRL" },
    { from: "pixnra", to: "pixacct", carries: "BRL", convertsTo: "USD/EUR", crosses: true },
    { from: "pixacct", to: "merchant", carries: "USD/EUR" },
  ],
  sameActor: [
    { headlineNode: "efxsp", machineryNode: "efxsp" },
    { headlineNode: "merchant", machineryNode: "merchant" },
  ],
};
