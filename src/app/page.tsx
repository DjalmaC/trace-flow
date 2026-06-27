"use client";
import { useEffect, useState } from "react";
import { RepLogin } from "@/components/RepLogin";
import { WelcomeSplash } from "@/components/WelcomeSplash";
import { Dashboard } from "@/components/Dashboard";
import type { TraceRep } from "@/flow-tool/data/schema";
import { clearRepId, loadRep, saveRepId } from "@/flow-tool/lib/rep-session";

type Phase = "init" | "login" | "welcome" | "dashboard";

// The rep-facing home: pick who you are (once, remembered), get welcomed, then
// land on your client/proposal dashboard. The flow generator lives at /build.
export default function Home() {
  const [phase, setPhase] = useState<Phase>("init");
  const [rep, setRep] = useState<TraceRep | null>(null);

  useEffect(() => {
    const saved = loadRep();
    if (saved) {
      setRep(saved);
      setPhase("dashboard"); // returning rep skips the welcome
    } else {
      setPhase("login");
    }
  }, []);

  function pick(r: TraceRep) {
    saveRepId(r.id);
    setRep(r);
    setPhase("welcome");
  }
  function switchRep() {
    clearRepId();
    setRep(null);
    setPhase("login");
  }

  if (phase === "init") return <main className="min-h-screen bg-[#07090b]" />;
  if (phase === "login" || !rep) return <RepLogin onPick={pick} />;
  if (phase === "welcome")
    return <WelcomeSplash name={rep.name} onDone={() => setPhase("dashboard")} />;
  return <Dashboard rep={rep} onSwitch={switchRep} />;
}
