"use client";
import { useEffect, useRef, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { ControlPanel } from "@/components/ControlPanel";
import { defaultConfig, getFlow } from "@/flow-tool/data";
import { registerCustomFlows } from "@/flow-tool/data/custom-flows";
import { deckPricing, normalizePricing, type Flow, type FlowConfig, type ProposalPricing, type ProposalSetup } from "@/flow-tool/data/schema";
import { loadSetup } from "@/flow-tool/lib/setup";

/** Stash written by the dashboard's Edit action: the stored proposal's config
 *  plus its share code, so the rail can update the SAME link in place. */
interface EditStash {
  code: string;
  config: FlowConfig & {
    variants?: { flowId: string; name: string }[];
    customFlows?: Flow[];
    pricing?: unknown;
    proposalType?: "standard" | "brazil-market";
    date?: string;
    traceRepId?: string;
    sandbox?: boolean;
  };
}
const EDIT_STASH_KEY = "tf:edit-proposal";

export default function BuildPage() {
  const [config, setConfig] = useState<FlowConfig>(() => defaultConfig("flow-1", "Your Client"));
  const [present, setPresent] = useState(false);
  const [only, setOnly] = useState<"surface" | "depth" | undefined>(undefined);
  const [setup, setSetup] = useState<ProposalSetup | null>(null);
  // Flows the salesperson has added to the proposal deck (in order).
  const [proposalFlows, setProposalFlows] = useState<{ flowId: string; name: string }[]>([]);
  // Proposal pricing (2b): lives beside proposalFlows and rides into the share
  // config, so the client's Pricing view and the PDF show the rep's rates.
  const [pricing, setPricing] = useState<ProposalPricing>(() => deckPricing());
  // Sandbox mode: links generated while on are tagged and kept off the pipeline.
  const [sandbox, setSandbox] = useState(false);
  // Editing an existing proposal (dashboard → Edit): its share code.
  const [editingCode, setEditingCode] = useState<string | null>(null);
  // Double-click rename overlay for the flow boxes on the canvas.
  const [rename, setRename] = useState<{ key: string; original: string; value: string; left: number; top: number; width: number } | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // The deck's rate cards are proposal-type-specific (Standard prices two
  // components; Brazil-market prices five products), so switching type re-seeds
  // the pricing from that deck.
  const proposalType = setup?.proposalType ?? "standard";
  const hydratedRef = useRef(false);
  useEffect(() => {
    // skip the reseed when hydrating a stored proposal (its pricing wins)
    if (hydratedRef.current) {
      hydratedRef.current = false;
      return;
    }
    setPricing(deckPricing(proposalType));
  }, [proposalType]);

  // Deep links for screen-share: ?flow=flow-7 preloads a flow, ?present=1 opens
  // straight into presentation mode.
  useEffect(() => {
    // Editing an existing proposal takes precedence over the intro-page setup.
    const editParam = new URLSearchParams(window.location.search).get("edit");
    if (editParam) {
      try {
        const stash = JSON.parse(sessionStorage.getItem(EDIT_STASH_KEY) ?? "null") as EditStash | null;
        if (stash && stash.code === editParam) {
          const c = stash.config;
          registerCustomFlows(c.customFlows);
          hydratedRef.current = true;
          setEditingCode(stash.code);
          setConfig({
            ...defaultConfig(c.flowId, c.clientName),
            ...c,
            variants: undefined,
            customFlows: undefined,
            pricing: undefined,
          } as FlowConfig);
          setProposalFlows(c.variants ?? [{ flowId: c.flowId, name: getFlow(c.flowId)?.title ?? "Flow" }]);
          setPricing(normalizePricing(c.pricing, c.proposalType ?? "standard"));
          setSandbox(!!c.sandbox);
          setSetup({
            proposalType: c.proposalType ?? "standard",
            date: c.date ?? "",
            traceRepId: c.traceRepId,
            company: c.clientName,
            companyRep: c.clientRep,
            companyLogoUrl: c.clientLogoUrl,
            companyLogoPlate: c.clientLogoPlate,
          });
          return; // skip the /new setup hydration below
        }
      } catch {
        /* fall through to normal hydration */
      }
    }
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

  // ── double-click a flow box to rename it (this proposal only) ──
  function onCanvasDoubleClick(e: React.MouseEvent) {
    const el = (e.target as Element).closest?.("[data-flow-node]");
    const id = el?.getAttribute("data-flow-node");
    if (!el || !id) return;
    const key = `${config.flowId}:${id}`;
    const original = getFlow(config.flowId)?.nodes.find((n) => n.id === id)?.label ?? "";
    const r = el.getBoundingClientRect();
    setRename({
      key,
      original,
      value: config.nodeLabels?.[key] ?? original,
      left: r.left,
      top: r.top + r.height / 2 - 17,
      width: Math.max(r.width, 170),
    });
  }
  function commitRename() {
    if (!rename) return;
    const v = rename.value.trim();
    setConfig((c) => {
      const labels = { ...(c.nodeLabels ?? {}) };
      if (!v || v === rename.original) delete labels[rename.key]; // empty = back to the flow's own name
      else labels[rename.key] = v;
      return { ...c, nodeLabels: Object.keys(labels).length ? labels : undefined };
    });
    setRename(null);
  }
  const renameOverlay = rename && (
    <input
      ref={renameRef}
      autoFocus
      value={rename.value}
      onChange={(e) => setRename({ ...rename, value: e.target.value })}
      onFocus={(e) => e.target.select()}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitRename();
        else if (e.key === "Escape") setRename(null);
      }}
      aria-label="Rename flow box"
      className="fixed z-[80] rounded-lg border border-mint bg-[#0c110f] px-2.5 py-1.5 text-center text-[13px] font-semibold text-title shadow-xl outline-none"
      style={{ left: rename.left, top: rename.top, width: rename.width }}
    />
  );

  if (present) {
    return (
      <main className="relative" onDoubleClick={onCanvasDoubleClick}>
        <FlowExperience config={config} presentation onDirectionChange={setDirection} />
        {renameOverlay}
        <button
          onClick={() => setPresent(false)}
          className="fixed left-4 top-4 z-50 flex items-center gap-1.5 rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          Exit present
        </button>
      </main>
    );
  }

  return (
    <main className="relative" onDoubleClick={onCanvasDoubleClick}>
      <ControlPanel
        config={config}
        onConfigChange={setConfig}
        onPresent={() => setPresent(true)}
        setup={setup}
        onSetupChange={setSetup}
        proposalFlows={proposalFlows}
        onProposalFlowsChange={setProposalFlows}
        pricing={pricing}
        onPricingChange={setPricing}
        sandbox={sandbox}
        onSandboxChange={setSandbox}
        editingCode={editingCode}
      />
      {renameOverlay}
      {/* Sits UNDER the rail (z-40 < z-50): reachable when the rail is collapsed. */}
      <a
        href="/"
        className="fixed bottom-4 left-4 z-40 rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
      >
        ← Proposals
      </a>
      <FlowExperience config={config} onDirectionChange={setDirection} />
    </main>
  );
}
