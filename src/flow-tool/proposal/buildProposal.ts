// ─────────────────────────────────────────────────────────────────────────────
// buildProposal — pure derivation of display-ready proposal data from a Flow +
// FlowConfig. The proposal is a *consumer* of the contract (like the control
// panel is a producer); this keeps all the id→label resolution and computed
// labels out of the React document so it stays trivial to render and to test.
// ─────────────────────────────────────────────────────────────────────────────
import {
  type Currency,
  type Direction,
  type Flow,
  type FlowConfig,
  type TraceRole,
  settlementForm,
} from "../data/schema";

/** One leg, resolved to human labels and ready to print. */
export interface ProposalRouteLeg {
  fromLabel: string;
  toLabel: string;
  carries: Currency;
  convertsTo?: Currency;
  /** crosses the Brazil | Abroad divide. */
  crosses: boolean;
}

export interface ProposalView {
  displayId: string;
  title: string;
  narrative: string;
  traceRole: TraceRole[];
  settlementForm: "virtual-asset" | "fiat";
  direction: Direction;
  /** "Pay-in" / "Pay-out" — the client-facing label for `direction`. */
  directionLabel: string;
  collected: Currency;
  delivered: Currency;
  /** Stage-1 end-to-end line. */
  headline: { fromLabel: string; toLabel: string; carries: Currency; convertsTo?: Currency };
  /** Stage-2 ordered machinery legs, resolved to labels. */
  route: ProposalRouteLeg[];
}

export function buildProposal(flow: Flow, config: FlowConfig): ProposalView {
  const labelOf = (id: string) => flow.nodes.find((n) => n.id === id)?.label ?? id;

  return {
    displayId: flow.displayId,
    title: flow.title,
    narrative: flow.narrative ?? flow.blurb,
    traceRole: flow.traceRole,
    settlementForm: settlementForm(flow.dials.rail),
    direction: config.direction,
    directionLabel: config.direction === "collection" ? "Pay-in (collection)" : "Pay-out (disbursement)",
    collected: config.collected,
    delivered: config.delivered,
    headline: {
      fromLabel: labelOf(flow.headline.partyA),
      toLabel: labelOf(flow.headline.partyB),
      carries: flow.headline.carries,
      convertsTo: flow.headline.convertsTo,
    },
    route: flow.legs.map((leg) => ({
      fromLabel: labelOf(leg.from),
      toLabel: labelOf(leg.to),
      carries: leg.carries,
      convertsTo: leg.convertsTo,
      crosses: leg.crosses ?? false,
    })),
  };
}
