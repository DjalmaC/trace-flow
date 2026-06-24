"use client";
import { useMemo, useState } from "react";
import type { Currency, Direction, FlowConfig, Stablecoin } from "@/flow-tool/data/schema";
import { FLOWS, getFlow } from "@/flow-tool/data";
import { QUESTIONS, type IntakeAnswers } from "@/flow-tool/intake/questions";
import { resolve, NO_MATCH_MESSAGE } from "@/flow-tool/intake/resolver";
import { createShareLink, isShareConfigured } from "@/flow-tool/lib/share";

type Mode = "intake" | "manual";

const COLLECTED: Currency[] = ["BRL"];
const DELIVERED: Currency[] = ["USD/EUR"];
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
}: {
  config: FlowConfig;
  onConfigChange: (next: FlowConfig) => void;
  onPresent: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("intake");
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [share, setShare] = useState<{ status: "idle" | "loading" | "done" | "error"; url?: string; msg?: string; copied?: boolean }>({ status: "idle" });

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

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // read as a data URI so the logo travels with the shared link (a blob: URL
    // from createObjectURL would not survive being stored/sent)
    const reader = new FileReader();
    reader.onload = () => patch({ clientLogoUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  async function generateLink() {
    setShare({ status: "loading" });
    try {
      const { code } = await createShareLink(config);
      const url = `${window.location.origin}/f/${code}`;
      setShare({ status: "done", url });
    } catch (err) {
      setShare({ status: "error", msg: err instanceof Error ? err.message : "Something went wrong." });
    }
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

          {/* Share: a locked, view-only link for the client (just this flow). */}
          <div className="mt-4 border-t border-node-stroke pt-4">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Send to client</div>
            {isShareConfigured() ? (
              <>
                <button
                  onClick={generateLink}
                  disabled={share.status === "loading"}
                  className="w-full rounded-lg border border-green-accent/50 px-3 py-2 text-sm font-medium text-green-accent transition hover:bg-green-fill disabled:opacity-60"
                >
                  {share.status === "loading" ? "Generating…" : "Generate client link 🔗"}
                </button>
                {share.status === "done" && share.url && (
                  <div className="mt-2 space-y-1.5">
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
                      View-only. Opens just this flow for {config.clientName}, with no access to the rest of the tool.
                    </p>
                  </div>
                )}
                {share.status === "error" && (
                  <p className="mt-2 text-[11px] text-[#e6b566]">⚑ {share.msg}</p>
                )}
              </>
            ) : (
              <p className="text-[11px] leading-snug text-muted">
                Sharing isn’t configured yet — add <code className="text-subtitle">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable client links.
              </p>
            )}
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
            <span className="text-xs font-semibold text-title">Flow {f.displayId}</span>
            <span className="text-[10px] text-muted">{f.dials.model}</span>
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-subtitle">{f.blurb}</div>
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
