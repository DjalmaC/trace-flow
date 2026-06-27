import type { Flow } from "../schema";

// Flow 11.1 — Foreigner to Brazilian, direct settlement. Same route as #11, but
// Pix Inc's Brazilian NRA settles BRL straight to the beneficiary, no IP hop.
export const flow111: Flow = {
  id: "flow-11.1",
  displayId: "11.1",
  title: "Foreigner to Brazilian",
  blurb: "Twin of the IP flow — same route, but Pix Inc's NRA settles BRL directly to the beneficiary (no payment institution).",
  dials: { model: "Foreigner-to-BR", rail: "stablecoin-sandwich", nraOwnership: "pix-own", pixRole: "settler", localLp: false },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "Fund from abroad in USD/USDT, settle in Brazil as BRL, in one move.",
    disbursement: "Collect BRL in Brazil, settle abroad in USD/USDT, in one move.",
  },
  narrative:
    "A foreign payer sends USD/USDT to the platform, routed through Pix Inc abroad. " +
    "At the border Pix Inc converts USD/USDT to BRL into its Brazilian Non Resident Account, " +
    "which settles BRL directly to the Brazilian beneficiary.",
  headline: { partyA: "arqar", partyB: "benef", carries: "USD/USDT", convertsTo: "BRL" },
  nodes: [
    { id: "estr", label: "Estrangeiro", kind: "operational", lane: "abroad" },
    { id: "arqar", label: "Platform", kind: "client", lane: "abroad" },
    { id: "pix", label: "Pix Inc", kind: "trace", lane: "abroad" },
    { id: "pixnra", label: "Pix Inc (NRA)", kind: "trace", lane: "brazil" },
    { id: "benef", label: "Beneficiário BR", kind: "client", lane: "brazil" },
  ],
  legs: [
    { from: "estr", to: "arqar", carries: "USD/USDT" },
    { from: "arqar", to: "pix", carries: "USD/USDT" },
    { from: "pix", to: "pixnra", carries: "USD/USDT", convertsTo: "BRL", crosses: true },
    { from: "pixnra", to: "benef", carries: "BRL" },
  ],
  sameActor: [
    { headlineNode: "arqar", machineryNode: "arqar" },
    { headlineNode: "benef", machineryNode: "benef" },
  ],
};
