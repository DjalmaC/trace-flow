"use client";
import { useEffect, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { ControlPanel } from "@/components/ControlPanel";
import { defaultConfig } from "@/flow-tool/data";
import type { FlowConfig, ProposalSetup } from "@/flow-tool/data/schema";
import { loadSetup } from "@/flow-tool/lib/setup";

export default function BuildPage() {
  const [config, setConfig] = useState<FlowConfig>(() => defaultConfig("flow-1", "Your Client"));
  const [present, setPresent] = useState(false);
  const [only, setOnly] = useState<"surface" | "depth" | undefined>(undefined);
  const [setup, setSetup] = useState<ProposalSetup | null>(null);
  // Flows the salesperson has added to the proposal deck (in order).
  const [proposalFlows, setProposalFlows] = useState<{ flowId: string; name: string }[]>([]);

  // Deep links for screen-share: ?flow=flow-7 preloads a flow, ?present=1 opens
  // straight into presentation mode.
  useEffect(() => {
    // Hydrate the salesperson-private setup from the intro page (/new).
    const s = loadSetup();
    if (s) {
      setSetup(s);
      setConfig((c) => ({
        ...c,
        clientName: s.company || c.clientName,
        clientRep: s.companyRep ?? c.clientRep,
        clientLogoUrl: s.companyLogoUrl ?? c.clientLogoUrl,
        clientLogoPlate: s.companyLogoPlate ?? c.clientLogoPlate,
      }));
    }
    const params = new URLSearchParams(window.location.search);
    const flowId = params.get("flow");
    if (flowId) setConfig((c) => ({ ...c, flowId }));
    if (params.get("present") === "1") setPresent(true);
    const stage = params.get("stage");
    if (stage === "surface" || stage === "depth") setOnly(stage);
    const coin = params.get("coin");
    if (coin === "USDC" || coin === "USDT" || coin === "both") setConfig((c) => ({ ...c, stablecoin: coin }));
    const d = params.get("dir");
    if (d === "collection" || d === "disbursement") setConfig((c) => ({ ...c, direction: d }));
    const dv = params.get("delivered");
    if (dv === "USD/EUR" || dv === "USD" || dv === "EUR") setConfig((c) => ({ ...c, delivered: dv }));
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

  const setDirection = (direction: typeof config.direction) => setConfig((c) => ({ ...c, direction }));

  if (present) {
    return (
      <main className="relative">
        <FlowExperience config={config} presentation onDirectionChange={setDirection} />
        <button
          onClick={() => setPresent(false)}
          className="fixed left-4 top-4 z-50 rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
        >
          ✕ Exit present
        </button>
      </main>
    );
  }

  return (
    <main className="relative">
      <ControlPanel
        config={config}
        onConfigChange={setConfig}
        onPresent={() => setPresent(true)}
        setup={setup}
        onSetupChange={setSetup}
        proposalFlows={proposalFlows}
        onProposalFlowsChange={setProposalFlows}
      />
      <a
        href="/"
        className="fixed bottom-4 left-4 z-50 rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
      >
        ← Proposals
      </a>
      <FlowExperience config={config} onDirectionChange={setDirection} />
    </main>
  );
}
