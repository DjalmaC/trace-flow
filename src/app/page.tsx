"use client";
import { useEffect, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { ControlPanel } from "@/components/ControlPanel";
import { defaultConfig } from "@/flow-tool/data";
import type { FlowConfig } from "@/flow-tool/data/schema";

export default function Page() {
  const [config, setConfig] = useState<FlowConfig>(() => defaultConfig("flow-1", "Your Client"));
  const [present, setPresent] = useState(false);
  const [only, setOnly] = useState<"surface" | "depth" | undefined>(undefined);

  // Deep links for screen-share: ?flow=flow-7 preloads a flow, ?present=1 opens
  // straight into presentation mode.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flowId = params.get("flow");
    if (flowId) setConfig((c) => ({ ...c, flowId }));
    if (params.get("present") === "1") setPresent(true);
    const stage = params.get("stage");
    if (stage === "surface" || stage === "depth") setOnly(stage);
    const coin = params.get("coin");
    if (coin === "USDC" || coin === "USDT" || coin === "both") setConfig((c) => ({ ...c, stablecoin: coin }));
    // QA hook: ?y=0.4 jumps to that fraction of the dive scroll (for previews).
    const y = params.get("y");
    if (y) {
      const f = Math.max(0, Math.min(1, parseFloat(y)));
      setTimeout(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, f * max);
      }, 450);
    }
  }, []);

  if (only) {
    return (
      <main className="relative">
        <FlowExperience config={config} only={only} />
      </main>
    );
  }

  if (present) {
    return (
      <main className="relative">
        <FlowExperience config={config} presentation />
        <button
          onClick={() => setPresent(false)}
          className="fixed right-4 top-4 z-50 rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
        >
          Exit present ✕
        </button>
      </main>
    );
  }

  return (
    <main className="relative">
      <ControlPanel config={config} onConfigChange={setConfig} onPresent={() => setPresent(true)} />
      <FlowExperience config={config} />
    </main>
  );
}
