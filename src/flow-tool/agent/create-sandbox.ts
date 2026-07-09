import { admin, TABLE, isServerShareConfigured } from "../lib/supabase-server";
import { makeCode } from "../lib/share-codes";
import { publicBaseUrl } from "./env";
import { specToAgentShareConfig } from "./build-config";
import { validateSpec } from "./validate";
import type { ProposalSpec } from "./spec";

// The MCP surface's create path. Always re-validates the raw spec server-side
// (a "normalized" spec from the wire is just input) and always lands a SANDBOX
// row tagged source:"agent" — promotion is a human dashboard action.

// Stored configs ride whole into the dashboard and client link; keep agent
// creations well under the size legacy logo rows already made painful.
const MAX_CONFIG_BYTES = 1_500_000;

export type CreateSandboxResult =
  | { ok: true; code: string; url: string; password?: string; sandbox: true; flows: string[]; flags: string[] }
  | { ok: false; errors: string[]; questions?: string[]; flags?: string[] };

export async function createSandboxLink(spec: ProposalSpec, agentLogoUrl?: string): Promise<CreateSandboxResult> {
  if (!isServerShareConfigured()) return { ok: false, errors: ["server share is not configured"] };

  const v = validateSpec(spec);
  if (!v.ok) return { ok: false, errors: v.errors, questions: v.questions, flags: v.flags };

  const config = specToAgentShareConfig(v.spec, agentLogoUrl);
  const size = Buffer.byteLength(JSON.stringify(config));
  if (size > MAX_CONFIG_BYTES)
    return { ok: false, errors: [`config is ${size} bytes (max ${MAX_CONFIG_BYTES}) — drop embedded data URLs from the spec`] };

  const sb = admin()!;
  // retry on the (extremely unlikely) code collision — same policy as POST /api/proposals
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    const { error } = await sb.from(TABLE).insert({
      code,
      config,
      client_name: config.clientName ?? null,
      client_rep: config.clientRep ?? null,
    });
    if (!error) {
      return {
        ok: true,
        code,
        url: `${publicBaseUrl()}/f/${code}`,
        password: config.gatePassword,
        sandbox: true,
        flows: v.spec.flows.map((f) => f.name),
        flags: v.flags,
      };
    }
    if ((error as { code?: string }).code !== "23505")
      return { ok: false, errors: [error.message || "insert failed"] };
  }
  return { ok: false, errors: ["could not allocate a unique code"] };
}
