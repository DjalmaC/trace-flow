"use client";
import { useMemo, useState } from "react";
import type { Currency, Direction, FlowConfig } from "@/flow-tool/data/schema";
import { FLOWS } from "@/flow-tool/data";
import { QUESTIONS, type IntakeAnswers } from "@/flow-tool/intake/questions";
import { resolve, NO_MATCH_MESSAGE } from "@/flow-tool/intake/resolver";

type Mode = "intake" | "manual";

const COLLECTED: Currency[] = ["BRL"];
const DELIVERED: Currency[] = ["USD/EUR", "USDC", "USDT"];

export function ControlPanel({
  config,
  onConfigChange,
  onPresent,
  onGenerateProposal,
}: {
  config: FlowConfig;
  onConfigChange: (next: FlowConfig) => void;
  onPresent: () => void;
  onGenerateProposal: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<Mode>("intake");
  const [answers, setAnswers] = useState<IntakeAnswers>({});

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
    if (file) patch({ clientLogoUrl: URL.createObjectURL(file) });
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
          </div>

          <button
            onClick={onPresent}
            className="mt-5 w-full rounded-lg bg-green-accent px-3 py-2 text-sm font-semibold text-[#06120c] transition hover:brightness-110"
          >
            Present ▶
          </button>

          {/* Generate Proposal — print-to-PDF document for the configured flow
              (build brief §10). Pricing lands later via FlowConfig.pricing. */}
          <button
            onClick={onGenerateProposal}
            className="mt-2 w-full rounded-lg border border-node-stroke px-3 py-2 text-sm font-medium text-subtitle transition hover:border-green-accent hover:text-title"
          >
            Generate Proposal ⎙
          </button>
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
