# Client share links (server-mediated Supabase)

A salesperson drafts a flow in the control panel (client name, representative,
logo, currencies, direction), clicks **Generate client link**, and gets a clean
`/f/<code>` URL to send. The client opens a locked, view-only render of just
that one flow — no control panel, no other flows — with **Download Proposal**
and **PowerPoint** buttons and the rep's contact card.

## Architecture

All privileged data work goes through server API routes that hold the Supabase
**service-role** key. The browser never sees that key and no longer bundles the
Supabase SDK.

| Route | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/proposals` | GET | rep key | list proposals (dashboard) |
| `/api/proposals` | POST | rep key | create a share link |
| `/api/proposals/[code]` | DELETE | rep key | delete a proposal |
| `/api/flow/[code]` | GET | none (code only) | read one flow for `/f/<code>` |
| `/api/asset/[name]` | GET | rep key **or** valid `?code=` | serve the gated internal PDFs |

The only anonymous path is reading a single flow by its unguessable code. The
internal PDFs (`sales-slides.pdf`, curated proposals) live in `private-assets/`
— outside `/public`, so they aren't crawlable — and are served only to a
logged-in rep or a client holding a real share code.

## One-time setup

### 1. Lock the table down (RLS: no anon access)

The service-role client bypasses RLS, so anon needs **no** policies at all. Run
this in the Supabase SQL editor (project `bvgmnounfupalekjfzuu`):

```sql
create table if not exists public.shared_flows (
  code        text primary key,
  config      jsonb not null,
  client_name text,
  client_rep  text,
  created_at  timestamptz not null default now()
);

alter table public.shared_flows enable row level security;

-- Migrating from the old open-anon setup? Drop the permissive policies so the
-- anon/public key can no longer read, insert, or delete the whole table:
drop policy if exists "anon insert shared flows" on public.shared_flows;
drop policy if exists "anon read shared flows"   on public.shared_flows;
drop policy if exists "anon delete shared flows" on public.shared_flows;
```

With no anon policies and RLS enabled, the anon key can do nothing; every access
is mediated by the API routes above.

### 2. Environment variables

Set these on **Vercel** (Project → Settings → Environment Variables) and in a
local `.env.local` (see `.env.local.example`). Redeploy after changing them.

- `NEXT_PUBLIC_SHARE_ENABLED=1` — turns the sharing UI on in the client.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only (Project Settings → API →
  `service_role`). **Never** prefix with `NEXT_PUBLIC`; it must not reach the
  browser.
- `TRACE_REP_KEY` — the shared team password reps type at login to unlock
  create/list/delete.
- `NEXT_PUBLIC_SUPABASE_URL` — optional; defaults to the bundled project.

Until the server keys are set, the sharing routes return 503 and the UI degrades
gracefully.

## Notes

- The rep key is a single shared password (identity-plus-a-lock, not per-user
  auth). Reps enter it once at login; it's sent as the `x-tf-key` header on
  privileged calls. Tighten with Supabase Auth if you ever need real accounts.
- The client logo travels inside the stored config as a data URI, so uploaded
  logos render on the shared view without a separate storage bucket.
- Every URL from a stored row that becomes an `href`/`src` on the public `/f/`
  page is scheme-checked (data:/https:/same-origin only) before rendering.

## Remote agent surface (MCP)

The "smart section": a remote MCP server at `/api/mcp/<secret>/mcp` lets a
Claude (claude.ai custom connector, mobile, any MCP client) build **sandbox**
proposals from a call transcript or dossier without touching the UI. It wraps
the same deterministic pipeline the local `/proposal-from-call` skill drives
(`src/flow-tool/agent/`): intake resolution, spec validation with pricing
floors, config assembly, link creation, and API-level link checks.

Setup:

1. Generate a secret: `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`.
2. Set it as `TRACE_MCP_SECRET` in Vercel env (+ `.env.local` for local runs)
   and redeploy. Unset, the endpoint 404s.
3. On claude.ai → Settings → Connectors → Add custom connector, paste
   `https://<host>/api/mcp/<secret>/mcp`. No OAuth needed.
4. Paste a call transcript into that Claude and ask for a proposal; review the
   resulting link in the dashboard's Sandbox tab (rows carry an "Agent" chip)
   and promote it yourself.

Security posture:

- The tools are **sandbox-only by construction**: no promote/approve path, no
  PATCH, deletes refuse anything not both `sandbox` and `source: "agent"`, and
  reads refuse client-live rows. `TRACE_REP_KEY` never transits this surface.
- Auth is the URL-path secret (claude.ai connectors can't send custom headers
  yet; OAuth is overkill for a single-team tool). Wrong/missing secret → 404,
  compared in constant time. Main leak vector is request logs; rotation is
  changing the env var and re-adding the connector.
- Consider a Vercel WAF rate-limit rule on `/api/mcp/*` — the in-process
  limiter is per-instance/best-effort only.
