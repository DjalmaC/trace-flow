"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FLOWS } from "@/flow-tool/data";

// ─────────────────────────────────────────────────────────────────────────────
// ⌘K command palette (design handoff 3a). Opened by the global meta/ctrl+K
// binding on /build (registered by the ControlPanel rail) or the ⌘K chip in the
// rail header. Two groups: FLOWS (the full library — selecting one patches
// config.flowId) and ACTIONS (add-to-proposal / generate link / present).
// ─────────────────────────────────────────────────────────────────────────────

export interface PaletteAction {
  id: string;
  label: string;
  icon: "plus" | "link" | "play";
  run: () => void;
}

/** "7" → "07" to match the mock's two-digit badges; "9.1"/"11.1" pass through. */
function padId(displayId: string) {
  return displayId.length === 1 ? `0${displayId}` : displayId;
}

/** Fuzzy-ish match: every whitespace-separated token must appear as a substring. */
function matches(query: string, haystack: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const h = haystack.toLowerCase();
  return tokens.every((t) => h.includes(t));
}

function ActionIcon({ icon }: { icon: PaletteAction["icon"] }) {
  if (icon === "plus")
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  if (icon === "link")
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    );
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}

export function CommandPalette({
  open,
  onClose,
  onSelectFlow,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  onSelectFlow: (flowId: string) => void;
  actions: PaletteAction[];
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const flowResults = useMemo(
    () => FLOWS.filter((f) => matches(query, `${f.displayId} ${f.id} flow ${f.title} ${f.blurb} ${f.dials.model}`)),
    [query],
  );
  const actionResults = useMemo(() => actions.filter((a) => matches(query, a.label)), [actions, query]);
  const total = flowResults.length + actionResults.length;

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  function select(i: number) {
    if (i < flowResults.length) {
      const f = flowResults[i];
      if (f) onSelectFlow(f.id);
    } else {
      actionResults[i - flowResults.length]?.run();
    }
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (total ? (h + 1) % total : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (total ? (h - 1 + total) % total : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (total) select(Math.min(highlight, total - 1));
    }
  }

  const active = Math.min(highlight, Math.max(total - 1, 0));

  return (
    <div className="fixed inset-0 z-[90]" onKeyDown={onKeyDown} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-[rgba(6,10,8,.55)]" onClick={onClose} />
      <div
        className="absolute left-1/2 top-[112px] w-[540px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/[.16]"
        style={{
          background: "linear-gradient(160deg, rgba(9,13,11,.9), rgba(9,13,11,.84) 45%, rgba(9,13,11,.88))",
          backdropFilter: "blur(28px) saturate(1.4)",
          WebkitBackdropFilter: "blur(28px) saturate(1.4)",
          boxShadow: "0 30px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.18)",
        }}
      >
        {/* search row */}
        <div className="flex items-center gap-2.5 border-b border-hairline-row px-[18px] py-[15px]">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6f8a7f" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            placeholder="Jump to a flow or run an action…"
            className="flex-1 bg-transparent text-[15px] font-medium text-title outline-none placeholder:font-normal placeholder:text-muted"
          />
          <span className="rounded-[5px] border border-hairline-control px-1.5 py-[3px] font-mono text-[10px] font-medium text-[#4a5651]">
            ESC
          </span>
        </div>

        {/* results */}
        <div className="max-h-[380px] overflow-y-auto p-[7px]">
          {flowResults.length > 0 && (
            <div className="px-[11px] pb-[5px] pt-2 font-mono text-[9.5px] font-medium tracking-[.14em] text-[#4a5651]">FLOWS</div>
          )}
          {flowResults.map((f, i) => {
            const isActive = i === active;
            return (
              <button
                key={f.id}
                onClick={() => select(i)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-left transition duration-150 ease-ds ${
                  isActive ? "bg-mint/10" : ""
                }`}
              >
                <span
                  className={`shrink-0 rounded-[5px] border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    isActive ? "border-hairline-minted text-mint" : "border-hairline-control text-mint-muted"
                  }`}
                >
                  {padId(f.displayId)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  <span className={isActive ? "text-title" : "text-node-text"}>{f.title}</span>
                  <span className="font-normal text-[#8b948f]"> · {f.blurb}</span>
                </span>
                {isActive && <span className="shrink-0 font-mono text-[10px] font-medium text-mint-muted">↵</span>}
              </button>
            );
          })}

          {actionResults.length > 0 && (
            <div className="px-[11px] pb-[5px] pt-2.5 font-mono text-[9.5px] font-medium tracking-[.14em] text-[#4a5651]">ACTIONS</div>
          )}
          {actionResults.map((a, j) => {
            const i = flowResults.length + j;
            const isActive = i === active;
            return (
              <button
                key={a.id}
                onClick={() => select(i)}
                onMouseEnter={() => setHighlight(i)}
                className={`flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-left transition duration-150 ease-ds ${
                  isActive ? "bg-mint/10" : ""
                }`}
              >
                <span className={isActive ? "text-mint" : "text-[#8b948f]"}>
                  <ActionIcon icon={a.icon} />
                </span>
                <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${isActive ? "text-title" : "text-node-text"}`}>
                  {a.label}
                </span>
                {isActive && <span className="shrink-0 font-mono text-[10px] font-medium text-mint-muted">↵</span>}
              </button>
            );
          })}

          {total === 0 && (
            <p className="px-[11px] py-4 text-[12.5px] text-muted">No matches. Try a flow number, a model name, or an action.</p>
          )}
        </div>
      </div>
    </div>
  );
}
