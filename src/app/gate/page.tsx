"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ASSETS, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { GlassPanel, SilkBackdrop } from "@/flow-tool/components/Glass";

// The site gate in front of every rep-facing page (see src/middleware.ts).
// One password — the rep's own sign-in password — unlocks the whole tool on
// this browser for 90 days; the "Who's presenting?" page then identifies who.
// Client proposal links never see this page.

function GateForm() {
  const params = useSearchParams();
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    if (!key.trim() || checking) return;
    setChecking(true);
    const res = await fetch("/api/auth/gate", { method: "POST", headers: { "x-tf-key": key.trim() } }).catch(() => null);
    setChecking(false);
    if (res?.ok) {
      const next = params.get("next") ?? "/";
      window.location.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } else {
      setWrong(true);
    }
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center px-5 py-14 text-title">
      <SilkBackdrop />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" style={{ background: "linear-gradient(90deg,#2be8d6,#00f2b1)" }} />
      <div className="relative w-full max-w-[400px]">
        <div className="tf-rise mb-5 flex items-center justify-center gap-[9px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSETS.traceLogo} alt="" style={{ height: 26, width: 26 * TRACE_LOGO_AR }} />
          <span className="text-[15px] font-semibold text-title">Trace Finance</span>
        </div>
        <GlassPanel className="tf-rise px-8 py-9">
          <div className="text-center">
            <div className="font-jbmono text-[10px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">Team access</div>
            <h1 className="mt-2.5 font-display text-[26px] font-semibold tracking-[-0.01em] text-title">This area is for the Trace team</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-subtitle">
              Enter your rep password to unlock this browser. Client proposal links are not affected.
            </p>
          </div>
          <form onSubmit={unlock} className="mt-6">
            <input
              type="password"
              autoFocus
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setWrong(false);
              }}
              placeholder="Your password"
              className={`w-full rounded-[12px] border bg-[#0a0f0d]/70 px-4 py-3 text-center text-[14px] text-title outline-none transition placeholder:text-muted/60 ${
                wrong ? "border-red-400/60" : "border-white/12 focus:border-mint/50"
              }`}
            />
            {wrong && <div className="mt-2 text-center text-[12px] text-red-300/90">That’s not it — use your sign-in password.</div>}
            <button
              type="submit"
              disabled={!key.trim() || checking}
              className="mt-4 w-full rounded-[12px] border border-green-accent/40 bg-[#0e1410]/85 px-4 py-3 text-[13.5px] font-semibold text-[#bfe8d4] transition duration-200 ease-ds hover:border-green-accent hover:bg-[#13201a] disabled:opacity-50"
            >
              {checking ? "Checking…" : "Unlock"}
            </button>
          </form>
        </GlassPanel>
      </div>
    </main>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#07090b]" />}>
      <GateForm />
    </Suspense>
  );
}
