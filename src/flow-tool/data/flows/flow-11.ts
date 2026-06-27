import type { Flow } from "../schema";

// Flow 11 — Foreigner to Brazilian, with a local payment institution (IP).
// A foreign payer funds in USD/USDT; value routes through the client's platform
// and Pix Inc abroad, converts USD/USDT -> BRL at the border into Pix Inc's
// Brazilian NRA, and a local payment institution (IP) pays out BRL to the
// Brazilian beneficiary. Twin of #11.1 (which settles direct, no IP hop).
// Laid out Abroad-left -> Brasil-right. Client identity is supplied at runtime.
export const flow11: Flow = {
  id: "flow-11",
  displayId: "11",
  title: "Foreigner to Brazilian with IP",
  blurb:
    "Foreign USD/USDT converts to BRL at the border and settles to a Brazilian beneficiary through Pix Inc's NRA and a local payment institution (IP).",
  dials: { model: "Foreigner-to-BR", rail: "stablecoin-sandwich", nraOwnership: "pix-own", pixRole: "settler", localLp: false },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "Fund from abroad in USD/USDT, settle in Brazil as BRL, in one move.",
    disbursement: "Collect BRL in Brazil, settle abroad in USD/USDT, in one move.",
  },
  narrative:
    "A foreign payer sends USD/USDT to the platform, which routes it through Pix Inc abroad. " +
    "At the border Pix Inc converts USD/USDT to BRL into its Brazilian Non Resident Account, then a local " +
    "payment institution (IP) pays out BRL to the Brazilian beneficiary.",
  headline: { partyA: "arqar", partyB: "benef", carries: "USD/USDT", convertsTo: "BRL" },
  nodes: [
    { id: "estr", label: "Estrangeiro", kind: "operational", lane: "abroad" },
    { id: "arqar", label: "Platform", kind: "client", lane: "abroad" },
    { id: "pix", label: "Pix Inc", kind: "trace", lane: "abroad" },
    { id: "pixnra", label: "Pix Inc (NRA)", kind: "trace", lane: "brazil" },
    { id: "arqip", label: "Payment Institution (IP)", kind: "trace", lane: "brazil", brandedClient: true },
    { id: "benef", label: "Beneficiário BR", kind: "client", lane: "brazil" },
  ],
  legs: [
    { from: "estr", to: "arqar", carries: "USD/USDT" },
    { from: "arqar", to: "pix", carries: "USD/USDT" },
    { from: "pix", to: "pixnra", carries: "USD/USDT", convertsTo: "BRL", crosses: true },
    { from: "pixnra", to: "arqip", carries: "BRL" },
    { from: "arqip", to: "benef", carries: "BRL" },
  ],
  sameActor: [
    { headlineNode: "arqar", machineryNode: "arqar" },
    { headlineNode: "benef", machineryNode: "benef" },
  ],
};
