import type { NormalizedSpec } from "./spec";

// Assemble the stored share config from a validated spec — the exact shape the
// /build page writes and /f/[code] reads. One implementation shared by the
// local CLI (scripts/agent/create-link.ts) and the MCP create tool.

export interface BuildShareConfigOpts {
  /** CLI-only escape hatch: promoting a link to live is Diogo's call. */
  approved?: boolean;
  /** Marks the row as machine-made so the dashboard can badge it. */
  source?: "agent";
  /** Untreated logo suggestion for Diogo to run through /logo-lab on review.
   *  Deliberately NOT clientLogoUrl (which must be a treated data URL). */
  agentLogoUrl?: string;
}

export function buildShareConfig(spec: NormalizedSpec, opts: BuildShareConfigOpts = {}) {
  const flows = spec.flows ?? [];
  const customFlows = flows.filter((f) => f.tailored).map((f) => ({ ...f.tailored!, editor: undefined }));
  return {
    flowId: flows[0]?.tailored?.id ?? flows[0]?.flowId,
    clientName: spec.company,
    clientRep: spec.contact || undefined,
    clientLogoUrl: spec.logo?.dataUrl,
    clientLogoPlate: spec.logo?.plate,
    collected: spec.collected ?? "BRL",
    delivered: spec.delivered ?? "USD",
    direction: spec.direction,
    stablecoin: spec.stablecoin,
    variants: flows.length > 1 ? flows.map((f) => ({ flowId: f.tailored?.id ?? f.flowId, name: f.name })) : undefined,
    customFlows: customFlows.length ? customFlows : undefined,
    proposalType: spec.proposalType,
    date: spec.date,
    traceRepId: spec.repId,
    salesperson: spec.salesperson,
    pricing: spec.pricing,
    gatePassword: spec.company?.trim() || undefined,
    sandbox: opts.approved ? undefined : true,
    source: opts.source,
    agentLogoUrl: opts.agentLogoUrl,
  };
}

export type ShareConfig = ReturnType<typeof buildShareConfig>;

/** The MCP surface's only path to a config. Sandbox and the agent tag are
 *  hardcoded — no tool parameter can produce a client-live link. */
export function specToAgentShareConfig(spec: NormalizedSpec, agentLogoUrl?: string): ShareConfig {
  return buildShareConfig(spec, { source: "agent", agentLogoUrl });
}
