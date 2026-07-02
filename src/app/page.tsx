"use client";
import { useEffect, useState } from "react";
import { RepLogin } from "@/components/RepLogin";
import { Dashboard } from "@/components/Dashboard";
import type { TraceRep } from "@/flow-tool/data/schema";
import { clearRepId, loadRep, saveRepId, saveRepKey } from "@/flow-tool/lib/rep-session";

type Phase = "init" | "login" | "dashboard";

// The rep-facing home: the two-stage sign-in (pick your profile, enter your
// password), then the pipeline dashboard. The flow generator lives at /build.
export default function Home() {
  const [phase, setPhase] = useState<Phase>("init");
  const [rep, setRep] = useState<TraceRep | null>(null);

  useEffect(() => {
    const saved = loadRep();
    if (saved) {
      setRep(saved);
      setPhase("dashboard"); // returning rep skips the sign-in
    } else {
      setPhase("login");
    }
  }, []);

  function pick(r: TraceRep, key: string) {
    saveRepId(r.id);
    if (key) saveRepKey(key);
    setRep(r);
    // The sign-in page already welcomed them by name; go straight to work.
    setPhase("dashboard");
  }
  function switchRep() {
    clearRepId();
    setRep(null);
    setPhase("login");
  }

  if (phase === "init") return <main className="min-h-screen bg-[#07090b]" />;
  if (phase === "login" || !rep) return <RepLogin onPick={pick} />;
  return <Dashboard rep={rep} onSwitch={switchRep} />;
}
