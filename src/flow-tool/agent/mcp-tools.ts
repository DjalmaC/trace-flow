import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { FLOWS, getFlow } from "../data";
import { TRACE_REPS } from "../data/reps";
import { deckPricing } from "../data/schema";
import { QUESTIONS } from "../intake/questions";
import { admin, TABLE, isServerShareConfigured } from "../lib/supabase-server";
import { resolveExtraction } from "./resolve";
import { validateSpec, pricingFloors } from "./validate";
import { createSandboxLink } from "./create-sandbox";
import { checkLink } from "./check-link";
import { fetchLogoCandidates } from "./logo-candidates";
import type { ProposalSpec } from "./spec";

// The agent-facing surface of trace-flow: the same deterministic pipeline the
// /proposal-from-call skill drives locally, exposed as remote MCP tools so any
// Claude (claude.ai connector, mobile, another harness) can build proposals.
// Everything here is SANDBOX-ONLY by construction — there is no promote tool,
// no PATCH tool, and no path that reads or returns TRACE_REP_KEY.

const INSTRUCTIONS_DIR = path.join(process.cwd(), "src/flow-tool/agent/instructions");

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// ── input schemas ────────────────────────────────────────────────────────────
// Zod gates shape, not semantics: validateSpec() is the real gatekeeper, so
// nested app types (Flow, pricing cards) pass through loosely typed.

const extractionShape = {
  company: z.string().optional(),
  domain: z.string().optional(),
  contact: z.string().optional(),
  repId: z.string().optional(),
  dials: z
    .record(z.string())
    .optional()
    .describe("question id -> option value, per the dial grammar from list_flows"),
  dialEvidence: z.record(z.string()).optional().describe("question id -> verbatim supporting quote"),
};

const specFlowRefSchema = z
  .object({
    flowId: z.string().optional().describe("a library flow id from list_flows"),
    tailored: z
      .record(z.unknown())
      .optional()
      .describe("a full custom Flow object (see list_flows exampleFlow for the shape)"),
    name: z.string().optional().describe("display name for this flow tab"),
  })
  .passthrough();

const specSchema = z
  .object({
    company: z.string(),
    contact: z.string().optional(),
    domain: z.string().optional(),
    repId: z.string(),
    proposalType: z.enum(["standard", "brazil-market"]),
    direction: z.enum(["collection", "disbursement"]),
    stablecoin: z.enum(["USDC", "USDT", "both"]),
    collected: z.string().optional(),
    delivered: z.string().optional(),
    flows: z.array(specFlowRefSchema).min(1),
    pricing: z.record(z.unknown()).describe("full ProposalPricing object — start from get_pricing_defaults"),
    pricingEvidence: z
      .array(z.object({ product: z.string(), tier: z.string().optional(), value: z.union([z.number(), z.string()]), quote: z.string() }))
      .optional(),
    logo: z.record(z.unknown()).optional().describe("only for pre-treated data-URL logos; usually omit and use agentLogoUrl on create"),
    date: z.string().optional(),
  })
  .passthrough();

export function registerTools(server: McpServer): void {
  server.tool(
    "get_instructions",
    "READ THIS FIRST. The full workflow contract for building a trace-flow proposal from a call transcript or dossier: hard rules (sandbox-only, quotes-or-it-didn't-happen, stop-and-ask), the dial extraction vocabulary, and the pricing rules. Everything the other tools expect you to already know.",
    {},
    async () => {
      const read = (f: string) => readFile(path.join(INSTRUCTIONS_DIR, f), "utf8");
      const [workflow, dials, pricing] = await Promise.all([
        read("mcp-workflow.md"),
        read("dials-extraction.md"),
        read("pricing-rules.md"),
      ]);
      return {
        content: [
          {
            type: "text" as const,
            text: `${workflow}\n\n---\n\n${dials}\n\n---\n\n${pricing}`,
          },
        ],
      };
    },
  );

  server.tool(
    "list_reps",
    "The Trace Finance salesperson roster. Match the rep on the call against this list (partial names are fine); the spec's repId must be one of these ids.",
    {},
    async () => json({ reps: TRACE_REPS.map((r) => ({ id: r.id, name: r.name, title: r.title, email: r.email })) }),
  );

  server.tool(
    "list_flows",
    "The flow library and the dial grammar. Returns: every library flow's summary (id, title, blurb, dials, directions); the intake questions whose answers form a dial coordinate; and one full Flow object (exampleFlow) to copy the shape from when composing a tailored flow.",
    {},
    async () =>
      json({
        flows: FLOWS.map((f) => ({
          id: f.id,
          displayId: f.displayId,
          title: f.title,
          blurb: f.blurb,
          dials: f.dials,
          directions: f.directions,
          traceRole: f.traceRole,
        })),
        dialQuestions: QUESTIONS.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          source: q.source,
          options: q.options.map((o) => ({ value: o.value, label: o.label })),
        })),
        exampleFlow: getFlow("flow-1"),
      }),
  );

  server.tool(
    "resolve_flows",
    "Run extracted dial answers through the product's real intake resolver. `exact` → use exactFlowId. `partial`/`no-match` → relay openQuestions to the salesperson, or compose a tailored flow ONLY when the source material explicitly describes the route.",
    extractionShape,
    async (extraction) => json(resolveExtraction(extraction)),
  );

  server.tool(
    "get_pricing_defaults",
    "The deck's default pricing cards for a proposal type, plus the per-product floors. Start every pricing object from these defaults and change only what the client was explicitly quoted (verbatim quote required). A rate below floor becomes a question for the salesperson — never silently keep it.",
    { proposalType: z.enum(["standard", "brazil-market"]).default("standard") },
    async ({ proposalType }) =>
      json({
        pricing: deckPricing(proposalType),
        floors: pricingFloors(),
        rule: "overrides need a verbatim quote; below-floor rates go back to the salesperson as questions",
      }),
  );

  server.tool(
    "validate_spec",
    "Gate a composed ProposalSpec through the app's own code: rep roster, flow library, tailored-flow deck-ready checks, pricing normalization + floors. Returns ok/errors/questions/flags (+ structured tailoredIssues to iterate on) or the normalized spec. Always validate before create_sandbox_link.",
    { spec: specSchema },
    async ({ spec }) => json(validateSpec(spec as unknown as ProposalSpec)),
  );

  server.tool(
    "create_sandbox_link",
    "Create the proposal share link from a validated spec. ALWAYS creates a sandbox link (there is no way to make a client-live link from here); the salesperson reviews and promotes it in the dashboard. Re-validates the spec server-side. Optional agentLogoUrl: the winning candidate URL from fetch_logo_candidates, stored as a suggestion for the review step.",
    { spec: specSchema, agentLogoUrl: z.string().url().optional() },
    async ({ spec, agentLogoUrl }) => json(await createSandboxLink(spec as unknown as ProposalSpec, agentLogoUrl)),
  );

  server.tool(
    "check_link",
    "Verify a created sandbox link end-to-end without a browser: the row exists, the password gate behaves (locked without pw, opens with it, password never leaks to the client payload), flows/variants resolve, tailored flows stay deck-ready, pricing respects floors, the rep is in the roster. Returns a review_summary block to relay to the salesperson. Refuses non-sandbox links.",
    { code: z.string() },
    async ({ code }) => json(await checkLink(code)),
  );

  server.tool(
    "get_proposal",
    "Read back a sandbox proposal's stored config by share code (for a fix-and-recreate loop). Refuses client-live links: this surface only sees its own lane.",
    { code: z.string() },
    async ({ code }) => {
      if (!isServerShareConfigured()) return json({ error: "server share is not configured" });
      const { data, error } = await admin()!.from(TABLE).select("code, config, created_at").eq("code", code).maybeSingle();
      if (error) return json({ error: error.message });
      if (!data) return json({ error: "not found" });
      const config = (data.config ?? {}) as { sandbox?: boolean };
      if (config.sandbox !== true) return json({ error: "not a sandbox link — this surface only reads sandbox proposals" });
      return json({ code: data.code, createdAt: data.created_at, config: data.config });
    },
  );

  server.tool(
    "delete_sandbox_link",
    "Delete a sandbox link this surface created (redo loop: fix the spec, delete the bad link, create again). Refuses anything that isn't both sandbox and agent-created, so it can never destroy a human-made or promoted proposal.",
    { code: z.string() },
    async ({ code }) => {
      if (!isServerShareConfigured()) return json({ error: "server share is not configured" });
      const sb = admin()!;
      const { data, error } = await sb.from(TABLE).select("config").eq("code", code).maybeSingle();
      if (error) return json({ error: error.message });
      if (!data) return json({ error: "not found" });
      const config = (data.config ?? {}) as { sandbox?: boolean; source?: string };
      if (config.sandbox !== true || config.source !== "agent")
        return json({ error: "refused — only sandbox links created by this surface can be deleted here" });
      const { error: delError } = await sb.from(TABLE).delete().eq("code", code);
      if (delError) return json({ error: delError.message });
      return json({ deleted: code });
    },
  );

  server.tool(
    "fetch_logo_candidates",
    "Probe the client-logo source ladder for a domain (brandfetch when configured, apple-touch-icon, Google favicon, unavatar) and return candidate URLs with metadata. Pick the best ok candidate (prefer brandfetch/apple-touch-icon) and pass its url as agentLogoUrl to create_sandbox_link — treatment happens in /logo-lab at review time.",
    { domain: z.string().describe("client domain, e.g. stripe.com") },
    async ({ domain }) => json(await fetchLogoCandidates(domain)),
  );
}

export const SERVER_INFO = { name: "trace-flow-proposals", version: "1.0.0" };
export const SERVER_INSTRUCTIONS =
  "trace-flow proposal builder (sandbox-only). Call get_instructions first — it carries the workflow contract, the dial extraction vocabulary, and the pricing rules. Typical order: get_instructions → list_reps/list_flows → resolve_flows → get_pricing_defaults → validate_spec → create_sandbox_link → check_link → report to the salesperson.";
