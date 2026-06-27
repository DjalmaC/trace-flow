import type { Flow } from "../schema";

// Flow 9.1 — VA trade, fiat-out via stablecoin sandwich. Twin of #9.
// Coordinate: VA · rail=stablecoin-sandwich → role=VASP.
export const flow091: Flow = {
  id: "flow-9.1",
  displayId: "9.1",
  title: "Local buyer · stablecoin bridge to fiat",
  blurb: "Twin of #9 — delivers fiat abroad, using the stablecoin only as the bridge.",
  dials: { model: "VA", rail: "stablecoin-sandwich", nraOwnership: "none", pixRole: "settler", localLp: true },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  narrative:
    "The Local Customer pays BRL to Pix Inc / Finance LTDA to receive funds abroad; Pix Inc " +
    "sources liquidity from a Local Liquidity Provider and converts BRL to USDC/USDT; once abroad, " +
    "Pix Inc converts USDC/USDT to USD/EUR and settles to the Local Customer's Foreign Account.",
  headline: { partyA: "localcust", partyB: "foreignacct", carries: "BRL", convertsTo: "USD/EUR" },
  nodes: [
    { id: "localcust", label: "Local Customer", kind: "client", lane: "brazil" },
    { id: "pix", label: "Pix Inc / Finance LTDA", kind: "trace", lane: "brazil" },
    { id: "locallp", label: "Local Liquidity Provider", kind: "operational", lane: "brazil" },
    { id: "pixwallet", label: "Pix Inc / Finance LTDA Wallet", kind: "trace", lane: "abroad" },
    { id: "foreignacct", label: "Local Customer's Foreign Account", kind: "client", lane: "abroad" },
  ],
  legs: [
    { from: "localcust", to: "pix", carries: "BRL" },
    { from: "pix", to: "locallp", carries: "BRL" },
    { from: "locallp", to: "pixwallet", carries: "BRL", convertsTo: "USDC/USDT", crosses: true },
    { from: "pixwallet", to: "foreignacct", carries: "USDC/USDT", convertsTo: "USD/EUR" },
  ],
  sameActor: [
    { headlineNode: "localcust", machineryNode: "localcust" },
    { headlineNode: "foreignacct", machineryNode: "foreignacct" },
  ],
};
