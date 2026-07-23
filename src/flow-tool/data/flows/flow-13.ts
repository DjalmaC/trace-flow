import type { Flow } from "../schema";

// Flow 13 — Treasury netting (archetype "netting"). Two opposite client flows
// fund each other: Client A pays BRL in Brazil and receives USD abroad, while
// Client B pays USD abroad and receives BRL in Brazil. Trace's treasury desk
// sits on the border and nets one leg against the other — A's BRL settles
// locally to B, B's USD settles locally to A, both priced at the FX rate, and
// no value ever crosses the Brazil | Abroad divide. Each client experiences a
// normal cross-border transaction; the machinery reveals the offset.
// Laid out as four corners around the desk: pay-ins on top, deliveries below,
// Brazil on the left, Abroad on the right. Client identity supplied at runtime.
export const flow13: Flow = {
  id: "flow-13",
  displayId: "13",
  title: "Treasury netting",
  archetype: "netting",
  // Not an intake coordinate — picked manually, like the hub. The dials record
  // the closest description: a treasury conduit with value held by the partner.
  dials: { model: "eFX+NRA", rail: "treasury-fiat", nraOwnership: "third-party", pixRole: "treasury", localLp: false },
  traceRole: ["Correspondente Cambial"],
  directions: ["collection", "disbursement"],
  heroSupport: {
    collection: "Pay in BRL in Brazil, receive USD abroad, netted against an opposite flow.",
    disbursement: "Fund in USD abroad, deliver BRL in Brazil, netted against an opposite flow.",
  },
  blurb:
    "Treasury offset: a BRL pay-in in Brazil and a USD pay-in abroad fund each other. Both legs settle locally at the FX rate and nothing crosses the border.",
  narrative:
    "Two flows fund each other. Client A pays BRL in Brazil while Client B pays USD abroad; Trace's treasury desk nets the two legs, " +
    "delivering A's BRL to B locally via Pix and B's USD to A from local accounts abroad. Each client gets a normal cross-border " +
    "transaction, priced at the FX rate and registered with the FX market, while the value itself never crosses the border.",
  headline: { partyA: "a-pay", partyB: "a-recv", carries: "BRL", convertsTo: "USD" },
  nodes: [
    // corners: pay-ins on top, deliveries below; Brazil left, Abroad right
    { id: "a-pay", label: "Client A", kind: "client", lane: "brazil" },
    { id: "b-recv", label: "Client B", kind: "client", lane: "brazil" },
    { id: "b-pay", label: "Client B", kind: "client", lane: "abroad" },
    { id: "a-recv", label: "Client A", kind: "client", lane: "abroad", brandedClient: true },
    // the treasury desk, straddling the border
    { id: "desk", label: "Trace treasury", kind: "trace", lane: "brazil" },
  ],
  legs: [
    // Brazil loop — BRL in from A, BRL out to B. Abroad loop — USD in from B,
    // USD out to A. No conversion capsule and no `crosses`: the offset at the
    // desk IS the exchange, and neither token crosses the divider.
    { from: "a-pay", to: "desk", carries: "BRL" },
    { from: "desk", to: "b-recv", carries: "BRL" },
    { from: "b-pay", to: "desk", carries: "USD" },
    { from: "desk", to: "a-recv", carries: "USD" },
  ],
  sameActor: [
    { headlineNode: "a-pay", machineryNode: "a-pay" },
    { headlineNode: "a-recv", machineryNode: "a-recv" },
  ],
};
