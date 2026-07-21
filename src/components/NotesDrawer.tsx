"use client";
import { useState } from "react";

// A slide-out proposal-notes drawer with a vertical tab on the right edge.
// Read-only on the client link (the tab only shows when there are notes);
// editable on the builder (the tab is always available so the rep can add
// them). One line per point; a line starting with "- ", "* " or "•" renders as
// a bullet — same convention as the per-flow note.

const BULLET_RE = /^[-*•]\s+/;

function NotesBody({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const asBullets = lines.some((l) => BULLET_RE.test(l));
  if (!asBullets) return <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-subtitle">{lines.join("\n")}</p>;
  return (
    <ul className="flex flex-col gap-2 text-[13.5px] leading-relaxed text-subtitle">
      {lines.map((l, i) =>
        BULLET_RE.test(l) ? (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-mint" />
            <span className="min-w-0">{l.replace(BULLET_RE, "")}</span>
          </li>
        ) : (
          <li key={i}>{l}</li>
        ),
      )}
    </ul>
  );
}

export function NotesDrawer({
  notes,
  editable = false,
  onChange,
}: {
  notes?: string;
  editable?: boolean;
  onChange?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const has = editable || !!notes?.trim();
  if (!has) return null;

  return (
    <aside
      className="no-print fixed right-0 top-1/2 z-[60] flex w-[min(360px,86vw)] -translate-y-1/2 transition-transform duration-300 ease-[cubic-bezier(.4,0,.2,1)] motion-reduce:transition-none"
      style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      aria-hidden={!open}
    >
      {/* tab — rides on the panel's left edge, always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Hide notes" : "Show notes"}
        className="absolute -left-8 top-1/2 flex h-[104px] w-8 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-mint/40 bg-[#0c1210]/95 text-mint backdrop-blur transition hover:bg-[#11201a]"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          Notes
        </span>
      </button>

      {/* panel */}
      <div className="flex max-h-[80vh] w-full flex-col rounded-l-2xl border border-r-0 border-white/10 bg-[#0f1411] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-mint-muted">Notes</span>
          <button onClick={() => setOpen(false)} aria-label="Close notes" className="text-muted transition hover:text-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {editable ? (
            <textarea
              value={notes ?? ""}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="Notes for this proposal. One line per point; start a line with '- ' for a bullet. The client sees these in this drawer."
              className="h-[46vh] w-full resize-none rounded-lg border border-hairline-control bg-surface-input px-3 py-2.5 text-[13px] leading-relaxed text-title outline-none placeholder:text-muted focus:border-mint"
            />
          ) : (
            <NotesBody text={notes ?? ""} />
          )}
        </div>
      </div>
    </aside>
  );
}
