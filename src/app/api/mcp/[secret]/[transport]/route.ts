import { createMcpHandler } from "mcp-handler";
import { safeEqual } from "@/flow-tool/lib/api-auth";
import { registerTools, SERVER_INFO, SERVER_INSTRUCTIONS } from "@/flow-tool/agent/mcp-tools";

// Remote MCP server for the agent proposal pipeline ("smart section"). A Claude
// on claude.ai adds this as a custom connector and builds SANDBOX proposals by
// calling the same deterministic code the /proposal-from-call skill runs
// locally. See src/flow-tool/agent/ for the tools and SHARING.md for setup.
//
// Auth is a long random secret in the URL path (claude.ai connectors take a
// bare URL; custom headers are still a gated beta, and OAuth is overkill for a
// single-team tool). Connector URL: https://<host>/api/mcp/<secret>/mcp
// If the secret ever leaks (the main exposure is request logs), the blast
// radius is sandbox-only create/read/delete; rotate by changing the env var
// and re-adding the connector.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SECRET = process.env.TRACE_MCP_SECRET ?? "";

// Best-effort per-instance rate limit — serverless instances don't share it,
// but it still blunts a leaked-URL hammering a single warm instance.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
let windowStart = 0;
let windowCount = 0;
function rateLimited(): boolean {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  return ++windowCount > MAX_PER_WINDOW;
}

const handler = createMcpHandler(
  (server) => registerTools(server),
  { serverInfo: SERVER_INFO, instructions: SERVER_INSTRUCTIONS },
  { basePath: `/api/mcp/${SECRET}`, maxDuration: 60, disableSse: true },
);

async function guarded(req: Request, ctx: { params: Promise<{ secret: string; transport: string }> }) {
  const { secret } = await ctx.params;
  // 404 (not 401) so a wrong guess is indistinguishable from a non-route.
  if (!SECRET || !safeEqual(secret, SECRET)) return new Response(null, { status: 404 });
  if (rateLimited()) return new Response("rate limited", { status: 429 });
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
