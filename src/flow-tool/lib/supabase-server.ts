import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase access. Uses the SERVICE-ROLE key (never shipped to the
// browser), so it bypasses RLS — which lets us lock the table down to "no anon
// access at all" and mediate every read/write through the API routes in
// src/app/api/*. See SHARING.md for the required env + SQL.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvgmnounfupalekjfzuu.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const TABLE = "shared_flows";

let _admin: SupabaseClient | null = null;

/** The service-role client, or null when the key isn't configured. */
export function admin(): SupabaseClient | null {
  if (!SERVICE_KEY) return null;
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/** True once the server has a service-role key to talk to Supabase with. */
export function isServerShareConfigured(): boolean {
  return !!SERVICE_KEY;
}
