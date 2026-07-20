import type { Flow } from "../schema";

// Flow 12 — Liquidity hub (archetype "hub"). Trace's VASP sits at the centre as
// a matching desk: a client trades BRL for stablecoin along the horizontal
// client-journey rail, while Trace quotes, buys and sells across a pool of
// liquidity providers (banks, market makers, other SPSAVs) that sit BELOW the
// rail and trade two-way with the desk. Not a cross-border corridor — no
// Brazil | Abroad border, no single-token relay. Client identity is supplied at
// runtime (logo / rename); the pool participants are editable per proposal.
export const flow12: Flow = {
  id: "flow-12",
  displayId: "12",
  title: "Liquidity hub",
  archetype: "hub",
  dials: { model: "VA", rail: "stablecoin-sandwich", nraOwnership: "none", pixRole: "liquidity-provider", localLp: true },
  traceRole: ["VASP", "Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "Trade BRL for USDT/USDC through Trace's liquidity desk, priced across the market.",
    disbursement: "Trade USDT/USDC for BRL through Trace's liquidity desk, priced across the market.",
  },
  blurb:
    "Trace's VASP as a liquidity desk: a client trades BRL for stablecoin while Trace quotes, buys and sells across a pool of liquidity providers.",
  narrative:
    "The client settles BRL to Trace's VASP and receives USDT/USDC liquidity. Trace sits in the middle as the matching desk: it nets the client's demand against inbound client supply and quotes across a pool of liquidity providers (banks, market makers and other SPSAVs), buying and selling stablecoin to price and fill the trade.",
  headline: { partyA: "client", partyB: "inbound", carries: "BRL", convertsTo: "USDC/USDT" },
  nodes: [
    { id: "client", label: "Client", kind: "client", lane: "brazil" },
    { id: "trace", label: "Trace VASP", kind: "trace", lane: "brazil" },
    { id: "inbound", label: "Inbound clients", kind: "client", lane: "abroad" },
    { id: "bank", label: "Bank", kind: "operational", lane: "abroad", pool: true },
    { id: "mm", label: "Market maker", kind: "operational", lane: "abroad", pool: true },
    { id: "spsav", label: "Other SPSAV", kind: "operational", lane: "abroad", pool: true },
  ],
  legs: [
    // counterparty -> hub; `carries` is the currency each side sends toward the
    // desk. HubStage renders every conduit two-way (the desk returns the other).
    { from: "client", to: "trace", carries: "BRL", convertsTo: "USDC/USDT" },
    { from: "inbound", to: "trace", carries: "USDC/USDT" },
    { from: "bank", to: "trace", carries: "USDC/USDT" },
    { from: "mm", to: "trace", carries: "USDC/USDT" },
    { from: "spsav", to: "trace", carries: "USDC/USDT" },
  ],
  sameActor: [
    { headlineNode: "client", machineryNode: "client" },
    { headlineNode: "inbound", machineryNode: "inbound" },
  ],
};
