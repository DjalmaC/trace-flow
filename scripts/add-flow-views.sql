-- View analytics for shared links (design handoff 1b).
-- Run in the Supabase SQL editor, or I can apply it via the Management API on
-- your go-ahead. Service-role only (RLS enabled, no anon policies).

create table if not exists public.flow_views (
  id          bigint generated always as identity primary key,
  code        text not null references public.shared_flows(code) on delete cascade,
  viewed_at   timestamptz not null default now(),
  device_hash text,
  country     text,
  city        text
);

create index if not exists flow_views_code_idx on public.flow_views (code, viewed_at desc);

alter table public.flow_views enable row level security;
