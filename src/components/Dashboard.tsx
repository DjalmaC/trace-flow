"use client";
import { useEffect, useMemo, useState } from "react";
import { ASSETS, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { getRep } from "@/flow-tool/data/reps";
import { loadRepKey } from "@/flow-tool/lib/rep-session";
import type { ProposalType, TraceRep } from "@/flow-tool/data/schema";
import {
  deleteProposal,
  isShareConfigured,
  listProposals,
  loadSharedFlow,
  shareUrl,
  type ProposalRecord,
} from "@/flow-tool/lib/share";
import { glassStyle, SilkBackdrop } from "@/flow-tool/components/Glass";

const TYPE_LABEL: Record<string, string> = { standard: "Standard", "brazil-market": "Brazil-market" };

// New links store the raw ProposalPricing (card model, or the older pix/spread
// pair — the PDF builder normalizes both); legacy rows (ARQ) carry a display
// shape it can't consume.
function isRawPricing(p: unknown): p is import("@/flow-tool/data/schema").ProposalPricing {
  const c = p as { pix?: unknown; spread?: unknown; mode?: unknown; cards?: unknown } | null;
  if (!c || typeof c !== "object") return false;
  if (c.pix && typeof c.pix === "object" && c.spread && typeof c.spread === "object") return true;
  return typeof c.mode === "string" && Array.isArray(c.cards);
}
const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// ── Pipeline status ──────────────────────────────────────────────────────────
// Every stored row was shared at creation; a row with recorded opens is Viewed.
// Draft is a future concept (nothing persists before sharing today).
type Status = "viewed" | "shared" | "draft" | "sandbox";
type FilterTab = "all" | Status;

const statusOf = (r: ProposalRecord): Status =>
  r.sandbox ? "sandbox" : (r.stats?.views ?? 0) > 0 ? "viewed" : "shared";
const activityAt = (r: ProposalRecord): string => r.stats?.lastViewedAt ?? r.createdAt;

// ── Time formatting (DM Mono cells) ──────────────────────────────────────────
function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 35) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
function absTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function absDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Inline SVG flags (never emoji) — markup lifted from the design handoff ───
function flagCode(country: string): "BR" | "US" | null {
  const c = country.trim().toUpperCase();
  if (c === "BR" || c === "BRA" || c === "BRAZIL") return "BR";
  if (c === "US" || c === "USA" || c === "UNITED STATES") return "US";
  return null;
}
const COUNTRY_NAME: Record<string, string> = { BR: "Brazil", US: "United States" };

function Flag({ country, width = 18 }: { country: string; width?: number }) {
  const code = flagCode(country);
  const h = Math.round((width * 2) / 3);
  if (code === "BR") {
    return (
      <svg width={width} height={h} viewBox="0 0 24 16" style={{ borderRadius: 2, display: "block" }} aria-hidden>
        <rect width="24" height="16" fill="#009b3a" />
        <path d="M12 2.5 21.5 8 12 13.5 2.5 8Z" fill="#ffdf00" />
        <circle cx="12" cy="8" r="3.3" fill="#002776" />
      </svg>
    );
  }
  if (code === "US") {
    return (
      <svg width={width} height={h} viewBox="0 0 24 16" style={{ borderRadius: 2, display: "block" }} aria-hidden>
        <rect width="24" height="16" fill="#eef1ee" />
        <rect y="2" width="24" height="2" fill="#b22234" />
        <rect y="6" width="24" height="2" fill="#b22234" />
        <rect y="10" width="24" height="2" fill="#b22234" />
        <rect y="14" width="24" height="2" fill="#b22234" />
        <rect width="10" height="8" fill="#3c3b6e" />
      </svg>
    );
  }
  return null; // unknown countries fall back to the mono country code
}

function locationLabel(country: string): string {
  return COUNTRY_NAME[flagCode(country) ?? ""] ?? country.trim().toUpperCase();
}

// ── Status chip ──────────────────────────────────────────────────────────────
const CHIP: Record<Status, { fg: string; bg: string; border: string; label: string }> = {
  viewed: { fg: "#00f2b1", bg: "#0f2019", border: "#1c3a2e", label: "Viewed" },
  shared: { fg: "#2be8d6", bg: "#0c2020", border: "#163a3a", label: "Shared" },
  draft: { fg: "#e6b566", bg: "#241d10", border: "#3a2e18", label: "Draft" },
  sandbox: { fg: "#e6b566", bg: "#241d10", border: "#3a2e18", label: "Sandbox" },
};

function StatusChip({ status }: { status: Status }) {
  const c = CHIP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[20px] border px-[11px] py-[5px] text-[11px] font-semibold"
      style={{ color: c.fg, background: c.bg, borderColor: c.border }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      {c.label}
    </span>
  );
}

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "shared", label: "Shared" },
  { id: "viewed", label: "Viewed" },
  { id: "sandbox", label: "Sandbox" },
];

export function Dashboard({ rep, onSwitch }: { rep: TraceRep; onSwitch: () => void }) {
  const [records, setRecords] = useState<ProposalRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, "pdf" | "del" | "edit" | undefined>>({});
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    try {
      setRecords(await listProposals(rep.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load proposals.");
      setRecords([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep.id]);

  const sorted = useMemo(
    () =>
      [...(records ?? [])].sort(
        (a, b) => new Date(activityAt(b)).getTime() - new Date(activityAt(a)).getTime(),
      ),
    [records],
  );
  // Sandbox rows live only under their own tab; the pipeline (All + counts)
  // never includes them.
  const rows = useMemo(
    () =>
      filter === "all"
        ? sorted.filter((r) => statusOf(r) !== "sandbox")
        : sorted.filter((r) => statusOf(r) === filter),
    [sorted, filter],
  );
  const pipeline = useMemo(() => sorted.filter((r) => statusOf(r) !== "sandbox"), [sorted]);
  const viewedCount = useMemo(() => pipeline.filter((r) => statusOf(r) === "viewed").length, [pipeline]);

  function copyLink(r: ProposalRecord) {
    navigator.clipboard.writeText(shareUrl(r));
    setCopied(r.code);
    setTimeout(() => setCopied(null), 1500);
  }

  // Reopen a stored proposal in the builder: stash its config + code, then
  // /build hydrates from the stash and offers "Update client link" in place.
  async function onEdit(code: string) {
    setBusy((b) => ({ ...b, [code]: "edit" }));
    try {
      const cfg = await loadSharedFlow(code);
      if (!cfg) throw new Error("missing");
      sessionStorage.setItem("tf:edit-proposal", JSON.stringify({ code, config: cfg }));
      window.location.assign(`/build?edit=${encodeURIComponent(code)}`);
    } catch {
      setBusy((b) => ({ ...b, [code]: undefined }));
      setError("Could not open that proposal for editing.");
    }
  }

  async function onDownload(rec: ProposalRecord) {
    setBusy((b) => ({ ...b, [rec.code]: "pdf" }));
    try {
      const cfg = (await loadSharedFlow(rec.code)) as Record<string, unknown> | null;
      if (!cfg) throw new Error("missing");
      const variants = cfg.variants as { flowId: string; name: string }[] | undefined;
      // Tailored flows travel inside the link's config; without registering
      // them, getFlow can't resolve their pages (or the corridor line).
      const { registerCustomFlows } = await import("@/flow-tool/data/custom-flows");
      registerCustomFlows(cfg.customFlows as never);
      const { downloadProposalPdf } = await import("@/flow-tool/lib/proposal");
      await downloadProposalPdf({
        proposalType: (cfg.proposalType as ProposalType) ?? "standard",
        company: cfg.clientName as string,
        companyRep: cfg.clientRep as string | undefined,
        date: (cfg.date as string) ?? "",
        companyLogoUrl: cfg.clientLogoUrl as string | undefined,
        companyLogoPlate: cfg.clientLogoPlate as "light" | "none" | undefined,
        flows: variants ?? [{ flowId: cfg.flowId as string, name: "Flow" }],
        nodeLabels: cfg.nodeLabels as Record<string, string> | undefined,
        nodeOrder: cfg.nodeOrder as Record<string, string[]> | undefined,
        laneLabels: cfg.laneLabels as Record<string, { brazil?: string; abroad?: string }> | undefined,
        heroSupport: cfg.heroSupport as Record<string, string> | undefined,
        platform: cfg.platform as never,
        brandColor: cfg.brandColor as string | undefined,
        direction: cfg.direction as never,
        stablecoin: cfg.stablecoin as never,
        collected: cfg.collected as never,
        delivered: cfg.delivered as never,
        rep: getRep(cfg.traceRepId as string | undefined),
        pricing: isRawPricing(cfg.pricing) ? cfg.pricing : undefined,
        assetAuth: { repKey: loadRepKey() ?? undefined },
      });
    } catch {
      /* surfaced by the missing download */
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[rec.code];
        return n;
      });
    }
  }

  async function onDelete(code: string) {
    if (!window.confirm("Delete this proposal? This can't be undone.")) return;
    setBusy((b) => ({ ...b, [code]: "del" }));
    try {
      await deleteProposal(code);
      setRecords((rs) => (rs ?? []).filter((r) => r.code !== code));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[code];
        return n;
      });
    }
  }

  const ghostBtn =
    "rounded-[7px] border border-hairline-control px-[9px] py-[5px] text-[11px] font-medium text-subtitle transition-colors duration-150 ease-ds hover:border-[#2b3a34] hover:text-title";

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden text-title">
      <SilkBackdrop />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" style={{ background: "linear-gradient(90deg,#2be8d6,#00f2b1)" }} />
      <div className="tf-rise relative mx-auto w-full max-w-[1000px] px-5 py-8 md:py-10">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[9px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSETS.traceLogo} alt="" style={{ height: 20, width: 20 * TRACE_LOGO_AR }} />
            <span className="text-[14px] font-semibold">Trace Finance</span>
          </div>
          <div className="flex items-center gap-3.5 text-[13px]">
            <span className="text-subtitle">Hi, {rep.name.split(" ")[0]}</span>
            <button
              onClick={onSwitch}
              className="text-muted transition-colors duration-150 ease-ds hover:text-title"
            >
              Switch
            </button>
          </div>
        </div>

        {/* title row */}
        <div className="mt-[26px] flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.01em]">
              Your proposals
            </h1>
            <p className="mt-1.5 text-[13px] text-[#8b948f]">
              {records === null ? (
                "Loading your pipeline"
              ) : (
                <>
                  <span className="font-mono text-subtitle">{pipeline.length}</span> proposal
                  {pipeline.length === 1 ? "" : "s"} ·{" "}
                  <span className="font-mono text-subtitle">{viewedCount}</span> viewed
                </>
              )}
            </p>
          </div>
          <a
            href="/new"
            className="flex items-center gap-[7px] rounded-[11px] bg-mint px-4 py-[11px] text-[13px] font-semibold text-mint-on shadow-[0_6px_20px_rgba(0,242,177,.18)] transition-colors duration-150 ease-ds hover:bg-mint-hover active:bg-mint-press"
          >
            <span className="text-[15px] leading-none">+</span> New proposal
          </a>
        </div>

        {!isShareConfigured() && (
          <p className="mt-5 rounded-lg border border-[#e6b566]/30 bg-[#e6b566]/5 px-4 py-3 text-[13px] text-[#e6b566]">
            Sharing isn&apos;t configured, so saved proposals can&apos;t load. You can still create one.
          </p>
        )}

        {/* toolbar */}
        <div className="mt-[22px] flex items-center gap-2.5">
          <div className="flex gap-[3px] rounded-[11px] border border-white/10 bg-[rgba(14,20,16,.7)] p-[3px] backdrop-blur">
            {FILTER_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 ease-ds ${
                  filter === t.id
                    ? "bg-mint font-semibold text-mint-on"
                    : "font-medium text-[#8b948f] hover:text-subtitle"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="ml-auto text-xs text-muted">
            Sorted by <span className="text-subtitle">recent activity</span>
          </div>
        </div>

        {/* pipeline list */}
        <div className="mt-4 overflow-hidden" style={{ ...glassStyle, borderRadius: 18 }}>
          {records === null ? (
            <div className="px-[18px] py-8 text-center text-sm text-muted">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-sm text-muted">
              {filter === "draft"
                ? "No drafts yet."
                : filter === "all"
                  ? "No proposals yet. Create your first one."
                  : `Nothing ${filter} yet.`}
            </div>
          ) : (
            rows.map((r, i) => {
              const status = statusOf(r);
              const stats = r.stats;
              const isOpen = expanded === r.code;
              const viewedOpen = isOpen && status === "viewed" && !!stats;
              const loc = stats?.locations?.[0];
              const typeLabel = TYPE_LABEL[r.proposalType ?? ""] ?? "Proposal";
              return (
                <div
                  key={r.code}
                  style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #141b17" : undefined,
                    background: viewedOpen ? "rgba(0,242,177,.03)" : undefined,
                  }}
                >
                  {/* row */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : r.code)}
                    className={`grid cursor-pointer items-center gap-3.5 px-[18px] py-[15px] transition-colors duration-150 ease-ds ${
                      viewedOpen ? "" : "hover:bg-white/[0.02]"
                    }`}
                    style={{ gridTemplateColumns: "48px 1fr 118px 116px 96px" }}
                  >
                    {/* client logo plate */}
                    {r.clientLogoUrl ? (
                      <span
                        className={`flex h-[34px] w-11 items-center justify-center overflow-hidden rounded-lg ${
                          r.clientLogoPlate === "light"
                            ? "bg-white"
                            : "border border-hairline-control bg-[#0f1814]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.clientLogoUrl} alt={r.clientName} className="max-h-6 max-w-[36px] object-contain" />
                      </span>
                    ) : (
                      <span className="flex h-[34px] w-11 items-center justify-center rounded-lg border border-hairline-control bg-[#0f1814] font-mono text-[11px] font-medium text-mint-avatar">
                        {initials(r.clientName)}
                      </span>
                    )}

                    {/* name + meta */}
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-title">{r.clientName}</div>
                      <div className="mt-px flex min-w-0 items-center gap-2">
                        <span className="truncate text-[11.5px] text-[#6f7a76]">
                          {typeLabel}
                          {r.clientRep ? ` · for ${r.clientRep}` : ""}
                        </span>
                        {r.date && <span className="shrink-0 font-mono text-[11px] text-[#5c6b65]">{r.date}</span>}
                        {status === "viewed" && stats && !isOpen && (
                          <span className="hidden shrink-0 items-center gap-[5px] font-mono text-[10.5px] font-medium text-mint-muted sm:inline-flex">
                            {loc && <Flag country={loc.country} width={14} />}
                            {stats.views} view{stats.views === 1 ? "" : "s"} · {stats.uniqueDevices} viewer
                            {stats.uniqueDevices === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* status */}
                    <span className="justify-self-start">
                      <StatusChip status={status} />
                    </span>

                    {/* last activity */}
                    <span className="font-mono text-xs font-medium text-[#8b948f]">
                      {status === "viewed" && stats?.lastViewedAt
                        ? `opened ${timeAgo(stats.lastViewedAt)}`
                        : `sent ${timeAgo(r.createdAt)}`}
                    </span>

                    {/* action */}
                    <div className="flex justify-self-end">
                      <a
                        href={r.slug ? `/${r.slug}` : `/f/${r.code}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-[7px] border border-hairline-minted px-[9px] py-[5px] text-[11px] font-medium text-[#bfe8d4] transition-colors duration-150 ease-ds hover:border-hairline-selected hover:bg-[rgba(0,242,177,.06)]"
                      >
                        Open
                      </a>
                    </div>
                  </div>

                  {/* view analytics strip (Viewed rows) */}
                  {viewedOpen && (
                    <div
                      className="grid grid-cols-2 sm:grid-cols-4"
                      style={{ borderTop: "1px solid rgba(0,242,177,.14)" }}
                    >
                      <div className="px-[18px] py-[11px]" style={{ borderRight: "1px solid rgba(0,242,177,.1)" }}>
                        <div className="font-mono text-[9px] font-medium tracking-[.12em] text-mint-muted">
                          LAST&nbsp;VIEWED
                        </div>
                        <div className="mt-1 font-mono text-[13px] font-medium text-title">
                          {stats.lastViewedAt ? timeAgo(stats.lastViewedAt) : "—"}
                        </div>
                        <div className="mt-px text-[10px] text-[#5c6b65]">
                          {stats.lastViewedAt ? absTime(stats.lastViewedAt) : ""}
                        </div>
                      </div>
                      <div className="px-[18px] py-[11px]" style={{ borderRight: "1px solid rgba(0,242,177,.1)" }}>
                        <div className="font-mono text-[9px] font-medium tracking-[.12em] text-mint-muted">
                          TIMES&nbsp;VIEWED
                        </div>
                        <div className="mt-1 font-mono text-[13px] font-medium text-title">{stats.views}</div>
                        <div className="mt-px text-[10px] text-[#5c6b65]">
                          {stats.firstViewedAt ? `since ${absDate(stats.firstViewedAt)}` : ""}
                        </div>
                      </div>
                      <div className="px-[18px] py-[11px]" style={{ borderRight: "1px solid rgba(0,242,177,.1)" }}>
                        <div className="font-mono text-[9px] font-medium tracking-[.12em] text-mint-muted">VIEWERS</div>
                        <div className="mt-1 font-mono text-[13px] font-medium text-title">{stats.uniqueDevices}</div>
                        <div className="mt-px text-[10px] text-[#5c6b65]">unique devices</div>
                      </div>
                      <div className="px-[18px] py-[11px]">
                        <div className="font-mono text-[9px] font-medium tracking-[.12em] text-mint-muted">LOCATION</div>
                        {loc ? (
                          <>
                            <div className="mt-1 flex items-center gap-1.5">
                              <Flag country={loc.country} />
                              <span
                                className={
                                  flagCode(loc.country)
                                    ? "text-[12.5px] font-medium text-title"
                                    : "font-mono text-[12.5px] font-medium text-title"
                                }
                              >
                                {locationLabel(loc.country)}
                              </span>
                            </div>
                            <div className="mt-px truncate text-[10px] text-[#5c6b65]">
                              {loc.cities[0] ?? ""}
                              {loc.cities.length > 1 ? ` · ${loc.cities.length} cities` : ""}
                              {stats.locations.length > 1 ? ` · +${stats.locations.length - 1} more` : ""}
                            </div>
                          </>
                        ) : (
                          <div className="mt-1 font-mono text-[13px] font-medium text-[#5c6b65]">—</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* secondary actions, revealed on any expanded row */}
                  {isOpen && (
                    <div
                      className="flex items-center justify-end gap-1.5 px-[18px] py-2.5"
                      style={{
                        borderTop: viewedOpen ? "1px solid rgba(0,242,177,.1)" : "1px solid #141b17",
                      }}
                    >
                      <button onClick={() => copyLink(r)} className={ghostBtn}>
                        {copied === r.code ? "Copied" : "Copy link"}
                      </button>
                      <button
                        onClick={() => onEdit(r.code)}
                        disabled={!!busy[r.code]}
                        className="rounded-[7px] border border-hairline-minted px-[9px] py-[5px] text-[11px] font-medium text-[#bfe8d4] transition-colors duration-150 ease-ds hover:bg-[rgba(0,242,177,.06)] disabled:opacity-60"
                      >
                        {busy[r.code] === "edit" ? "Opening…" : "Edit"}
                      </button>
                      <button
                        onClick={() => onDownload(r)}
                        disabled={!!busy[r.code]}
                        className="rounded-[7px] border border-hairline-minted px-[9px] py-[5px] text-[11px] font-medium text-[#bfe8d4] transition-colors duration-150 ease-ds hover:bg-[rgba(0,242,177,.06)] disabled:opacity-60"
                      >
                        {busy[r.code] === "pdf" ? "Building…" : "PDF"}
                      </button>
                      <button
                        onClick={() => onDelete(r.code)}
                        disabled={!!busy[r.code]}
                        className="rounded-[7px] border border-hairline-control px-[9px] py-[5px] text-[11px] font-medium text-muted transition-colors duration-150 ease-ds hover:border-[#e2715f]/50 hover:text-[#e2715f] disabled:opacity-60"
                      >
                        {busy[r.code] === "del" ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {error && <p className="mt-4 text-[13px] text-[#e6b566]">{error}</p>}
      </div>
    </main>
  );
}
