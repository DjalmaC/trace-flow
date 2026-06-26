import type { Flow, FlowConfig } from "./schema";
import { flow01 } from "./flows/flow-01";
import { flow02 } from "./flows/flow-02";
import { flow03 } from "./flows/flow-03";
import { flow04 } from "./flows/flow-04";
import { flow05 } from "./flows/flow-05";
import { flow06 } from "./flows/flow-06";
import { flow07 } from "./flows/flow-07";
import { flow08 } from "./flows/flow-08";
import { flow09 } from "./flows/flow-09";
import { flow091 } from "./flows/flow-09-1";
import { flow10 } from "./flows/flow-10";
import { flow11 } from "./flows/flow-11";
import { flow111 } from "./flows/flow-11-1";

export * from "./schema";

// The eleven canonical Brazil flows, in board order (#1–#10 + #9.1 after #9).
// These alone drive the intake resolver (the dial questionnaire maps onto them).
export const INTAKE_FLOWS: Flow[] = [
  flow01,
  flow02,
  flow03,
  flow04,
  flow05,
  flow06,
  flow07,
  flow08,
  flow09,
  flow091,
  flow10,
];

// Everything selectable in the manual picker: the canonical eleven plus the
// Arq Argentina pair (#11 / #11.1), which are picked manually, not via intake.
export const FLOWS: Flow[] = [...INTAKE_FLOWS, flow11, flow111];

export const FLOW_BY_ID: Record<string, Flow> = Object.fromEntries(
  FLOWS.map((f) => [f.id, f]),
);

export function getFlow(id: string): Flow | undefined {
  return FLOW_BY_ID[id];
}

/** Default config for a flow — used by the manual picker and as intake prefill. */
export function defaultConfig(flowId: string, clientName = "Your Client"): FlowConfig {
  const flow = FLOW_BY_ID[flowId] ?? flow01;
  return {
    flowId: flow.id,
    clientName,
    collected: "BRL",
    delivered: "USD/EUR",
    direction: "collection",
    stablecoin: "both",
  };
}
