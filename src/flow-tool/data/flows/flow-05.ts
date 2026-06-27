import type { Flow } from "../schema";

// Flow 5 — NRA-direct, pay-in/pay-out via Pix Inc NRA, fiat settlement. Twin of #6.
// Coordinate: NRA-direct · rail=treasury-fiat → role=Correspondente Cambial.
export const flow05: Flow = {
  id: "flow-5",
  displayId: "5",
  title: "Pix-direct · fiat settlement",
  blurb: "No eFX; Pix Inc intermediates directly for an international counterparty, treasury FX.",
  dials: { model: "NRA-direct", rail: "treasury-fiat", nraOwnership: "pix-own", pixRole: "treasury", localLp: false },
  traceRole: ["Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  narrative:
    "A Brazilian company or individual imports/exports from an International Counterparty. " +
    "Pix Inc collects and pays the Brazilian side on the counterparty's behalf, converts " +
    "BRL to USD/EUR via its treasury and settles USD/EUR to the counterparty abroad.",
  headline: { partyA: "brco", partyB: "counterparty", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "brco", label: "Brazilian Company / Individual", kind: "operational", lane: "brazil" },
    { id: "pixnra", label: "Pix Inc NRA", kind: "trace", lane: "brazil" },
    { id: "pixacct", label: "Pix Inc Account", kind: "trace", lane: "abroad" },
    { id: "counterparty", label: "International Counterparty", kind: "client", lane: "abroad" },
  ],
  legs: [
    { from: "brco", to: "pixnra", carries: "BRL" },
    { from: "pixnra", to: "pixacct", carries: "BRL", convertsTo: "USD/EUR", crosses: true },
    { from: "pixacct", to: "counterparty", carries: "USD/EUR" },
  ],
  sameActor: [
    { headlineNode: "brco", machineryNode: "brco" },
    { headlineNode: "counterparty", machineryNode: "counterparty" },
  ],
};
