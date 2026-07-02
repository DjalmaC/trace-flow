-- Lock shared_flows down to zero anonymous access.
-- Run once in the Supabase SQL editor (project bvgmnounfupalekjfzuu):
--   https://supabase.com/dashboard/project/bvgmnounfupalekjfzuu/sql/new
--
-- The app's API routes use the service-role key, which bypasses RLS, so no
-- anon policies are needed at all. Dropping these three revokes the full
-- read/insert/delete the public anon key used to have. See SHARING.md.

alter table public.shared_flows enable row level security;

drop policy if exists "anon insert shared flows" on public.shared_flows;
drop policy if exists "anon read shared flows"   on public.shared_flows;
drop policy if exists "anon delete shared flows" on public.shared_flows;

-- Verify: should return zero rows.
select policyname from pg_policies
where schemaname = 'public' and tablename = 'shared_flows';
