"use client";
import { useEffect, useState } from "react";
import { ASSETS, C, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";

// The same welcome choreography the client sees on a private link, reused for
// the rep after they pick who they are: hold "Welcome, {name}", then fade out
// and hand off to the dashboard.
const HOLD_MS = 1900;
const FADE_MS = 800;

export function WelcomeSplash({ name, onDone }: { name: string; onDone: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), HOLD_MS);
    const t2 = setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  const first = name.split(" ")[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center"
      style={{
        background: "#07090b",
        transition: `opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1)`,
        opacity: fading ? 0 : 1,
      }}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.traceLogo} alt="" style={{ height: 32, width: 32 * TRACE_LOGO_AR }} />
        <span className="text-[24px] font-semibold" style={{ color: C.title }}>
          Trace Finance
        </span>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-title md:text-4xl">Welcome, {first}</h1>
      <p className="max-w-md text-sm text-subtitle">Your proposals and prospects, in one place.</p>
    </div>
  );
}
