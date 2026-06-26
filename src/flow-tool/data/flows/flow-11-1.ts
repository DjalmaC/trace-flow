import type { Flow } from "../schema";

// Flow 11.1 — Arq Argentina, direct settlement. Same route as #11, but Pix Inc's
// Brazilian NRA settles BRL straight to the beneficiary, without the Arq IP hop.
export const flow111: Flow = {
  id: "flow-11.1",
  displayId: "11.1",
  title: "Arq Argentina (direct) — USD/USDC abroad, settled in Brazil as BRL via Pix Inc NRA",
  blurb: "Twin of #11 — same route, but Pix Inc's NRA settles BRL directly to the beneficiary (no Arq IP).",
  dials: { model: "Arq Argentina", rail: "stablecoin-sandwich", nraOwnership: "pix-own", pixRole: "settler", localLp: false },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "Fund from abroad in USD/USDC, settle in Brazil as BRL, in one move.",
    disbursement: "Collect BRL in Brazil, settle abroad in USD/USDC, in one move.",
  },
  narrative:
    "A foreign payer sends USD/USDC to Arqu Argentina, routed through Pix Inc abroad. " +
    "At the border Pix Inc converts USD/USDC to BRL into its Brazilian Non Resident Account, " +
    "which settles BRL directly to the Brazilian beneficiary.",
  headline: { partyA: "arqar", partyB: "benef", carries: "USD/USDC", convertsTo: "BRL" },
  nodes: [
    { id: "estr", label: "Estrangeiro", kind: "operational", lane: "abroad" },
    { id: "arqar", label: "Arqu Argentina", kind: "client", lane: "abroad" },
    { id: "pix", label: "Pix Inc", kind: "trace", lane: "abroad" },
    { id: "pixnra", label: "Pix Inc (NRA)", kind: "trace", lane: "brazil" },
    { id: "benef", label: "Beneficiário BR", kind: "client", lane: "brazil" },
  ],
  legs: [
    { from: "estr", to: "arqar", carries: "USD/USDC" },
    { from: "arqar", to: "pix", carries: "USD/USDC" },
    { from: "pix", to: "pixnra", carries: "USD/USDC", convertsTo: "BRL", crosses: true },
    { from: "pixnra", to: "benef", carries: "BRL" },
  ],
  sameActor: [
    { headlineNode: "arqar", machineryNode: "arqar" },
    { headlineNode: "benef", machineryNode: "benef" },
  ],
};
