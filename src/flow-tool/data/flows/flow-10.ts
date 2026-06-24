import type { Flow } from "../schema";

// Flow 10 — VA + NRA, foreign NRA Holder, virtual-asset delivery.
// First flow to compose a bank-held NRA (#2 family) with a Local LP (#9 family).
// Coordinate: VA+NRA · rail=VA-delivery → role=both.
export const flow10: Flow = {
  id: "flow-10",
  displayId: "10",
  title: "VA and NRA — NRA held by Partner Bank and a Local Liquidity Provider, Virtual Asset settlement abroad",
  blurb: "Foreign NRA holder collects from Brazil; bank-held NRA + local LP; asset delivered abroad.",
  dials: { model: "VA+NRA", rail: "VA-delivery", nraOwnership: "third-party", pixRole: "settler", localLp: true },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  narrative:
    "A Brazilian end user pays BRL into a Non Resident Account held by Trace's banking partner. " +
    "Pix Inc sources liquidity from a Local Liquidity Provider and converts BRL to USDT/C; once " +
    "abroad, Pix Inc settles the USDT/C to the NRA Holder's Wallet Abroad.",
  headline: { partyA: "enduser", partyB: "nrawallet", carries: "BRL", convertsTo: "USDC/T" },
  nodes: [
    { id: "enduser", label: "Brazilian end user", kind: "operational", lane: "brazil" },
    { id: "nra", label: "Non Resident Account", kind: "operational", lane: "brazil" },
    { id: "locallp", label: "Local Liquidity Provider", kind: "operational", lane: "brazil" },
    { id: "pix", label: "Pix Inc", kind: "trace", lane: "brazil" },
    { id: "nrawallet", label: "NRA Holder's Wallet Abroad", kind: "client", lane: "abroad" },
  ],
  legs: [
    { from: "enduser", to: "nra", carries: "BRL" },
    { from: "nra", to: "locallp", carries: "BRL" },
    { from: "locallp", to: "pix", carries: "BRL" },
    { from: "pix", to: "nrawallet", carries: "BRL", convertsTo: "USDC/T", crosses: true },
  ],
  sameActor: [
    { headlineNode: "enduser", machineryNode: "enduser" },
    { headlineNode: "nrawallet", machineryNode: "nrawallet" },
  ],
};
