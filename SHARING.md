# Client share links (Supabase)

A salesperson drafts a flow in the control panel (client name, representative,
logo, currencies, direction), clicks **Generate client link**, and gets a clean
`/f/<code>` URL to send. The client opens a locked, view-only render of just
that one flow — no control panel, no other flows — with a **Download PDF** button.

The drafted config is stored in Supabase and addressed by a short code.

## One-time setup (2 steps)

### 1. Create the table + policies

Run this in the Supabase project's **SQL editor**
(project `bvgmnounfupalekjfzuu`):

```sql
create table if not exists public.shared_flows (
  code        text primary key,
  config      jsonb not null,
  client_name text,
  client_rep  text,
  created_at  timestamptz not null default now()
);

alter table public.shared_flows enable row level security;

-- anyone with the public anon key may create a share link…
create policy "anon insert shared flows"
  on public.shared_flows for insert to anon with check (true);

-- …and open one by its code
create policy "anon read shared flows"
  on public.shared_flows for select to anon using (true);
```

### 2. Add the public anon key

Copy the project's **anon / public** key (Supabase → Project Settings → API)
and set it as an env var:

- **Local:** create `.env.local` with
  ```
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  # NEXT_PUBLIC_SUPABASE_URL defaults to the project in .mcp.json; set it only to override
  ```
- **Vercel:** Project → Settings → Environment Variables → add
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then **redeploy** (NEXT_PUBLIC vars are baked
  in at build time).

Until the key is set, the app degrades gracefully: the panel shows "Sharing
isn't configured yet" and `/f/<code>` shows the same.

## Notes

- The anon key is public by design (it ships in the client bundle); the RLS
  policies above are what actually gate access. As written, anyone with the key
  can create/read share rows — fine for an internal sales tool. Tighten with
  Supabase Auth if you ever need to.
- The client logo travels inside the stored config as a data URI, so uploaded
  logos render on the shared view without any extra storage bucket.
