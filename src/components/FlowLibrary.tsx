"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FLOWS } from "@/flow-tool/data";
import { QUESTIONS, type IntakeAnswers } from "@/flow-tool/intake/questions";
import { NO_MATCH_MESSAGE, type resolve } from "@/flow-tool/intake/resolver";
import type { Flow } from "@/flow-tool/data/schema";
import { SilkBackdrop } from "@/flow-tool/components/Glass";

// ─────────────────────────────────────────────────────────────────────────────
// The Flow Studio — the dedicated space for choosing the client's flows,
// design-handoff 3c first: "make describe-the-deal the whole point". Opened
// from the build rail's Deal step, full-screen over the canvas.
//
//   Describe (default) — the resolver questionnaire as plain-language cards
//     with pill answers and a LIVE resolution banner (mint when exact:
//     "Resolves to Flow 7 · VA+NRA — locked in privately"). Exact resolution
//     can be previewed on the canvas or added straight to the deck.
//   Browse — the full library as searchable cards for reps who know the
//     number they want (the old manual picker, elevated).
//
// Both modes share the deck tray: ordering + per-flow display names (these
// become the variant labels the client sees). "Peek" collapses the studio to a
// slim bar so the canvas behind can be watched live.
// ─────────────────────────────────────────────────────────────────────────────

export type DeckFlow = { flowId: string; name: string };
export type StudioMode = "describe" | "browse";
type Resolution = ReturnType<typeof resolve>;

function XIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function PlusIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function CheckIcon({ size = 11, sw = 3 }: { size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function EyeIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function ArrowIcon({ dir, size = 11 }: { dir: "up" | "down"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {dir === "up" ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
    </svg>
  );
}

function matchesQuery(f: Flow, q: string): boolean {
  if (!q.trim()) return true;
  const hay = `${f.displayId} ${f.id} ${f.title} ${f.blurb} ${f.dials.model}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((tok) => hay.includes(tok));
}

export function FlowLibrary({
  open,
  initialMode = "describe",
  onClose,
  clientName,
  deck,
  onDeckChange,
  previewId,
  onPreview,
  answers,
  onAnswer,
  onResetAnswers,
  resolution,
}: {
  open: boolean;
  initialMode?: StudioMode;
  onClose: () => void;
  clientName: string;
  deck: DeckFlow[];
  onDeckChange: (next: DeckFlow[]) => void;
  /** The flow currently on the canvas behind the studio. */
  previewId: string;
  onPreview: (flowId: string) => void;
  answers: IntakeAnswers;
  onAnswer: (qid: string, value: string) => void;
  onResetAnswers: () => void;
  resolution: Resolution;
}) {
  const [mode, setMode] = useState<StudioMode>(initialMode);
  const [q, setQ] = useState("");
  const [peek, setPeek] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  // DS motion: 120–280ms, standard ease, quiet. Everything collapses to
  // instant when the OS asks for reduced motion.
  const EASE = [0.2, 0.8, 0.2, 1] as const;
  const D = (s: number) => (reduced ? 0 : s);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setPeek(false);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (open && mode === "browse") {
      const t = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (peek) setPeek(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, peek, onClose]);

  const results = useMemo(() => FLOWS.filter((f) => matchesQuery(f, q)), [q]);
  const inDeck = (id: string) => deck.some((d) => d.flowId === id);
  const answered = QUESTIONS.filter((question) => answers[question.id] != null).length;

  const resolved: Flow | undefined =
    resolution.status === "exact" ? resolution.candidates[0] : undefined;

  function addToDeck(f: Flow) {
    if (!inDeck(f.id)) onDeckChange([...deck, { flowId: f.id, name: f.title }]);
  }
  function toggleDeck(f: Flow) {
    if (inDeck(f.id)) onDeckChange(deck.filter((d) => d.flowId !== f.id));
    else addToDeck(f);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= deck.length) return;
    const next = [...deck];
    [next[i], next[j]] = [next[j], next[i]];
    onDeckChange(next);
  }
  function rename(i: number, name: string) {
    onDeckChange(deck.map((d, k) => (k === i ? { ...d, name } : d)));
  }

  // Peek: a slim bottom bar over the live canvas; the studio itself hides.
  const peekBar = (
    <motion.div
      key="peek"
      initial={{ y: "110%" }}
      animate={{ y: 0 }}
      exit={{ y: "110%" }}
      transition={{ duration: D(0.24), ease: EASE }}
      className="fixed inset-x-0 bottom-0 z-[70] flex items-center justify-between gap-3 border-t border-hairline-card bg-[#0c110f]/95 px-5 py-3 backdrop-blur"
    >
      <span className="min-w-0 truncate text-[12.5px] text-subtitle">
        Previewing <span className="font-semibold text-title">{FLOWS.find((f) => f.id === previewId)?.title ?? previewId}</span>
      </span>
      <button
        onClick={() => setPeek(false)}
        className="shrink-0 rounded-[9px] bg-mint px-4 py-2 text-[12.5px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover active:bg-mint-press"
      >
        Back to the studio
      </button>
    </motion.div>
  );

  const studio = (
    <motion.div
      key="studio"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: D(0.16), ease: EASE } }}
      transition={{ duration: D(0.22), ease: EASE }}
      className="fixed inset-0 z-[70] flex flex-col"
    >
      <SilkBackdrop />
      <div className="relative h-[3px] w-full shrink-0" style={{ background: "linear-gradient(90deg,#2be8d6,#00f2b1)" }} />

      {/* content settles in with a slight rise, just behind the backdrop fade */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: D(0.26), ease: EASE, delay: D(0.05) }}
        className="flex min-h-0 flex-1 flex-col"
      >
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline-row px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[.3em] text-mint-muted">Flow studio</div>
          <h2 className="truncate font-display text-[19px] font-semibold tracking-[-0.01em] text-title">
            {clientName.trim() ? `${clientName.trim()}'s flows` : "The client's flows"}
          </h2>
        </div>
        <div className="flex gap-0.5 rounded-[11px] border border-hairline-control bg-surface-input p-[3px]">
          {(
            [
              { id: "describe", label: "Describe the deal" },
              { id: "browse", label: "Browse all" },
            ] as { id: StudioMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`rounded-lg px-3.5 py-[7px] text-[12.5px] transition duration-150 ease-ds ${
                mode === m.id ? "bg-mint font-semibold text-mint-on" : "font-medium text-[#8b948f] hover:text-title"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === "browse" && (
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search flows: NRA, sandwich, payout"
            className="w-[240px] max-w-full rounded-[10px] border border-hairline-control bg-surface-input px-3.5 py-2.5 text-[13px] text-title outline-none transition duration-150 ease-ds placeholder:text-muted focus:border-mint"
          />
        )}
        <button
          onClick={() => setPeek(true)}
          className="flex items-center gap-1.5 rounded-[10px] border border-hairline-control px-3.5 py-2.5 text-[12.5px] font-medium text-subtitle transition duration-150 ease-ds hover:border-mint/40 hover:text-title"
        >
          <EyeIcon /> Peek at canvas
        </button>
        <button
          onClick={onClose}
          aria-label="Close the flow studio"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-hairline-control text-subtitle transition duration-150 ease-ds hover:text-title"
        >
          <XIcon />
        </button>
      </div>

      {/* body — crossfades between Describe and Browse */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: D(0.16), ease: EASE }}>
        {mode === "describe" ? (
          <div className="mx-auto flex w-[620px] max-w-full flex-col gap-3.5 pb-4">
            <div className="mb-1 text-center">
              <div className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[.3em] text-mint-muted">Describe the deal</div>
              <h3 className="font-display text-[24px] font-semibold tracking-[-0.01em] text-title">
                A few questions, in plain language
              </h3>
              <p className="mt-1.5 text-[13px] text-subtitle">
                Answer them the way you&apos;d ask the client. The right flow resolves itself, no flow numbers to memorise.
              </p>
            </div>

            {QUESTIONS.map((question) => (
              <div key={question.id} className="rounded-[14px] border border-hairline-card bg-white/[0.02] px-[18px] py-[15px]">
                <div className="mb-2.5 flex items-baseline justify-between gap-3">
                  <span className="text-[13.5px] font-medium text-title">{question.prompt}</span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[.14em] text-muted">{question.source}</span>
                </div>
                <div className="flex flex-wrap gap-[9px]">
                  {question.options.map((o) => {
                    const active = answers[question.id] === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => onAnswer(question.id, o.value)}
                        aria-pressed={active}
                        className={`min-w-[120px] flex-1 rounded-[9px] px-3 py-2.5 text-center text-[12.5px] transition duration-150 ease-ds ${
                          active
                            ? "bg-mint font-semibold text-mint-on"
                            : "border border-hairline-control bg-surface-card font-medium text-node-text hover:border-mint/40 hover:text-title"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* live resolution banner — settles in as its state changes */}
            <motion.div
              key={`${resolution.status}-${resolved?.id ?? ""}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: D(0.18), ease: EASE }}
            >
            {resolution.status === "exact" && resolved ? (
              <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-mint/30 bg-[rgba(0,242,177,.06)] px-[18px] py-3.5">
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-mint text-mint-on">
                  <CheckIcon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-title">
                    Resolves to Flow {resolved.displayId} · {resolved.dials.model}
                  </div>
                  <div className="text-[11.5px] text-mint-muted">Locked in privately. The client never sees you choose.</div>
                </div>
                <button
                  onClick={() => {
                    onPreview(resolved.id);
                    setPeek(true);
                  }}
                  className="flex items-center gap-1.5 rounded-[10px] border border-hairline-control px-3.5 py-2 text-[12.5px] font-medium text-subtitle transition duration-150 ease-ds hover:border-mint/40 hover:text-title"
                >
                  <EyeIcon size={12} /> Preview
                </button>
                <button
                  onClick={() => {
                    onPreview(resolved.id);
                    addToDeck(resolved);
                  }}
                  disabled={inDeck(resolved.id)}
                  className="flex items-center gap-1.5 rounded-[10px] bg-mint px-4 py-2 text-[12.5px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover disabled:cursor-default disabled:bg-status-viewedBg disabled:text-mint"
                >
                  {inDeck(resolved.id) ? (
                    <>
                      <CheckIcon size={11} /> In the deck
                    </>
                  ) : (
                    <>Build it into the deck</>
                  )}
                </button>
              </div>
            ) : resolution.status === "no-match" ? (
              <div className="rounded-[14px] border border-[#e6b566]/40 bg-[#241d10] px-[18px] py-3.5 text-[12.5px] leading-relaxed text-[#e6b566]">
                {NO_MATCH_MESSAGE}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-[14px] border border-hairline-card bg-white/[0.02] px-[18px] py-3.5">
                <span className="text-[12.5px] text-subtitle">
                  {resolution.status === "empty"
                    ? "Answer above to resolve a flow."
                    : `${resolution.candidates.length} flows still match. Keep answering to narrow it down.`}
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {answered}/{QUESTIONS.length}
                </span>
              </div>
            )}
            </motion.div>

            {answered > 0 && (
              <button onClick={onResetAnswers} className="self-center text-[11.5px] text-muted transition hover:text-title">
                Clear answers and start over
              </button>
            )}
          </div>
        ) : results.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No flows match. Try fewer words.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {results.map((f) => {
              const added = inDeck(f.id);
              const previewing = previewId === f.id;
              return (
                <div
                  key={f.id}
                  className={`flex flex-col rounded-2xl border p-4 transition duration-150 ease-ds ${
                    added ? "border-hairline-selected bg-[rgba(0,242,177,.05)]" : "border-hairline-card bg-white/[0.02] hover:border-hairline-control"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="rounded-md border border-hairline-control px-1.5 py-0.5 font-mono text-[11px] font-medium text-mint">
                      {f.displayId}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[.08em] text-muted">{f.dials.model}</span>
                    {f.traceRole.length > 0 && (
                      <span className="ml-auto flex gap-1">
                        {f.traceRole.map((r) => (
                          <span key={r} className="rounded-md bg-[#0c2020] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-cyan2">
                            {r === "Correspondente Cambial" ? "CC" : r}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-[14px] font-semibold leading-snug text-title">{f.title}</div>
                  <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">{f.blurb}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        onPreview(f.id);
                        setPeek(true);
                      }}
                      className={`flex items-center gap-1.5 rounded-[9px] border px-3 py-1.5 text-[11.5px] font-medium transition duration-150 ease-ds ${
                        previewing
                          ? "border-mint/50 text-[#bfe8d4]"
                          : "border-hairline-control text-subtitle hover:border-mint/40 hover:text-title"
                      }`}
                    >
                      <EyeIcon size={11} /> {previewing ? "On canvas" : "Preview"}
                    </button>
                    <button
                      onClick={() => toggleDeck(f)}
                      className={`ml-auto flex items-center gap-1.5 rounded-[9px] px-3 py-1.5 text-[11.5px] font-semibold transition duration-150 ease-ds ${
                        added
                          ? "border border-hairline-selected bg-status-viewedBg text-mint hover:text-[#bfe8d4]"
                          : "bg-mint text-mint-on hover:bg-mint-hover"
                      }`}
                    >
                      {added ? (
                        <>
                          <CheckIcon size={10} /> In deck
                        </>
                      ) : (
                        <>
                          <PlusIcon size={10} /> Add to deck
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </motion.div>
      </div>

      {/* deck tray */}
      <div className="border-t border-hairline-row bg-[#0c110f]/90 px-6 py-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[.24em] text-mint-muted">
            The deck · {deck.length || "empty"}
          </span>
          <span className="text-[11px] text-muted">
            {deck.length === 0
              ? "An empty deck presents just the flow on the canvas."
              : "Names here are what the client sees on the link. Order is slide order."}
          </span>
        </div>
        {deck.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {deck.map((d, i) => (
              <span
                key={d.flowId}
                className="flex items-center gap-1.5 rounded-[10px] border border-hairline-control bg-node-fill py-1.5 pl-2.5 pr-1.5"
              >
                <span className="font-mono text-[10.5px] text-mint">{i + 1}</span>
                <input
                  value={d.name}
                  onChange={(e) => rename(i, e.target.value)}
                  aria-label={`Display name for ${d.flowId}`}
                  size={Math.max(8, d.name.length)}
                  className="bg-transparent text-[12px] font-medium text-title outline-none"
                />
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="rounded p-1 text-muted transition hover:text-title disabled:opacity-30">
                  <ArrowIcon dir="up" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === deck.length - 1} aria-label="Move later" className="rounded p-1 text-muted transition hover:text-title disabled:opacity-30">
                  <ArrowIcon dir="down" />
                </button>
                <button onClick={() => onDeckChange(deck.filter((x) => x.flowId !== d.flowId))} aria-label={`Remove ${d.name}`} className="rounded p-1 text-muted transition hover:text-[#e2715f]">
                  <XIcon size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      </motion.div>
    </motion.div>
  );

  return <AnimatePresence>{open ? (peek ? peekBar : studio) : null}</AnimatePresence>;
}
