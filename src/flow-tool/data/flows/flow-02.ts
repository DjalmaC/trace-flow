import type { Flow } from "../schema";

// Flow 2 — eFX + NRA, virtual-asset delivery to the NRA Holder's wallet.
// Coordinate: eFX+NRA · rail=VA-delivery → role=both.
export const flow02: Flow = {
  id: "flow-2",
  displayId: "2",
  title: "eFX and NRA — Settlement in a Non Resident Account held by Partner Bank",
  blurb: "eFX + third-party NRA; the virtual asset is delivered to the NRA holder's wallet abroad.",
  dials: { model: "eFX+NRA", rail: "VA-delivery", nraOwnership: "third-party", pixRole: "settler", localLp: false },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  narrative:
    "The eFX Service Provider settles BRL into a Non Resident Account held by Trace's " +
    "banking partner. Trace, via Pix Inc / Finance LTDA, converts BRL to USDT/C and " +
    "delivers the virtual asset to the NRA Holder's wallet abroad.",
  headline: { partyA: "efxsp", partyB: "nrawallet", carries: "BRL", convertsTo: "USDC/T" },
  nodes: [
    { id: "enduser", label: "Brazilian end user", kind: "operational", lane: "brazil" },
    { id: "efxsp", label: "eFX Service Provider", kind: "client", lane: "brazil" },
    { id: "nra", label: "Non Resident Account", kind: "operational", lane: "brazil" },
    { id: "pix", label: "Pix Inc / Finance LTDA", kind: "trace", lane: "abroad" },
    { id: "nrawallet", label: "NRA Holder Wallet Abroad", kind: "merchant", lane: "abroad" },
  ],
  legs: [
    { from: "enduser", to: "efxsp", carries: "BRL" },
    { from: "efxsp", to: "nra", carries: "BRL" },
    { from: "nra", to: "pix", carries: "BRL" },
    { from: "pix", to: "nrawallet", carries: "BRL", convertsTo: "USDC/T", crosses: true },
  ],
  sameActor: [
    { headlineNode: "efxsp", machineryNode: "efxsp" },
    { headlineNode: "nrawallet", machineryNode: "nrawallet" },
  ],
};
