import type { Flow } from "../schema";

// Flow 6 — NRA-direct, stablecoin sandwich. Twin of #5.
// Coordinate: NRA-direct · rail=stablecoin-sandwich → role=VASP.
export const flow06: Flow = {
  id: "flow-6",
  displayId: "6",
  title: "NRA — Direct pay-in/pay-out in Pix Inc NRA held by Partner Bank with Stablecoin Sandwich",
  blurb: "No eFX; Pix Inc intermediates directly, crypto bridges the border.",
  dials: { model: "NRA-direct", rail: "stablecoin-sandwich", nraOwnership: "pix-own", pixRole: "settler", localLp: false },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  narrative:
    "A Brazilian company or individual imports/exports from an International Counterparty. " +
    "Pix Inc collects the Brazilian side, converts BRL to USDT/C and transfers the virtual " +
    "assets abroad; once abroad it converts USDT/C to USD/EUR and settles the counterparty.",
  headline: { partyA: "brco", partyB: "counterparty", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "brco", label: "Brazilian Company / Individual", kind: "operational", lane: "brazil" },
    { id: "pixnra", label: "Pix Inc NRA", kind: "trace", lane: "brazil" },
    { id: "pixwallet", label: "Pix Inc Wallet", kind: "trace", lane: "abroad" },
    { id: "counterparty", label: "International Counterparty", kind: "client", lane: "abroad" },
  ],
  legs: [
    { from: "brco", to: "pixnra", carries: "BRL" },
    { from: "pixnra", to: "pixwallet", carries: "BRL", convertsTo: "USDC/USDT", crosses: true },
    { from: "pixwallet", to: "counterparty", carries: "USDC/USDT", convertsTo: "USD/EUR" },
  ],
  sameActor: [
    { headlineNode: "brco", machineryNode: "brco" },
    { headlineNode: "counterparty", machineryNode: "counterparty" },
  ],
};
