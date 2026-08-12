"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { ASSETS, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { GlassPanel, SilkBackdrop } from "@/flow-tool/components/Glass";
import { TRACE_REPS } from "@/flow-tool/data/reps";
import { checkRepKey, isShareConfigured } from "@/flow-tool/lib/share";
import type { TraceRep } from "@/flow-tool/data/schema";

// Two-stage sign-in. Stage 1: "Who's presenting?" — the rep grid. Picking a
// name dismisses the others and the chosen card magic-moves (layoutId) into
// stage 2: a personal "Welcome, {name}" page asking for that rep's password
// ([initials]Trace, validated server-side via /api/auth/check). When sharing
// isn't configured there's nothing to unlock, so picking a name signs in
// directly and stage 2 never shows.

const initials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const firstName = (name: string) => name.split(" ")[0];

const EASE = [0.2, 0.8, 0.2, 1] as const;

// Liquid-glass button material (BRLT family) — background/blur/shadow inline,
// border left to classes so the mint hover state still wins.
const GLASS_BTN: React.CSSProperties = {
  background: "linear-gradient(160deg, rgba(10,15,19,.42), rgba(10,15,19,.28) 45%, rgba(10,15,19,.38))",
  backdropFilter: "blur(28px) saturate(1.4)",
  WebkitBackdropFilter: "blur(28px) saturate(1.4)",
  boxShadow: "0 12px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.18)",
};

export function RepLogin({ onPick }: { onPick: (rep: TraceRep, key: string) => void }) {
  const needsKey = isShareConfigured();
  const reduced = useReducedMotion();
  const D = (s: number) => (reduced ? 0 : s);

  const [picked, setPicked] = useState<TraceRep | null>(null);
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (picked) {
      const t = setTimeout(() => inputRef.current?.focus(), reduced ? 0 : 420);
      return () => clearTimeout(t);
    }
  }, [picked, reduced]);

  function choose(rep: TraceRep) {
    if (!needsKey) {
      onPick(rep, "");
      return;
    }
    setKey("");
    setWrong(false);
    setPicked(rep);
  }

  async function signIn(e: FormEvent) {
    e.preventDefault();
    if (!picked || !key.trim() || checking) return;
    setChecking(true);
    const ok = await checkRepKey(key.trim());
    setChecking(false);
    if (ok) onPick(picked, key.trim());
    else setWrong(true);
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center px-5 py-14 text-title">
      <SilkBackdrop />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" style={{ background: "linear-gradient(90deg,#2be8d6,#00f2b1)" }} />
      <LayoutGroup>
        <div className="relative flex w-full max-w-[480px] flex-1 flex-col items-center pt-10">
          {/* logo row */}
          <div className="tf-rise mb-2 flex items-center gap-[9px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSETS.traceLogo} alt="" style={{ height: 26, width: 26 * TRACE_LOGO_AR }} />
            <span className="text-[15px] font-semibold text-title">Trace Finance</span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {picked === null ? (
              /* ── stage 1: who's presenting? ─────────────────────────────── */
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: D(0.18), ease: EASE } }}
                transition={{ duration: D(0.22), ease: EASE }}
                className="flex w-full flex-col items-center"
              >
                <h1 className="mt-10 text-center font-display text-[27px] font-semibold leading-[1.15] tracking-[-0.01em]">
                  Who&apos;s presenting?
                </h1>
                <p className="mt-[9px] text-center text-[13.5px] text-[#aeb6b2]">
                  Pick your profile to load your proposals.
                </p>

                <div className="mt-9 grid w-full grid-cols-1 gap-[11px] sm:grid-cols-2">
                  {TRACE_REPS.map((rep) => (
                    <motion.button
                      key={rep.id}
                      layoutId={`rep-${rep.id}`}
                      transition={{ layout: { duration: D(0.42), ease: EASE } }}
                      onClick={() => choose(rep)}
                      style={GLASS_BTN}
                      className="flex items-center gap-[11px] rounded-2xl border border-white/[.16] p-3.5 text-left transition-colors duration-150 ease-ds hover:border-[rgba(0,242,177,.55)]"
                    >
                      <motion.span
                        layoutId={`avatar-${rep.id}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(0,242,177,.28)] bg-[#0f1814] font-mono text-[14px] font-medium text-mint-avatar"
                      >
                        {initials(rep.name)}
                      </motion.span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-title">{rep.name}</span>
                        {rep.title && (
                          <span className="mt-0.5 block truncate text-[11px] text-[#8b948f]">{rep.title}</span>
                        )}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* ── stage 2: personal welcome + password ───────────────────── */
              <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: D(0.18), ease: EASE } }}
                transition={{ duration: D(0.26), ease: EASE, delay: D(0.06) }}
                className="flex w-full flex-col items-center"
              >
                <GlassPanel className="mt-10 flex w-full flex-col items-center px-8 pb-9 pt-10">
                <motion.span
                  layoutId={`avatar-${picked.id}`}
                  transition={{ layout: { duration: D(0.42), ease: EASE } }}
                  className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[rgba(0,242,177,.35)] bg-[#0f1814] font-mono text-[22px] font-medium text-mint-avatar"
                >
                  {initials(picked.name)}
                </motion.span>

                <h1 className="mt-5 text-center font-display text-[27px] font-semibold leading-[1.15] tracking-[-0.01em]">
                  Welcome, {firstName(picked.name)}
                </h1>
                {picked.title && <p className="mt-1.5 text-center text-[12.5px] text-[#8b948f]">{picked.title}</p>}
                <p className="mt-3 text-center text-[13.5px] text-[#aeb6b2]">
                  Enter your password to open your pipeline.
                </p>

                <form onSubmit={signIn} className="mt-7 w-full max-w-xs">
                  <input
                    ref={inputRef}
                    type="password"
                    value={key}
                    onChange={(e) => {
                      setKey(e.target.value);
                      setWrong(false);
                    }}
                    placeholder="Your password"
                    autoComplete="current-password"
                    aria-label={`Password for ${picked.name}`}
                    aria-invalid={wrong}
                    className={`w-full rounded-[10px] border bg-surface-input px-3.5 py-3 text-center font-mono text-sm tracking-[.08em] text-title outline-none transition-colors duration-150 ease-ds placeholder:font-sans placeholder:tracking-normal placeholder:text-muted ${
                      wrong ? "border-[#e6b566]/60" : "border-hairline-control focus:border-mint"
                    }`}
                  />
                  {wrong && (
                    <p role="alert" className="mt-2 text-center text-[11.5px] text-[#e6b566]">
                      That&apos;s not it. Check with your team lead.
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={!key.trim() || checking}
                    className="mt-3 w-full rounded-[10px] bg-mint py-3 text-[13px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover active:bg-mint-press disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {checking ? "Signing in" : "Sign in"}
                  </button>
                </form>

                <button
                  onClick={() => setPicked(null)}
                  className="mt-5 text-[11.5px] text-muted transition-colors duration-150 ease-ds hover:text-title"
                >
                  Not you? Choose another profile
                </button>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-auto pb-6 pt-12 font-jbmono text-[10.5px] font-medium tracking-[.2em] text-[#4a5651]">
            TRACE&nbsp;FLOW&nbsp;·&nbsp;INTERNAL
          </div>
        </div>
      </LayoutGroup>
    </main>
  );
}
