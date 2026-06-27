import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FlowConfig } from "../data/schema";

// Client-share links. A drafted FlowConfig (client name, rep, currencies,
// direction, stablecoin, logo) is stored in Supabase and addressed by a short
// code, so a salesperson can send a clean /f/<code> link that opens a locked,
// view-only render of just that flow.
//
// Config is supplied via env (public anon key — safe to expose). The project
// URL falls back to the project already wired into .mcp.json, so in practice
// only NEXT_PUBLIC_SUPABASE_ANON_KEY needs to be set.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bvgmnounfupalekjfzuu.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const TABLE = "shared_flows";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient | null {
  if (!SUPABASE_ANON_KEY) return null;
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  return _client;
}

/** Sharing is only available once the anon key is configured. */
export function isShareConfigured(): boolean {
  return !!SUPABASE_ANON_KEY;
}

/** A short, URL-safe, unguessable code. */
function makeCode(len = 9): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export interface SharedRow {
  config: FlowConfig;
  clientName: string;
  clientRep: string | null;
}

/**
 * Persist the drafted config and return its share code. The logo (which may be
 * a large data URI) rides along inside the config JSON.
 */
export async function createShareLink(config: FlowConfig): Promise<{ code: string }> {
  const sb = client();
  if (!sb) throw new Error("Sharing is not configured (missing NEXT_PUBLIC_SUPABASE_ANON_KEY).");

  // a couple of retries in the (extremely unlikely) event of a code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = makeCode();
    const { error } = await sb.from(TABLE).insert({
      code,
      config,
      client_name: config.clientName,
      client_rep: config.clientRep ?? null,
    });
    if (!error) return { code };
    // 23505 = unique_violation → retry with a fresh code; anything else throws
    if ((error as { code?: string }).code !== "23505") {
      throw new Error(error.message || "Could not create the share link.");
    }
  }
  throw new Error("Could not create a unique share link, please try again.");
}

/** Load a shared flow by its code (read-only, anon). */
export async function loadSharedFlow(code: string): Promise<FlowConfig | null> {
  const sb = client();
  if (!sb) throw new Error("Sharing is not configured.");
  const { data, error } = await sb.from(TABLE).select("config").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message || "Could not load this flow.");
  if (!data) return null;
  return data.config as FlowConfig;
}

// ── Dashboard: list + delete past proposals ─────────────────────────────────
// Each "Generate client link" persists a row; the dashboard reads them back,
// grouped by client. A proposal is one generated link.

export interface ProposalRecord {
  code: string;
  clientName: string;
  clientRep: string | null;
  clientLogoUrl?: string;
  clientLogoPlate?: "light" | "none";
  proposalType?: string;
  date?: string;
  traceRepId?: string;
  createdAt: string;
}

/** All saved proposals, newest first. Optionally scoped to one Trace rep. */
export async function listProposals(traceRepId?: string): Promise<ProposalRecord[]> {
  const sb = client();
  if (!sb) return [];
  const { data, error } = await sb
    .from(TABLE)
    .select("code, config, client_name, client_rep, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load proposals.");
  const rows = (data ?? []).map((r): ProposalRecord => {
    const cfg = (r.config ?? {}) as Record<string, unknown>;
    return {
      code: r.code as string,
      clientName: (r.client_name as string) || (cfg.clientName as string) || "Untitled",
      clientRep: (r.client_rep as string) ?? null,
      clientLogoUrl: cfg.clientLogoUrl as string | undefined,
      clientLogoPlate: cfg.clientLogoPlate as "light" | "none" | undefined,
      proposalType: cfg.proposalType as string | undefined,
      date: cfg.date as string | undefined,
      traceRepId: cfg.traceRepId as string | undefined,
      createdAt: r.created_at as string,
    };
  });
  return traceRepId ? rows.filter((r) => r.traceRepId === traceRepId) : rows;
}

/** Delete one proposal by its code. Requires the anon delete RLS policy (see
 *  SHARING.md); without it the row simply isn't removed. */
export async function deleteProposal(code: string): Promise<void> {
  const sb = client();
  if (!sb) throw new Error("Sharing is not configured.");
  const { error } = await sb.from(TABLE).delete().eq("code", code);
  if (error) throw new Error(error.message || "Could not delete this proposal.");
}
