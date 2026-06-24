import type { Flow } from "../schema";

// Flow 7 — eFX + NRA, Pix Inc as Liquidity Provider (treasury). Twin of #8.
// Two Pix Inc nodes, 6 legs. Coordinate: eFX+NRA · rail=treasury-fiat → role=CC.
export const flow07: Flow = {
  id: "flow-7",
  displayId: "7",
  title: "eFX and NRA — NRA held by Partner Bank, Pix Inc as Liquidity Provider (Treasury)",
  blurb: "eFX + third-party NRA; Pix Inc funds the NRA holder as LP (two nodes), treasury FX.",
  dials: { model: "eFX+NRA", rail: "treasury-fiat", nraOwnership: "third-party", pixRole: "liquidity-provider", localLp: false },
  traceRole: ["Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  narrative:
    "Both the eFX Service Provider and the NRA Holder are Trace customers. Trace, via Pix Inc, " +
    "receives BRL and settles USD/EUR abroad through its treasury management, funding the NRA " +
    "Holder's account abroad; the NRA Holder then disburses to its End Merchants.",
  headline: { partyA: "efxsp", partyB: "merchants", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "enduser", label: "Brazilian end user", kind: "operational", lane: "brazil" },
    { id: "efxsp", label: "eFX Service Provider", kind: "client", lane: "brazil" },
    { id: "nra", label: "Non Resident Acct", kind: "operational", lane: "brazil" },
    { id: "pixlp", label: "Pix Inc · LP", kind: "trace", lane: "abroad" },
    { id: "pixacct", label: "Pix Inc · acct", kind: "trace", lane: "abroad" },
    { id: "nraacct", label: "NRA Holder acct", kind: "client", lane: "abroad" },
    { id: "merchants", label: "End Merchants", kind: "merchant", lane: "abroad" },
  ],
  legs: [
    { from: "enduser", to: "efxsp", carries: "BRL" },
    { from: "efxsp", to: "nra", carries: "BRL" },
    { from: "nra", to: "pixlp", carries: "BRL" },
    { from: "pixlp", to: "pixacct", carries: "BRL", convertsTo: "USD/EUR", crosses: true },
    { from: "pixacct", to: "nraacct", carries: "USD/EUR" },
    { from: "nraacct", to: "merchants", carries: "USD/EUR" },
  ],
  sameActor: [
    { headlineNode: "efxsp", machineryNode: "efxsp" },
    { headlineNode: "merchants", machineryNode: "merchants" },
  ],
};
