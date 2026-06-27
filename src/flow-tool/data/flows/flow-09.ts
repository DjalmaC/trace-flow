import type { Flow } from "../schema";

// Flow 9 — VA trade, Local Liquidity Provider, virtual-asset delivery. Twin of #9.1.
// Coordinate: VA · rail=VA-delivery → role=VASP.
export const flow09: Flow = {
  id: "flow-9",
  displayId: "9",
  title: "Local buyer · deliver stablecoin",
  blurb: "Local customer buys a virtual asset; local LP sources BRL; the asset is delivered abroad.",
  dials: { model: "VA", rail: "VA-delivery", nraOwnership: "none", pixRole: "settler", localLp: true },
  traceRole: ["VASP"],
  directions: ["collection", "disbursement"],
  narrative:
    "The Local Customer pays BRL to Pix Inc to buy virtual assets; Pix Inc " +
    "sources liquidity from a Local Liquidity Provider in reais and converts BRL to USDC/USDT; " +
    "once abroad, Pix Inc settles the USDC/USDT to the Local Customer's Foreign Wallet.",
  headline: { partyA: "localcust", partyB: "foreignwallet", carries: "BRL", convertsTo: "USDC/USDT" },
  nodes: [
    { id: "localcust", label: "Local Customer", kind: "client", lane: "brazil" },
    { id: "pix", label: "Pix Inc", kind: "trace", lane: "brazil" },
    { id: "locallp", label: "Local Liquidity Provider", kind: "operational", lane: "brazil" },
    { id: "pixwallet", label: "Pix Inc Wallet", kind: "trace", lane: "abroad" },
    { id: "foreignwallet", label: "Local Customer's Foreign Wallet", kind: "client", lane: "abroad" },
  ],
  legs: [
    { from: "localcust", to: "pix", carries: "BRL" },
    { from: "pix", to: "locallp", carries: "BRL" },
    { from: "locallp", to: "pixwallet", carries: "BRL", convertsTo: "USDC/USDT", crosses: true },
    { from: "pixwallet", to: "foreignwallet", carries: "USDC/USDT" },
  ],
  sameActor: [
    { headlineNode: "localcust", machineryNode: "localcust" },
    { headlineNode: "foreignwallet", machineryNode: "foreignwallet" },
  ],
};
