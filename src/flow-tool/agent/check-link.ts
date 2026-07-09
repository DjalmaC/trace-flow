import { admin, TABLE, isServerShareConfigured } from "../lib/supabase-server";
import { FLOWS, getFlow } from "../data";
import { TRACE_REPS } from "../data/reps";
import {
  cardEqualsDeck,
  deckPricing,
  normalizePricing,
  type Flow,
  type ProposalPricing,
  type ProposalType,
} from "../data/schema";
import { deckReadyChecks, normalizeTailored } from "../data/custom-flows";
import { pricingFloors } from "./validate";
import { publicBaseUrl } from "./env";

// API/data-level verification of a created sandbox link — the server twin of
// scripts/agent/verify-link.mjs minus the browser. Screenshots are deliberately
// out of scope: the agent surface is review-first, so Diogo's own eyes on the
// dashboard are the render check.

const EXPIRY_DAYS = 30;

export interface LinkCheck {
  id: string;
  ok: boolean;
  detail?: string;
}

export interface CheckLinkResult {
  ok: boolean;
  checks: LinkCheck[];
  /** The block the agent relays to Diogo, null when the link is unusable. */
  review_summary: Record<string, unknown> | null;
}

interface StoredConfig {
  sandbox?: boolean;
  source?: string;
  flowId?: string;
  clientName?: string;
  gatePassword?: string;
  proposalType?: ProposalType;
  date?: string;
  traceRepId?: string;
  variants?: { flowId?: string; name?: string }[];
  customFlows?: Flow[];
  pricing?: ProposalPricing;
  clientLogoUrl?: string;
  agentLogoUrl?: string;
}

export async function checkLink(code: string): Promise<CheckLinkResult> {
  const checks: LinkCheck[] = [];
  const push = (id: string, ok: boolean, detail?: string) => checks.push({ id, ok, ...(detail ? { detail } : {}) });

  if (!isServerShareConfigured()) {
    push("configured", false, "server share is not configured");
    return { ok: false, checks, review_summary: null };
  }
  const sb = admin()!;
  const { data, error } = await sb.from(TABLE).select("config, created_at").eq("code", code).maybeSingle();
  if (error || !data) {
    push("exists", false, error?.message ?? "no row with this code");
    return { ok: false, checks, review_summary: null };
  }
  push("exists", true);

  const config = (data.config ?? {}) as StoredConfig;
  // this tool only inspects the agent's own lane — never client-live links
  if (config.sandbox !== true) {
    push("sandbox", false, "link is not a sandbox link — check_link refuses to touch client-live proposals");
    return { ok: false, checks, review_summary: null };
  }
  push("sandbox", true);

  // ── gate behavior, through the exact code path a client hits ──
  const base = publicBaseUrl();
  const gate = config.gatePassword ?? "";
  try {
    const locked = await fetch(`${base}/api/flow/${code}`, { cache: "no-store" });
    push("gate-locked", gate ? locked.status === 401 : locked.status === 200,
      `GET without pw → ${locked.status}${gate ? " (expected 401)" : " (no gate set, expected 200)"}`);
    const opened = await fetch(`${base}/api/flow/${code}?pw=${encodeURIComponent(gate)}`, { cache: "no-store" });
    let clientNameOk = false;
    if (opened.ok) {
      const body = (await opened.json()) as { config?: { clientName?: string; gatePassword?: string } };
      clientNameOk = body.config?.clientName === config.clientName;
      push("gate-opens", clientNameOk, `GET with pw → ${opened.status}, clientName ${clientNameOk ? "matches" : "MISMATCH"}`);
      push("gate-not-leaked", !("gatePassword" in (body.config ?? {})), "client payload must not carry the password");
    } else {
      push("gate-opens", false, `GET with pw → ${opened.status}`);
    }
  } catch (e) {
    push("gate-opens", false, `self-fetch failed: ${String(e instanceof Error ? e.message : e).slice(0, 80)}`);
  }

  // ── config integrity ──
  const customById = new Map((config.customFlows ?? []).map((f) => [f.id, f]));
  const resolves = (id?: string) => !!id && (customById.has(id) || !!getFlow(id) || FLOWS.some((f) => f.id === id));
  push("primary-flow", resolves(config.flowId), `flowId "${config.flowId}"`);
  const badVariants = (config.variants ?? []).filter((v) => !resolves(v.flowId));
  push("variants", badVariants.length === 0,
    badVariants.length ? `unresolvable: ${badVariants.map((v) => v.flowId).join(", ")}` : `${config.variants?.length ?? 0} variant(s)`);

  for (const f of config.customFlows ?? []) {
    const failing = deckReadyChecks(normalizeTailored(f)).filter((c) => !c.ok);
    push(`custom-flow:${f.id}`, failing.length === 0,
      failing.length ? failing.map((c) => c.label).join("; ") : `"${f.title}" deck-ready`);
    if (f.editor) push(`custom-flow-editor:${f.id}`, false, "editor canvas payload left on a stored flow");
  }

  const proposalType = config.proposalType ?? "standard";
  if (config.pricing) {
    try {
      const pricing = normalizePricing(config.pricing, proposalType);
      const floors = pricingFloors();
      const below = pricing.cards.flatMap((c) => {
        const floor = floors[c.key];
        if (floor == null) return [];
        const tiers = c.type === "flat" ? [{ label: "flat", value: c.flat ?? 0, text: c.flatText }] : c.tiers;
        return tiers.filter((t) => !t.text?.trim() && t.value < floor).map((t) => `${c.key} ${t.label}=${t.value} < ${floor}`);
      });
      push("pricing", below.length === 0, below.length ? below.join("; ") : `${pricing.cards.length} card(s), floors ok`);
    } catch (e) {
      push("pricing", false, String(e instanceof Error ? e.message : e).slice(0, 80));
    }
  } else {
    push("pricing", false, "no pricing on config");
  }

  const rep = TRACE_REPS.find((r) => r.id === config.traceRepId);
  push("rep", !!rep, rep ? rep.name : `traceRepId "${config.traceRepId}" not in roster`);

  const createdAt = data.created_at ? new Date(data.created_at) : null;
  const expiresAt = createdAt ? new Date(createdAt.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000) : null;

  const ok = checks.every((c) => c.ok);
  const deck = deckPricing(proposalType);
  const pricing = config.pricing ? normalizePricing(config.pricing, proposalType) : null;

  return {
    ok,
    checks,
    review_summary: {
      url: `${base}/f/${code}`,
      password: gate || undefined,
      rep: rep ? { name: rep.name, title: rep.title } : undefined,
      proposalType,
      date: config.date,
      flows: (config.variants?.length
        ? config.variants
        : [{ flowId: config.flowId, name: undefined as string | undefined }]
      ).map((v) => ({
        flowId: v.flowId,
        name: v.name ?? (v.flowId ? (customById.get(v.flowId) ?? getFlow(v.flowId))?.title : undefined),
        kind: v.flowId && customById.has(v.flowId) ? "tailored" : "library",
      })),
      pricing: pricing
        ? pricing.cards.map((c) => ({
            key: c.key,
            title: c.title,
            deckDefault: cardEqualsDeck(c, deck.cards.find((d) => d.key === c.key)),
          }))
        : undefined,
      logo: config.clientLogoUrl
        ? { status: "treated logo on config" }
        : config.agentLogoUrl
          ? { status: "suggestion only — run it through /logo-lab on review", agentLogoUrl: config.agentLogoUrl }
          : { status: "none — deck renders the client-name monogram" },
      expiresAt: expiresAt?.toISOString(),
      reviewIn: "dashboard → Sandbox tab → Edit",
    },
  };
}
