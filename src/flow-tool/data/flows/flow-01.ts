import type { Flow } from "../schema";

// Flow 1 — eFX, direct settlement with the bank partner. The v1 showpiece /
// animation reference. Coordinate: eFX-only · rail=direct-fiat.
export const flow01: Flow = {
  id: "flow-1",
  displayId: "1",
  title: "eFX · direct bank FX",
  blurb: "eFX provider, FX executed at Trace's partner bank. The baseline flow.",
  dials: { model: "eFX-only", rail: "direct-fiat", nraOwnership: "none", pixRole: "none", localLp: false },
  traceRole: ["Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  narrative:
    "The eFX Service Provider collects and pays from/to the Brazilian end user. " +
    "It settles BRL with Trace's Brazilian banking infrastructure, which executes " +
    "the FX as the money leaves Brazil and pays out the End Merchant abroad.",
  headline: { partyA: "efxsp", partyB: "merchant", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "enduser", label: "Brazilian end user", kind: "operational", lane: "brazil" },
    { id: "efxsp", label: "eFX Service Provider", kind: "client", lane: "brazil" },
    { id: "bankinfra", label: "Trace's Brazilian Banking Infrastructure", kind: "trace", lane: "brazil" },
    { id: "merchant", label: "End Merchant", kind: "merchant", lane: "abroad" },
  ],
  legs: [
    { from: "enduser", to: "efxsp", carries: "BRL" },
    { from: "efxsp", to: "bankinfra", carries: "BRL" },
    { from: "bankinfra", to: "merchant", carries: "BRL", convertsTo: "USD/EUR", crosses: true },
  ],
  sameActor: [
    { headlineNode: "efxsp", machineryNode: "efxsp" },
    { headlineNode: "merchant", machineryNode: "merchant" },
  ],
};
