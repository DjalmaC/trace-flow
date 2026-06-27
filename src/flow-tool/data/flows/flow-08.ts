import type { Flow } from "../schema";

// Flow 8 — eFX + NRA, Pix Inc as Liquidity Provider (stablecoin sandwich). Twin of #7.
// Two Pix Inc nodes, 6 legs, conversions split. Coordinate: eFX+NRA · rail=stablecoin-sandwich → role=VASP.
export const flow08: Flow = {
  id: "flow-8",
  displayId: "8",
  title: "eFX · stablecoin bridge (client's account)",
  blurb: "Twin of #7; Pix Inc as LP, the sandwich's two conversions split across its two nodes.",
  dials: { model: "eFX+NRA", rail: "stablecoin-sandwich", nraOwnership: "third-party", pixRole: "liquidity-provider", localLp: false },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  narrative:
    "Both the eFX Service Provider and the NRA Holder are Trace customers. Trace, via Pix Inc, " +
    "receives BRL and converts it to USDC/USDT abroad; Pix Inc converts USDC/USDT to USD/EUR, funding " +
    "the NRA Holder's account abroad; the NRA Holder then disburses to its End Merchants.",
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
    { from: "pixlp", to: "pixacct", carries: "BRL", convertsTo: "USDC/USDT", crosses: true },
    { from: "pixacct", to: "nraacct", carries: "USDC/USDT", convertsTo: "USD/EUR" },
    { from: "nraacct", to: "merchants", carries: "USD/EUR" },
  ],
  sameActor: [
    { headlineNode: "efxsp", machineryNode: "efxsp" },
    { headlineNode: "merchants", machineryNode: "merchants" },
  ],
};
