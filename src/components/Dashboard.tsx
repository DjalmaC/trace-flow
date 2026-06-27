"use client";
import { useEffect, useMemo, useState } from "react";
import { ASSETS, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { getRep } from "@/flow-tool/data/reps";
import type { ProposalType, TraceRep } from "@/flow-tool/data/schema";
import {
  deleteProposal,
  isShareConfigured,
  listProposals,
  loadSharedFlow,
  type ProposalRecord,
} from "@/flow-tool/lib/share";

const TYPE_LABEL: Record<string, string> = { standard: "Standard", "brazil-market": "Brazil-market" };
const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

type ClientGroup = {
  key: string;
  name: string;
  logo?: string;
  plate?: "light" | "none";
  items: ProposalRecord[];
};

export function Dashboard({ rep, onSwitch }: { rep: TraceRep; onSwitch: () => void }) {
  const [records, setRecords] = useState<ProposalRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, "pdf" | "del">>({});
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

  const groups: ClientGroup[] = useMemo(() => {
    const m = new Map<string, ClientGroup>();
    for (const r of records ?? []) {
      const key = r.clientName.trim().toLowerCase() || r.code;
      if (!m.has(key)) m.set(key, { key, name: r.clientName, logo: r.clientLogoUrl, plate: r.clientLogoPlate, items: [] });
      const g = m.get(key)!;
      g.items.push(r);
      if (!g.logo && r.clientLogoUrl) {
        g.logo = r.clientLogoUrl;
        g.plate = r.clientLogoPlate;
      }
    }
    return [...m.values()];
  }, [records]);

  const open = groups.find((g) => g.key === selected) ?? null;

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${window.location.origin}/f/${code}`);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  async function onDownload(rec: ProposalRecord) {
    setBusy((b) => ({ ...b, [rec.code]: "pdf" }));
    try {
      const cfg = (await loadSharedFlow(rec.code)) as Record<string, unknown> | null;
      if (!cfg) throw new Error("missing");
      const variants = cfg.variants as { flowId: string; name: string }[] | undefined;
      const { downloadProposalPdf } = await import("@/flow-tool/lib/proposal");
      await downloadProposalPdf({
        proposalType: (cfg.proposalType as ProposalType) ?? "standard",
        company: cfg.clientName as string,
        companyRep: cfg.clientRep as string | undefined,
        date: (cfg.date as string) ?? "",
        companyLogoUrl: cfg.clientLogoUrl as string | undefined,
        companyLogoPlate: cfg.clientLogoPlate as "light" | "none" | undefined,
        flows: variants ?? [{ flowId: cfg.flowId as string, name: "Flow" }],
        direction: cfg.direction as never,
        stablecoin: cfg.stablecoin as never,
        collected: cfg.collected as never,
        delivered: cfg.delivered as never,
        rep: getRep(cfg.traceRepId as string | undefined),
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

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden text-title"
      style={{ background: "radial-gradient(55% 50% at 50% 0%, #15392d44 0%, rgba(7,9,11,0) 70%), #07090b" }}
    >
      <div className="mx-auto w-full max-w-4xl px-5 py-10 md:py-14">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSETS.traceLogo} alt="" style={{ height: 24, width: 24 * TRACE_LOGO_AR }} />
            <span className="text-[15px] font-semibold">Trace Finance</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-subtitle">Hi, {rep.name.split(" ")[0]}</span>
            <button onClick={onSwitch} className="text-muted transition hover:text-title">
              Switch
            </button>
          </div>
        </div>

        <h1 className="mt-9 text-2xl font-bold tracking-tight md:text-3xl">Your proposals</h1>
        <p className="mt-1.5 text-sm text-subtitle">By client. Open a card to manage its proposals.</p>

        {!isShareConfigured() && (
          <p className="mt-6 rounded-lg border border-[#e6b566]/30 bg-[#e6b566]/5 px-4 py-3 text-[13px] text-[#e6b566]">
            Sharing isn&apos;t configured, so saved proposals can&apos;t load. You can still create one.
          </p>
        )}

        {/* client grid */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <a
            href="/new"
            className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-green-accent/40 bg-green-fill/10 p-4 text-center transition hover:border-green-accent hover:bg-green-fill/20"
          >
            <span className="text-2xl leading-none text-green-accent">＋</span>
            <span className="text-xs font-semibold text-[#bfe8d4]">New proposal</span>
          </a>

          {records === null ? (
            <div className="col-span-full py-6 text-center text-sm text-muted">Loading…</div>
          ) : (
            groups.map((g) => (
              <button
                key={g.key}
                onClick={() => setSelected(g.key)}
                className={`flex min-h-[112px] flex-col items-center justify-center gap-2.5 rounded-2xl border p-4 text-center transition ${
                  selected === g.key
                    ? "border-green-accent bg-green-fill/25"
                    : "border-node-stroke bg-white/[0.02] hover:border-leg"
                }`}
              >
                {g.logo ? (
                  <span className={`flex h-12 items-center justify-center rounded-md px-2 ${g.plate === "light" ? "bg-white" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.logo} alt={g.name} className="h-9 max-w-[96px] object-contain" />
                  </span>
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-green-accent/30 bg-[#0f1814] text-sm font-semibold text-[#9cc4b3]">
                    {initials(g.name)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-title">{g.name}</span>
                  <span className="block text-[11px] text-muted">
                    {g.items.length} proposal{g.items.length === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {records !== null && groups.length === 0 && (
          <p className="mt-4 text-sm text-muted">No proposals yet. Create your first one.</p>
        )}

        {/* selected client's proposals */}
        {open && (
          <div className="mt-8 rounded-2xl border border-node-stroke bg-white/[0.02] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-title">{open.name}</h2>
              <button onClick={() => setSelected(null)} className="text-sm text-muted hover:text-title">
                Close ✕
              </button>
            </div>
            <div className="space-y-2">
              {open.items.map((r) => (
                <div
                  key={r.code}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-node-stroke bg-node-fill px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-green-fill px-2 py-0.5 text-[11px] font-semibold text-green-text">
                        {TYPE_LABEL[r.proposalType ?? ""] ?? "Proposal"}
                      </span>
                      {r.date && <span className="text-xs text-subtitle">{r.date}</span>}
                    </div>
                    {r.clientRep && <div className="mt-0.5 truncate text-[11px] text-muted">For {r.clientRep}</div>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`/f/${r.code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-node-stroke px-2.5 py-1.5 text-xs font-medium text-subtitle transition hover:text-title"
                    >
                      Open
                    </a>
                    <button
                      onClick={() => copyLink(r.code)}
                      className="rounded-md border border-node-stroke px-2.5 py-1.5 text-xs font-medium text-subtitle transition hover:text-title"
                    >
                      {copied === r.code ? "✓" : "Copy link"}
                    </button>
                    <button
                      onClick={() => onDownload(r)}
                      disabled={!!busy[r.code]}
                      className="rounded-md border border-green-accent/40 px-2.5 py-1.5 text-xs font-medium text-[#bfe8d4] transition hover:bg-[#13201a] disabled:opacity-60"
                    >
                      {busy[r.code] === "pdf" ? "Building…" : "PDF ↓"}
                    </button>
                    <button
                      onClick={() => onDelete(r.code)}
                      disabled={!!busy[r.code]}
                      className="rounded-md border border-node-stroke px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-[#e2715f]/50 hover:text-[#e2715f] disabled:opacity-60"
                    >
                      {busy[r.code] === "del" ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-[13px] text-[#e6b566]">⚑ {error}</p>}
      </div>
    </main>
  );
}
