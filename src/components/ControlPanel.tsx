"use client";
import { useMemo, useState } from "react";
import type { Currency, Direction, FlowConfig, ProposalSetup, ProposalType, Stablecoin } from "@/flow-tool/data/schema";
import { FLOWS, getFlow } from "@/flow-tool/data";
import { TRACE_REPS, getRep } from "@/flow-tool/data/reps";
import { QUESTIONS, type IntakeAnswers } from "@/flow-tool/intake/questions";
import { resolve, NO_MATCH_MESSAGE } from "@/flow-tool/intake/resolver";
import { createShareLink, isShareConfigured } from "@/flow-tool/lib/share";
import { normalizeLogo } from "@/flow-tool/lib/logo";
import { downloadProposalPdf } from "@/flow-tool/lib/proposal";
import { defaultProposalDate, saveSetup } from "@/flow-tool/lib/setup";

const PROPOSAL_LABELS: Record<ProposalType, string> = {
  standard: "Standard",
  "brazil-market": "Brazil-market",
};

// Logo treatment for the dark canvas: Auto (decide), White/Mint (force recolor
// of a one-colour mark), Card (keep brand colours on a white chip).
type LogoTreatment = "auto" | "white" | "mint" | "card";

type Mode = "intake" | "manual";

const COLLECTED: Currency[] = ["BRL"];
const DELIVERED: Currency[] = ["USD/EUR", "USD", "EUR"];
const STABLECOINS: { value: Stablecoin; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "USDC", label: "USDC" },
  { value: "USDT", label: "USDT" },
];

/** Does the selected flow move a stablecoin (so the coin choice is relevant)? */
function usesStablecoin(flowId: string): boolean {
  const flow = getFlow(flowId);
  return !!flow?.legs.some((l) => l.carries === "USDC/USDT" || l.convertsTo === "USDC/USDT");
}

export function ControlPanel({
  config,
  onConfigChange,
  onPresent,
  setup,
  onSetupChange,
  proposalFlows,
  onProposalFlowsChange,
}: {
  config: FlowConfig;
  onConfigChange: (next: FlowConfig) => void;
  onPresent: () => void;
  setup?: ProposalSetup | null;
  onSetupChange?: (next: ProposalSetup) => void;
  proposalFlows?: { flowId: string; name: string }[];
  onProposalFlowsChange?: (next: { flowId: string; name: string }[]) => void;
}) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("intake");
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [share, setShare] = useState<{ status: "idle" | "loading" | "done" | "error"; url?: string; msg?: string; copied?: boolean }>({ status: "idle" });
  const [pdf, setPdf] = useState<"idle" | "working" | "error">("idle");
  // logo treatment for the dark canvas (recompute from the original each time)
  const [origLogo, setOrigLogo] = useState<string>();
  const [treatment, setTreatment] = useState<LogoTreatment>("auto");

  const flows = proposalFlows ?? [];
  const proposalType: ProposalType = setup?.proposalType ?? "standard";
  const proposalDate = setup?.date ?? defaultProposalDate();
  const traceRepId = setup?.traceRepId ?? TRACE_REPS[0]?.id;

  // Edit the proposal setup in place (creating it from the live config if the
  // salesperson skipped the intro page), and persist it for this session.
  function patchSetup(p: Partial<ProposalSetup>) {
    const next: ProposalSetup = {
      proposalType,
      date: proposalDate,
      traceRepId,
      company: setup?.company ?? config.clientName,
      companyRep: setup?.companyRep ?? config.clientRep,
      companyLogoUrl: setup?.companyLogoUrl ?? config.clientLogoUrl,
      companyLogoPlate: setup?.companyLogoPlate ?? config.clientLogoPlate,
      ...p,
    };
    onSetupChange?.(next);
    saveSetup(next);
  }

  function addCurrentFlow() {
    const f = getFlow(config.flowId);
    if (!f || flows.some((x) => x.flowId === f.id)) return;
    onProposalFlowsChange?.([...flows, { flowId: f.id, name: f.title }]);
  }
  function removeFlow(id: string) {
    onProposalFlowsChange?.(flows.filter((x) => x.flowId !== id));
  }

  // The flows that go into the deck: those explicitly added, else the live one.
  function proposalFlowList() {
    return flows.length
      ? flows
      : [{ flowId: config.flowId, name: getFlow(config.flowId)?.title ?? "Flow" }];
  }

  async function generateProposal() {
    setShare({ status: "loading" });
    try {
      const list = proposalFlowList();
      const shareConfig = {
        ...config,
        variants: list.length > 1 ? list : undefined,
        proposalType,
        date: proposalDate,
        traceRepId,
      };
      const { code } = await createShareLink(shareConfig as FlowConfig);
      const url = `${window.location.origin}/f/${code}`;
      setShare({ status: "done", url });
    } catch (err) {
      setShare({ status: "error", msg: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function downloadPdf() {
    setPdf("working");
    try {
      await downloadProposalPdf({
        proposalType,
        company: config.clientName,
        companyRep: config.clientRep,
        date: proposalDate,
        companyLogoUrl: config.clientLogoUrl,
        companyLogoPlate: config.clientLogoPlate,
        flows: proposalFlowList(),
        direction: config.direction,
        stablecoin: config.stablecoin,
        collected: config.collected,
        delivered: config.delivered,
        rep: getRep(traceRepId),
      });
      setPdf("idle");
    } catch {
      setPdf("error");
      setTimeout(() => setPdf("idle"), 3000);
    }
  }

  const resolution = useMemo(() => resolve(answers, config.clientName), [answers, config.clientName]);

  function patch(p: Partial<FlowConfig>) {
    onConfigChange({ ...config, ...p });
  }

  function answer(qid: string, value: string) {
    const next = { ...answers, [qid]: value };
    setAnswers(next);
    const r = resolve(next, config.clientName);
    if (r.status === "exact" && r.config) {
      // keep client-facing fields, adopt the resolved flow + direction
      onConfigChange({ ...config, flowId: r.config.flowId, direction: r.config.direction });
    }
  }

  // Re-run the normalizer on the ORIGINAL upload with the chosen treatment, so
  // switching White/Mint/Card is reversible and never compounds.
  async function applyTreatment(t: LogoTreatment, base = origLogo) {
    if (!base) return;
    setTreatment(t);
    const r = await normalizeLogo(base, { mark: t === "card" ? "keep" : t });
    patch({ clientLogoUrl: r.url, clientLogoPlate: t === "card" ? "light" : r.plate });
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // read as a data URI so the logo travels with the shared link (a blob: URL
    // from createObjectURL would not survive being stored/sent)
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result);
      setOrigLogo(raw);
      await applyTreatment("auto", raw); // cut bg + auto-decide on insert
    };
    reader.readAsDataURL(file);
  }

  async function copyLink() {
    if (!share.url) return;
    await navigator.clipboard.writeText(share.url);
    setShare((s) => ({ ...s, copied: true }));
    setTimeout(() => setShare((s) => ({ ...s, copied: false })), 1600);
  }

  return (
    <div className="fixed left-4 top-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-node-stroke bg-[#0c110f]/95 text-node-text shadow-2xl backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-t-xl px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-title">Trace Flow — configure</span>
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="max-h-[calc(100vh-6rem)] overflow-y-auto px-4 pb-4">
          {/* mode toggle */}
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-node-fill p-1">
            {(["intake", "manual"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  mode === m ? "bg-green-accent text-[#06120c]" : "text-subtitle hover:text-title"
                }`}
              >
                {m === "intake" ? "Describe the deal" : "Pick manually"}
              </button>
            ))}
          </div>

          {mode === "intake" ? (
            <IntakeForm answers={answers} onAnswer={answer} resolution={resolution} />
          ) : (
            <ManualPicker selected={config.flowId} onSelect={(flowId) => patch({ flowId })} />
          )}

          {/* Proposal flows — add the flow on screen straight into the deck, right
              here so you never scroll to the bottom to stack flows. */}
          <div className="mt-4 rounded-lg border border-node-stroke bg-node-fill/40 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Proposal flows{flows.length ? ` · ${flows.length}` : ""}
              </span>
              {(() => {
                const added = flows.some((x) => x.flowId === config.flowId);
                return (
                  <button
                    onClick={addCurrentFlow}
                    disabled={added}
                    className="shrink-0 rounded-md bg-green-accent px-2.5 py-1 text-[11px] font-semibold text-[#06120c] transition hover:brightness-110 disabled:cursor-default disabled:bg-green-fill disabled:text-green-accent"
                  >
                    {added ? "Added ✓" : "+ Add this flow"}
                  </button>
                );
              })()}
            </div>
            {flows.length === 0 ? (
              <p className="text-[10px] leading-snug text-muted">
                Empty → the deck uses the flow on screen. Add flows to stack several.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {flows.map((f, i) => (
                  <span
                    key={f.flowId}
                    className="flex items-center gap-1.5 rounded-md border border-node-stroke bg-node-fill px-2 py-1 text-[11px] text-title"
                  >
                    <span className="text-muted">{i + 1}</span>
                    <span className="max-w-[150px] truncate">{f.name}</span>
                    <button onClick={() => removeFlow(f.flowId)} className="text-muted transition hover:text-title">
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* client fields */}
          <div className="mt-5 space-y-3 border-t border-node-stroke pt-4">
            <Field label="Client name">
              <input
                value={config.clientName}
                onChange={(e) => patch({ clientName: e.target.value })}
                className="w-full rounded-md border border-node-stroke bg-node-fill px-2 py-1.5 text-sm text-title outline-none focus:border-green-accent"
              />
            </Field>

            <Field label="Client representative">
              <input
                value={config.clientRep ?? ""}
                onChange={(e) => patch({ clientRep: e.target.value })}
                placeholder="e.g. Maria Silva, Head of Finance"
                className="w-full rounded-md border border-node-stroke bg-node-fill px-2 py-1.5 text-sm text-title outline-none placeholder:text-muted focus:border-green-accent"
              />
            </Field>

            <Field label="Client logo">
              <input
                type="file"
                accept="image/*"
                onChange={onLogo}
                className="w-full text-xs text-subtitle file:mr-2 file:rounded file:border-0 file:bg-node-fill file:px-2 file:py-1 file:text-subtitle"
              />
            </Field>

            {config.clientLogoUrl && (
              <Field label="Logo on dark">
                <div
                  className={`mb-2 flex h-11 items-center justify-center rounded-md px-3 ${config.clientLogoPlate === "light" ? "bg-white" : ""}`}
                  style={config.clientLogoPlate === "light" ? undefined : { background: "radial-gradient(70% 70% at 50% 50%, #15392d 0%, #0b1714 75%)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={config.clientLogoUrl} alt="logo preview" className="h-8 w-auto max-w-[160px] object-contain" />
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-node-fill p-1">
                  {([["auto", "Auto"], ["white", "White"], ["mint", "Mint"], ["card", "Card"]] as [LogoTreatment, string][]).map(
                    ([t, label]) => (
                      <button
                        key={t}
                        onClick={() => applyTreatment(t)}
                        className={`rounded-md px-1 py-1.5 text-xs font-medium transition ${
                          treatment === t ? "bg-green-accent text-[#06120c]" : "text-subtitle hover:text-title"
                        }`}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-muted">
                  Background removed automatically. White/Mint repaint a one-colour mark to read on dark; Card keeps brand colours on a white chip.
                </p>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Collected">
                <Select value={config.collected} options={COLLECTED} onChange={(v) => patch({ collected: v as Currency })} />
              </Field>
              <Field label="Delivered">
                <Select value={config.delivered} options={DELIVERED} onChange={(v) => patch({ delivered: v as Currency })} />
              </Field>
            </div>

            <Field label="Direction">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-node-fill p-1">
                {(["collection", "disbursement"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => patch({ direction: d })}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      config.direction === d ? "bg-green-accent text-[#06120c]" : "text-subtitle hover:text-title"
                    }`}
                  >
                    {d === "collection" ? "Pay-in" : "Pay-out"}
                  </button>
                ))}
              </div>
            </Field>

            {usesStablecoin(config.flowId) && (
              <Field label="Stablecoin">
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-node-fill p-1">
                  {STABLECOINS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => patch({ stablecoin: s.value })}
                      className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                        config.stablecoin === s.value ? "bg-green-accent text-[#06120c]" : "text-subtitle hover:text-title"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>

          <button
            onClick={onPresent}
            className="mt-5 w-full rounded-lg bg-green-accent px-3 py-2 text-sm font-semibold text-[#06120c] transition hover:brightness-110"
          >
            Present ▶
          </button>

          {/* ── Generate: proposal type + Trace rep, then link + PDF ── */}
          <div className="mt-4 border-t border-node-stroke pt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Generate proposal</div>

            {/* type + rep pickers */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-node-fill p-1">
                {(["standard", "brazil-market"] as ProposalType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => patchSetup({ proposalType: t })}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      proposalType === t ? "bg-green-accent text-[#06120c]" : "text-subtitle hover:text-title"
                    }`}
                  >
                    {PROPOSAL_LABELS[t]}
                  </button>
                ))}
              </div>

              <Field label="Trace representative">
                <select
                  value={traceRepId}
                  onChange={(e) => patchSetup({ traceRepId: e.target.value })}
                  className="w-full rounded-md border border-node-stroke bg-node-fill px-2 py-1.5 text-sm text-title outline-none focus:border-green-accent"
                >
                  {TRACE_REPS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* generate */}
            <div className="mt-4 space-y-2">
              <button
                onClick={downloadPdf}
                disabled={pdf === "working"}
                className="w-full rounded-lg bg-green-accent px-3 py-2 text-sm font-semibold text-[#06120c] transition hover:brightness-110 disabled:opacity-60"
              >
                {pdf === "working" ? "Building proposal…" : pdf === "error" ? "Try again" : "Download proposal PDF ↓"}
              </button>

              {isShareConfigured() ? (
                <>
                  <button
                    onClick={generateProposal}
                    disabled={share.status === "loading"}
                    className="w-full rounded-lg border border-green-accent/50 px-3 py-2 text-sm font-medium text-green-accent transition hover:bg-green-fill disabled:opacity-60"
                  >
                    {share.status === "loading" ? "Generating…" : "Generate client link 🔗"}
                  </button>
                  {share.status === "done" && share.url && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          readOnly
                          value={share.url}
                          onFocus={(e) => e.target.select()}
                          className="w-full rounded-md border border-node-stroke bg-node-fill px-2 py-1.5 text-[11px] text-subtitle outline-none"
                        />
                        <button
                          onClick={copyLink}
                          className="shrink-0 rounded-md bg-green-accent px-2.5 py-1.5 text-xs font-semibold text-[#06120c] transition hover:brightness-110"
                        >
                          {share.copied ? "✓" : "Copy"}
                        </button>
                      </div>
                      <p className="text-[10px] leading-snug text-muted">
                        View-only proposal for {config.clientName} — flows, pricing and your contact card.
                      </p>
                    </div>
                  )}
                  {share.status === "error" && <p className="text-[11px] text-[#e6b566]">⚑ {share.msg}</p>}
                </>
              ) : (
                <p className="text-[11px] leading-snug text-muted">
                  Client links need <code className="text-subtitle">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. The PDF works without it.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntakeForm({
  answers,
  onAnswer,
  resolution,
}: {
  answers: IntakeAnswers;
  onAnswer: (qid: string, value: string) => void;
  resolution: ReturnType<typeof resolve>;
}) {
  return (
    <div className="space-y-4">
      {QUESTIONS.map((q) => (
        <div key={q.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label className="text-xs font-medium text-title">{q.prompt}</label>
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">{q.source}</span>
          </div>
          <div className="space-y-1">
            {q.options.map((o) => (
              <button
                key={o.value}
                onClick={() => onAnswer(q.id, o.value)}
                className={`block w-full rounded-md border px-2 py-1.5 text-left text-xs transition ${
                  answers[q.id] === o.value
                    ? "border-green-accent bg-green-fill text-green-text"
                    : "border-node-stroke bg-node-fill text-subtitle hover:border-leg"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* resolution feedback (Stage B) */}
      <div className="rounded-lg border border-node-stroke bg-node-fill p-3 text-xs">
        {resolution.status === "empty" && <span className="text-muted">Answer above to resolve a flow.</span>}
        {resolution.status === "partial" && (
          <span className="text-subtitle">
            {resolution.candidates.length} flows still match — keep answering to narrow it down.
          </span>
        )}
        {resolution.status === "exact" && resolution.config && (
          <span className="text-green-accent">
            ✓ Resolved to Flow {resolution.candidates[0].displayId} — {resolution.candidates[0].dials.model}.
          </span>
        )}
        {resolution.status === "no-match" && (
          <span className="text-[#e6b566]">⚑ {NO_MATCH_MESSAGE}</span>
        )}
      </div>
    </div>
  );
}

function ManualPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-1">
      {FLOWS.map((f) => (
        <button
          key={f.id}
          onClick={() => onSelect(f.id)}
          className={`block w-full rounded-md border px-2.5 py-2 text-left transition ${
            selected === f.id
              ? "border-green-accent bg-green-fill"
              : "border-node-stroke bg-node-fill hover:border-leg"
          }`}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Flow {f.displayId}</span>
            <span className="text-[10px] text-muted">{f.dials.model}</span>
          </div>
          <div className="mt-0.5 text-xs font-semibold text-title">{f.title}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-muted">{f.blurb}</div>
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">{label}</label>
      {children}
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-node-stroke bg-node-fill px-2 py-1.5 text-sm text-title outline-none focus:border-green-accent"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
