"use client";
import { useEffect, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { ProposalDocument } from "@/flow-tool/proposal/ProposalDocument";
import { ControlPanel } from "@/components/ControlPanel";
import { defaultConfig } from "@/flow-tool/data";
import type { FlowConfig } from "@/flow-tool/data/schema";

export default function Page() {
  const [config, setConfig] = useState<FlowConfig>(() => defaultConfig("flow-1", "Your Client"));
  const [present, setPresent] = useState(false);
  const [proposal, setProposal] = useState(false);

  // Deep links for screen-share: ?flow=flow-7 preloads a flow, ?present=1 opens
  // straight into presentation mode, ?proposal=1 opens the proposal document.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flowId = params.get("flow");
    if (flowId) setConfig((c) => ({ ...c, flowId }));
    if (params.get("present") === "1") setPresent(true);
    if (params.get("proposal") === "1") setProposal(true);
  }, []);

  if (proposal) {
    return (
      <main className="relative">
        <ProposalDocument config={config} onExit={() => setProposal(false)} />
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
      <ControlPanel
        config={config}
        onConfigChange={setConfig}
        onPresent={() => setPresent(true)}
        onGenerateProposal={() => setProposal(true)}
      />
      <FlowExperience config={config} />
    </main>
  );
}
