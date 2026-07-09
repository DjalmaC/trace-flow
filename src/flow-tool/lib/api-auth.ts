import "server-only";
import { timingSafeEqual } from "node:crypto";
import { TRACE_REPS } from "../data/reps";

// Per-rep passwords gate every write + the proposal list/delete. The password
// scheme is [first initial][last initial]Trace — e.g. Diogo Cassinelli signs in
// with DCTrace. Derived from the roster so adding a rep to reps.ts is enough.
//
// It's identity-plus-a-lock, not real auth: anyone who knows the roster can
// derive a password, so the actual protection against outsiders is that the
// dashboard URL is internal and every row's share code is unguessable. Google
// SSO (design 2c) supersedes this when it ships.
//
// TRACE_REP_KEY (env) remains accepted as a master key for tooling/admin.

const MASTER_KEY = process.env.TRACE_REP_KEY || "";
export const REP_KEY_HEADER = "x-tf-key";

/** [first initial][last initial]Trace — "Beatriz Lara de Mello" → BMTrace. */
export function repPassword(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase() + "Trace";
}

/** Auth is available as long as the roster exists (passwords are derived). */
export function isRepKeyConfigured(): boolean {
  return TRACE_REPS.length > 0 || !!MASTER_KEY;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Compare against a same-length buffer so length itself doesn't leak via timing.
  const target = ab.length === bb.length ? bb : Buffer.alloc(ab.length);
  return ab.length === bb.length && timingSafeEqual(ab, target);
}

/** True when the request carries a valid rep password (or the master key). */
export function hasRepKey(req: Request): boolean {
  const provided = req.headers.get(REP_KEY_HEADER) ?? "";
  if (!provided) return false;
  if (MASTER_KEY && safeEqual(provided, MASTER_KEY)) return true;
  return TRACE_REPS.some((r) => safeEqual(provided, repPassword(r.name)));
}
