import type { Flow } from "../schema";

// Flow 10 — VA + NRA, foreign NRA Holder, virtual-asset delivery.
// First flow to compose a bank-held NRA (#2 family) with a Local LP (#9 family).
// Coordinate: VA+NRA · rail=VA-delivery → role=both.
export const flow10: Flow = {
  id: "flow-10",
  displayId: "10",
  title: "VA and NRA — NRA held by Partner Bank and a Local Liquidity Provider, Virtual Asset settlement abroad",
  blurb: "Foreign NRA holder collects from Brazil; bank-held NRA + local LP; asset delivered abroad.",
  // NOTE: matches flow_10_dark.svg, which diverged from Architecture Spec §10
  // (the separate Pix Inc US node was dropped; the NRA became Pix Inc NRA; the
  // conversion moved onto the Local LP → NRA Holder leg). nraOwnership=pix-own
  // per the render — flagged for Diogo to confirm vs the spec's 'third-party'
  // (it does not change the computed traceRole or the resolver match either way).
  dials: { model: "VA+NRA", rail: "VA-delivery", nraOwnership: "pix-own", pixRole: "settler", localLp: true },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  narrative:
    "A Brazilian end user pays BRL into the Pix Inc Non Resident Account held by Trace's banking " +
    "partner. Pix Inc sources liquidity from a Local Liquidity Provider and converts BRL to USDC/USDT, " +
    "settling the virtual asset to the NRA Holder abroad.",
  headline: { partyA: "enduser", partyB: "nraholder", carries: "BRL", convertsTo: "USDC/USDT" },
  nodes: [
    { id: "enduser", label: "Brazilian end user", kind: "operational", lane: "brazil" },
    { id: "pixnra", label: "Pix Inc NRA", kind: "trace", lane: "brazil" },
    { id: "locallp", label: "Local LP", kind: "operational", lane: "brazil" },
    { id: "nraholder", label: "NRA Holder", kind: "client", lane: "abroad" },
  ],
  legs: [
    { from: "enduser", to: "pixnra", carries: "BRL" },
    { from: "pixnra", to: "locallp", carries: "BRL" },
    { from: "locallp", to: "nraholder", carries: "BRL", convertsTo: "USDC/USDT", crosses: true },
  ],
  sameActor: [
    { headlineNode: "enduser", machineryNode: "enduser" },
    { headlineNode: "nraholder", machineryNode: "nraholder" },
  ],
};
