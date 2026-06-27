"use client";
import { ASSETS, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { TRACE_REPS } from "@/flow-tool/data/reps";
import type { TraceRep } from "@/flow-tool/data/schema";

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// "Who are you?" — the rep picks their identity. Not auth; just personalises the
// session and scopes the dashboard to their proposals.
export function RepLogin({ onPick }: { onPick: (rep: TraceRep) => void }) {
  return (
    <main
      className="flex min-h-screen w-full flex-col items-center justify-center px-5 py-16 text-title"
      style={{ background: "radial-gradient(60% 55% at 50% 0%, #15392d55 0%, rgba(7,9,11,0) 70%), #07090b" }}
    >
      <div className="mb-8 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.traceLogo} alt="" style={{ height: 26, width: 26 * TRACE_LOGO_AR }} />
        <span className="text-[15px] font-semibold">Trace Finance</span>
      </div>

      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Who are you?</h1>
      <p className="mt-2 text-sm text-subtitle">Pick your profile to load your proposals.</p>

      <div className="mt-10 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
        {TRACE_REPS.map((rep) => (
          <button
            key={rep.id}
            onClick={() => onPick(rep)}
            className="flex items-center gap-3 rounded-2xl border border-node-stroke bg-white/[0.02] px-4 py-3.5 text-left transition hover:border-green-accent/60 hover:bg-green-fill/20"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-green-accent/30 bg-[#0f1814] text-sm font-semibold text-[#9cc4b3]">
              {initials(rep.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-title">{rep.name}</span>
              {rep.title && <span className="block truncate text-xs text-subtitle">{rep.title}</span>}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}
