"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Currency,
  Direction,
  Flow,
  FlowConfig,
  ProposalPricing,
  ProposalSetup,
  ProposalType,
  Stablecoin,
} from "@/flow-tool/data/schema";
import { getFlow, FLOWS } from "@/flow-tool/data";
import { clientFlowName, directionOptions } from "@/flow-tool/data/schema";
import { deleteTailoredFlow, listTailoredFlows } from "@/flow-tool/data/custom-flows";
import { NewTailoredFlowModal, TailoredFlowEditor } from "@/components/TailoredFlowEditor";
import { LogoDrop } from "@/components/LogoDrop";
import { TRACE_REPS, getRep } from "@/flow-tool/data/reps";
import type { IntakeAnswers } from "@/flow-tool/intake/questions";
import { resolve } from "@/flow-tool/intake/resolver";
import { createShareLink, isShareConfigured, updateShareLink } from "@/flow-tool/lib/share";
import { loadRepKey } from "@/flow-tool/lib/rep-session";
import { dominantColor, normalizeLogo } from "@/flow-tool/lib/logo";
import { downloadProposalPdf } from "@/flow-tool/lib/proposal";
import { defaultProposalDate, saveSetup } from "@/flow-tool/lib/setup";
import { CommandPalette, type PaletteAction } from "@/components/CommandPalette";
import { FlowLibrary, type StudioMode } from "@/components/FlowLibrary";
import { PricingEditor } from "@/components/PricingEditor";

// ─────────────────────────────────────────────────────────────────────────────
// Rep-side build rail (design handoff 3b structure + 3a ⌘K palette + 2b pricing
// editor). A 344px fixed left rail with a three-step stepper — Deal → Client →
// Present — over the untouched client-facing canvas. Everything the old panel
// did survives; it is only re-arranged into steps.
// ─────────────────────────────────────────────────────────────────────────────

const PROPOSAL_LABELS: Record<ProposalType, string> = {
  standard: "Standard",
  "brazil-market": "Brazil-market",
};

// Logo treatment for the dark canvas: Auto (decide), White/Mint (force recolor
// of a one-colour mark), Card (keep brand colours on a white chip).
type LogoTreatment = "auto" | "white" | "mint" | "card";

const COLLECTED: Currency[] = ["BRL"];
const DELIVERED: Currency[] = ["USD/EUR", "USD", "EUR"];
const STABLECOINS: { value: Stablecoin; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "USDC", label: "USDC" },
  { value: "USDT", label: "USDT" },
];

const STEPS = [
  { id: "deal", label: "Deal" },
  { id: "client", label: "Client" },
  { id: "present", label: "Present" },
] as const;

/** Does the selected flow move a stablecoin (so the coin choice is relevant)? */
function usesStablecoin(flowId: string): boolean {
  const flow = getFlow(flowId);
  return !!flow?.legs.some((l) => l.carries === "USDC/USDT" || l.convertsTo === "USDC/USDT");
}

// ── inline icons (DS: no emoji; Lucide-style 2px strokes) ───────────────────

function CheckIcon({ size = 13, strokeWidth = 3 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function PlusIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function PlayIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}
function ChevronIcon({ dir, size = 14 }: { dir: "left" | "right"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {dir === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}

export function ControlPanel({
  config,
  onConfigChange,
  onPresent,
  setup,
  onSetupChange,
  proposalFlows,
  onProposalFlowsChange,
  pricing,
  onPricingChange,
  includePricing = true,
  onIncludePricingChange,
  sandbox = false,
  onSandboxChange,
  editingCode = null,
  onSaved,
}: {
  config: FlowConfig;
  onConfigChange: (next: FlowConfig) => void;
  onPresent: () => void;
  setup?: ProposalSetup | null;
  onSetupChange?: (next: ProposalSetup) => void;
  proposalFlows?: { flowId: string; name: string }[];
  onProposalFlowsChange?: (next: { flowId: string; name: string }[]) => void;
  pricing: ProposalPricing;
  onPricingChange: (next: ProposalPricing) => void;
  /** Whether pricing rides into the client link. Off → the link is flow-only
   *  and the client view hides the Pricing tab. */
  includePricing?: boolean;
  onIncludePricingChange?: (v: boolean) => void;
  /** Sandbox mode: generated links are tagged and kept off the pipeline. */
  sandbox?: boolean;
  onSandboxChange?: (v: boolean) => void;
  /** Editing an existing proposal: its share code — enables Update-in-place. */
  editingCode?: string | null;
  /** Called after a successful save with the link code + the shipped config, so
   *  the builder can lock onto that link and persist the edits for re-editing. */
  onSaved?: (code: string, config: FlowConfig) => void;
}) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  // Editing an existing proposal: open on Present, where Update-in-place lives.
  useEffect(() => {
    if (editingCode) setStep(2);
  }, [editingCode]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [studio, setStudio] = useState<StudioMode | null>(null); // flow studio overlay
  // Tailored flows (design §4/§6): rep-built drafts from localStorage. Listing
  // them also registers them, so getFlow resolves drafts across the whole app.
  const [tailored, setTailored] = useState<Flow[]>([]);
  const [tailoredDraft, setTailoredDraft] = useState<Flow | null>(null); // editor open
  const [newTailored, setNewTailored] = useState(false); // fork-first modal
  useEffect(() => setTailored(listTailoredFlows()), []);
  const [answers, setAnswers] = useState<IntakeAnswers>({});
  const [share, setShare] = useState<{ status: "idle" | "loading" | "done" | "error"; url?: string; msg?: string; copied?: boolean }>({ status: "idle" });
  const [pdf, setPdf] = useState<"idle" | "working" | "error">("idle");
  // logo treatment for the dark canvas (recompute from the original each time)
  const [origLogo, setOrigLogo] = useState<string>();
  const [treatment, setTreatment] = useState<LogoTreatment>("auto");

  const flows = proposalFlows ?? [];
  const proposalType: ProposalType = setup?.proposalType ?? "standard";
  const proposalDate = setup?.date ?? defaultProposalDate();
  const traceRepId = setup?.traceRepId ?? TRACE_REPS[0]?.id;

  // ⌘K / ctrl+K toggles the palette anywhere on /build; Escape is handled by
  // the palette itself.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Edit the proposal setup in place (creating it from the live config if the
  // salesperson skipped the intro page), and persist it for this session.
  function patchSetup(p: Partial<ProposalSetup>) {
    const next: ProposalSetup = {
      proposalType,
      date: proposalDate,
      traceRepId,
      company: setup?.company ?? config.clientName,
      companyRep: setup?.companyRep ?? config.clientRep,
      companyLogoUrl: setup?.companyLogoUrl ?? config.clientLogoUrl,
      companyLogoPlate: setup?.companyLogoPlate ?? config.clientLogoPlate,
      ...p,
    };
    // A generated client link is a snapshot of the proposal at generation time.
    // Switching template type makes that link stale — drop it so the rail
    // offers to generate a fresh one instead of presenting the old proposal.
    if (p.proposalType && p.proposalType !== proposalType) setShare({ status: "idle" });
    onSetupChange?.(next);
    saveSetup(next);
  }

  function addCurrentFlow() {
    const f = getFlow(config.flowId);
    if (!f || flows.some((x) => x.flowId === f.id)) return;
    onProposalFlowsChange?.([...flows, { flowId: f.id, name: f.title }]);
  }
  function removeFlow(id: string) {
    onProposalFlowsChange?.(flows.filter((x) => x.flowId !== id));
  }

  // The flows that go into the deck: those explicitly added, else the live one.
  function proposalFlowList() {
    return flows.length
      ? flows
      : [{ flowId: config.flowId, name: getFlow(config.flowId)?.title ?? "Flow" }];
  }

  function buildShareConfig() {
    // Only flows that actually resolve ride into the link — a deck row whose
    // tailored draft was deleted, or an abandoned draft left on the canvas,
    // must never become the link's flow ("Unknown flow" / blank client view).
    const all = proposalFlowList();
    const list = all.filter((f) => !!getFlow(f.flowId));
    if (!list.length) list.push(...all); // degenerate: keep what we have
    const shareFlowId = list.some((f) => f.flowId === config.flowId)
      ? config.flowId
      : list[0]?.flowId ?? config.flowId;
    // Attach the closing contact card from the selected Trace rep so the shared
    // view actually shows "your contact" (the client link has no other source).
    const rep = getRep(traceRepId);
    const salesperson = rep
      ? { name: rep.name, title: rep.proposalTitle ?? rep.title, email: rep.email }
      : undefined;
    // Tailored flows ride inside the link's config (editor state stripped),
    // so the client view and its PDF resolve them like library flows.
    const customFlows = [...new Set(list.map((f) => f.flowId))]
      .map((id) => getFlow(id))
      .filter((f): f is Flow => !!f?.custom)
      // the " · tailored" marker is rep-side only — the client never sees it
      .map((f) => ({ ...f, title: clientFlowName(f.title), editor: undefined }));
    return {
      ...config,
      flowId: shareFlowId,
      variants: list.length > 1 ? list.map((f) => ({ ...f, name: clientFlowName(f.name) })) : undefined,
      customFlows: customFlows.length ? customFlows : undefined,
      proposalType,
      date: proposalDate,
      traceRepId,
      salesperson,
      // 2b pricing: the shared view's new renderer consumes the raw
      // ProposalPricing directly (legacy region/cards rows from pre-existing
      // links keep the old renderer). Omitted when the rep excludes pricing —
      // the client link then hides the Pricing tab entirely.
      pricing: includePricing ? pricing : undefined,
      // Sandbox links are tagged so the dashboard keeps them off the pipeline.
      sandbox: sandbox || undefined,
    } as unknown as FlowConfig;
  }

  // One save: persist edits (so re-editing keeps them), push them into the
  // client link (creating it the first time, updating it in place after), then
  // open the link in a new tab and copy it to the clipboard.
  async function saveFlow() {
    setShare({ status: "loading" });
    // Open the tab up-front (inside the click) so the pop-up isn't blocked
    // after the network await; we redirect it once we have the code.
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const cfg = buildShareConfig();
      let code = editingCode ?? null;
      if (code) await updateShareLink(code, cfg);
      else code = (await createShareLink(cfg)).code;
      const url = `${window.location.origin}/f/${code}`;
      onSaved?.(code, cfg as unknown as FlowConfig); // persist stash + lock the link for next save
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* clipboard may be blocked; the Copy button is the fallback */
      }
      if (win) win.location.href = url;
      else window.open(url, "_blank", "noopener");
      setShare({ status: "done", url, copied: true });
    } catch (err) {
      if (win) win.close();
      setShare({ status: "error", msg: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  async function downloadPdf() {
    setPdf("working");
    try {
      await downloadProposalPdf({
        proposalType,
        company: config.clientName,
        companyRep: config.clientRep,
        date: proposalDate,
        companyLogoUrl: config.clientLogoUrl,
        companyLogoPlate: config.clientLogoPlate,
        flows: proposalFlowList(),
        direction: config.direction,
        stablecoin: config.stablecoin,
        collected: config.collected,
        delivered: config.delivered,
        rep: getRep(traceRepId),
        pricing,
        nodeLabels: config.nodeLabels,
        nodeOrder: config.nodeOrder,
        laneLabels: config.laneLabels,
        heroSupport: config.heroSupport,
        platform: config.platform,
        brandColor: config.brandColor,
        assetAuth: { repKey: loadRepKey() ?? undefined },
      });
      setPdf("idle");
    } catch {
      setPdf("error");
      setTimeout(() => setPdf("idle"), 3000);
    }
  }

  const resolution = useMemo(() => resolve(answers, config.clientName), [answers, config.clientName]);

  function patch(p: Partial<FlowConfig>) {
    onConfigChange({ ...config, ...p });
  }

  function answer(qid: string, value: string) {
    const next = { ...answers, [qid]: value };
    setAnswers(next);
    const r = resolve(next, config.clientName);
    if (r.status === "exact" && r.config) {
      // keep client-facing fields, adopt the resolved flow + direction
      onConfigChange({ ...config, flowId: r.config.flowId, direction: r.config.direction });
    }
  }

  // Re-run the normalizer on the ORIGINAL upload with the chosen treatment, so
  // switching White/Mint/Card is reversible and never compounds.
  const pendingBrandColor = useRef<string | null>(null);
  // The original upload travels from /new (setup) so treatments stay editable
  // in the builder; worst case we re-treat the processed logo itself.
  async function applyTreatment(t: LogoTreatment, base = origLogo ?? setup?.companyLogoOriginal ?? config.clientLogoUrl) {
    if (!base) return;
    setTreatment(t);
    const r = await normalizeLogo(base, { mark: t === "card" ? "keep" : t });
    patch({
      clientLogoUrl: r.url,
      clientLogoPlate: t === "card" ? "light" : r.plate,
      ...(pendingBrandColor.current ? { brandColor: pendingBrandColor.current } : {}),
    });
  }

  // data URI (not blob:) so the logo travels with the shared link
  async function onLogoData(raw: string) {
    setOrigLogo(raw);
    // brand color for the platform frame, from the untouched upload
    const brand = await dominantColor(raw).catch(() => null);
    if (brand) pendingBrandColor.current = brand;
    await applyTreatment("auto", raw); // cut bg + auto-decide on insert
  }

  async function copyLink() {
    if (!share.url) return;
    await navigator.clipboard.writeText(share.url);
    setShare((s) => ({ ...s, copied: true }));
    setTimeout(() => setShare((s) => ({ ...s, copied: false })), 1600);
  }

  const paletteActions: PaletteAction[] = [
    { id: "add-flow", label: "Add current flow to proposal", icon: "plus", run: addCurrentFlow },
    { id: "studio-describe", label: "Describe the deal", icon: "plus", run: () => setStudio("describe") },
    { id: "studio-browse", label: "Browse all flows", icon: "plus", run: () => setStudio("browse") },
    {
      id: "save-flow",
      label: "Save flow",
      icon: "link",
      run: () => {
        setStep(2);
        setOpen(true);
        void saveFlow();
      },
    },
    { id: "present", label: "Present", icon: "play", run: onPresent },
  ];

  const palette = (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelectFlow={(flowId) => patch({ flowId })}
        actions={paletteActions}
      />
      <FlowLibrary
        open={studio !== null}
        initialMode={studio ?? "describe"}
        onClose={() => setStudio(null)}
        clientName={config.clientName}
        deck={flows}
        onDeckChange={(next) => onProposalFlowsChange?.(next)}
        previewId={config.flowId}
        onPreview={(flowId) => patch({ flowId })}
        answers={answers}
        onAnswer={answer}
        onResetAnswers={() => setAnswers({})}
        resolution={resolution}
      />
      {newTailored && (
        <NewTailoredFlowModal
          clientName={config.clientName}
          onCreate={(draft) => {
            setNewTailored(false);
            setTailoredDraft(draft);
          }}
          onClose={() => setNewTailored(false)}
        />
      )}
      {tailoredDraft && (
        <TailoredFlowEditor
          initial={tailoredDraft}
          config={config}
          onSave={(saved) => {
            setTailored(listTailoredFlows());
            setTailoredDraft(null);
            patch({ flowId: saved.id }); // put it on the canvas
          }}
          onClose={() => {
            setTailored(listTailoredFlows()); // autosaved drafts survive close
            setTailoredDraft(null);
          }}
        />
      )}
    </>
  );

  if (!open) {
    return (
      <>
        {palette}
        <button
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-50 flex items-center gap-2 rounded-lg border border-hairline-card bg-[#0c110f]/90 px-3 py-2 text-sm font-semibold text-title backdrop-blur transition duration-150 ease-ds hover:border-hairline-control"
        >
          Trace Flow
          <span className="text-muted">
            <ChevronIcon dir="right" />
          </span>
        </button>
      </>
    );
  }

  return (
    <>
      {palette}
      <div className="fixed inset-y-0 left-0 z-50 flex w-[344px] max-w-[calc(100vw-2rem)] flex-col border-r border-hairline-row bg-[#090d0b]/[.96] backdrop-blur">
        {/* header */}
        <div className="flex items-center gap-2 px-5 pb-4 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/trace_logo.png" alt="" className="h-[19px] w-auto shrink-0" />
          <span className="min-w-0 flex-1 truncate font-display text-[13.5px] font-semibold tracking-[-0.01em] text-title">
            Building for {config.clientName.trim() || "your client"}
          </span>
          <button
            onClick={() => setPaletteOpen(true)}
            title="Command palette (⌘K)"
            className="shrink-0 rounded-md border border-hairline-control px-2 py-1 font-mono text-[10.5px] font-medium text-[#8b948f] transition duration-150 ease-ds hover:text-title"
          >
            ⌘K
          </button>
          <button
            onClick={onPresent}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-mint px-2.5 py-1.5 text-xs font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover active:bg-mint-press"
          >
            <PlayIcon />
            Present
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Collapse panel"
            className="shrink-0 rounded-md p-1 text-muted transition duration-150 ease-ds hover:text-title"
          >
            <ChevronIcon dir="left" />
          </button>
        </div>

        {/* sandbox mode — tag generated links so they stay off the pipeline */}
        {onSandboxChange && (
          <button
            onClick={() => onSandboxChange(!sandbox)}
            aria-pressed={sandbox}
            className={`mx-5 mb-4 flex items-center gap-2.5 rounded-[10px] border px-3 py-2 text-left transition duration-150 ease-ds ${
              sandbox
                ? "border-[#e6b566]/50 bg-[#241d10]"
                : "border-hairline-card bg-transparent hover:border-hairline-control"
            }`}
          >
            <span
              className={`relative h-[16px] w-[28px] shrink-0 rounded-full transition duration-150 ease-ds ${sandbox ? "bg-[#e6b566]" : "bg-hairline-control"}`}
            >
              <span
                className={`absolute top-[2px] h-[12px] w-[12px] rounded-full bg-[#0c110f] transition-all duration-150 ease-ds ${sandbox ? "left-[14px]" : "left-[2px]"}`}
              />
            </span>
            <span className="min-w-0">
              <span className={`block text-[11.5px] font-semibold ${sandbox ? "text-[#e6b566]" : "text-subtitle"}`}>
                Sandbox{sandbox ? " on" : ""}
              </span>
              <span className="block text-[10px] leading-snug text-muted">
                {sandbox ? "Links you generate stay off your pipeline." : "Experiment without touching your pipeline."}
              </span>
            </span>
          </button>
        )}

        {/* stepper */}
        <div className="flex items-center px-6 pb-5">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "upcoming";
            return (
              <div key={s.id} className="contents">
                {i > 0 && (
                  <span className={`mx-1.5 mb-[16px] h-[1.5px] flex-1 ${i <= step ? "bg-hairline-minted" : "bg-hairline-control"}`} />
                )}
                <button onClick={() => setStep(i)} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs transition duration-200 ease-ds ${
                      state === "done"
                        ? "border border-hairline-minted bg-status-viewedBg text-mint"
                        : state === "active"
                          ? "bg-mint font-bold text-mint-on"
                          : "border border-hairline-control bg-node-fill font-semibold text-muted"
                    }`}
                  >
                    {state === "done" ? <CheckIcon /> : i + 1}
                  </span>
                  <span
                    className={`text-[10px] ${
                      state === "active" ? "font-semibold text-[#bfe8d4]" : state === "done" ? "font-medium text-mint-muted" : "font-medium text-muted"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* step content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          {step === 0 && (
            <DealStep
              resolution={resolution}
              selectedFlowId={config.flowId}
              flows={flows}
              onAdd={addCurrentFlow}
              onRemove={removeFlow}
              onSelect={(flowId) => patch({ flowId })}
              onOpenStudio={setStudio}
              tailored={tailored}
              onNewTailored={() => setNewTailored(true)}
              onEditTailored={(f) => setTailoredDraft(f)}
              onUseTailored={(f) => patch({ flowId: f.id })}
              onDeleteTailored={(f) => {
                deleteTailoredFlow(f.id);
                setTailored(listTailoredFlows());
                // never leave a dangling reference: drop it from the deck and
                // move the canvas off it
                onProposalFlowsChange?.(flows.filter((x) => x.flowId !== f.id));
                if (config.flowId === f.id) {
                  const next = flows.find((x) => x.flowId !== f.id && getFlow(x.flowId))?.flowId ?? "flow-1";
                  patch({ flowId: next });
                }
              }}
            />
          )}

          {step === 1 && (
            <div>
              <StepTitle title="Who's the client?" sub="Shown on the deck. You can edit any of this later." />
              <div className="space-y-4">
                <Field label="Company">
                  <input
                    value={config.clientName}
                    onChange={(e) => patch({ clientName: e.target.value })}
                    className="w-full rounded-[9px] border border-hairline-control bg-surface-input px-3 py-2.5 text-sm font-medium text-title outline-none transition duration-150 ease-ds focus:border-hairline-selected"
                  />
                </Field>

                <Field label="Point of contact">
                  <input
                    value={config.clientRep ?? ""}
                    onChange={(e) => patch({ clientRep: e.target.value })}
                    placeholder="e.g. Maria Silva, Head of Finance"
                    className="w-full rounded-[9px] border border-hairline-control bg-surface-input px-3 py-2.5 text-sm text-title outline-none transition duration-150 ease-ds placeholder:text-muted focus:border-hairline-selected"
                  />
                </Field>

                <Field label="Logo">
                  <LogoDrop compact hasLogo={!!config.clientLogoUrl} onImage={onLogoData} />
                </Field>

                <Field label="Role in the flow">
                  <Segmented
                    value={config.platform?.enabled ? "platform" : "party"}
                    options={[
                      { value: "party", label: "Party in the flow" },
                      { value: "platform", label: "Technology provider" },
                    ]}
                    onChange={(v) =>
                      patch({ platform: { ...(config.platform ?? {}), enabled: v === "platform" } })
                    }
                  />
                  {config.platform?.enabled && (
                    <div className="mt-2 flex items-center gap-2.5">
                      <input
                        type="color"
                        value={config.platform.color ?? config.brandColor ?? "#00f2b1"}
                        onChange={(e) => patch({ platform: { ...(config.platform ?? { enabled: true }), enabled: true, color: e.target.value } })}
                        aria-label="Platform frame color"
                        className="h-7 w-9 shrink-0 cursor-pointer rounded-[6px] border border-hairline-control bg-surface-input p-[2px]"
                      />
                      <p className="text-[10.5px] leading-normal text-muted">
                        {config.clientName || "The client"} wraps the flow instead of appearing in it. The deck frames every
                        flow in their brand; the caption on the canvas is double-click editable.
                      </p>
                    </div>
                  )}
                </Field>

                {config.clientLogoUrl && (
                  <Field label="Logo on dark">
                    <div
                      className={`mb-2 flex h-11 items-center justify-center rounded-lg px-3 ${config.clientLogoPlate === "light" ? "bg-white" : ""}`}
                      style={config.clientLogoPlate === "light" ? undefined : { background: "radial-gradient(70% 70% at 50% 50%, #15392d 0%, #0b1714 75%)" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={config.clientLogoUrl} alt="logo preview" className="h-8 w-auto max-w-[160px] object-contain" />
                    </div>
                    <Segmented
                      value={treatment}
                      options={[
                        { value: "auto", label: "Auto" },
                        { value: "white", label: "White" },
                        { value: "mint", label: "Mint" },
                        { value: "card", label: "Card" },
                      ]}
                      onChange={(t) => void applyTreatment(t)}
                    />
                    <p className="mt-1.5 text-[10.5px] leading-snug text-muted">
                      Background removed automatically. White/Mint repaint a one-colour mark to read on dark; Card keeps brand colours on a white chip.
                    </p>
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Collected">
                    <Select value={config.collected} options={COLLECTED} onChange={(v) => patch({ collected: v as Currency })} />
                  </Field>
                  <Field label="Delivered">
                    <Select value={config.delivered} options={DELIVERED} onChange={(v) => patch({ delivered: v as Currency })} />
                  </Field>
                </div>

                <Field label="Direction">
                  <Segmented
                    value={config.direction}
                    options={directionOptions(config, config.flowId)}
                    onChange={(d) => patch({ direction: d })}
                  />
                  <div className="mt-2">
                    <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">The offer includes</div>
                    <Segmented
                      value={config.clientDirections ?? "both"}
                      options={[
                        { value: "both", label: "Both" },
                        ...directionOptions(config, config.flowId).map((o) => ({ value: o.value, label: `${o.label} only` })),
                      ]}
                      onChange={(v) =>
                        patch({
                          clientDirections: v === "both" ? undefined : (v as Direction),
                          ...(v !== "both" ? { direction: v as Direction } : {}),
                        })
                      }
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-[9px] border border-hairline-control bg-surface-input px-3 py-2">
                    <span className="text-[11px] text-muted">Swap which side is Pay-in / Pay-out</span>
                    <button
                      role="switch"
                      aria-checked={!!config.swapDirections?.[config.flowId]}
                      aria-label="Swap which side is Pay-in / Pay-out"
                      onClick={() => {
                        const cur = { ...(config.swapDirections ?? {}) };
                        if (cur[config.flowId]) delete cur[config.flowId];
                        else cur[config.flowId] = true;
                        patch({ swapDirections: Object.keys(cur).length ? cur : undefined });
                      }}
                      className="relative h-[18px] w-[32px] shrink-0 rounded-full transition duration-150 ease-ds"
                      style={{ background: config.swapDirections?.[config.flowId] ? "#00f2b1" : "#2a332e" }}
                    >
                      <span
                        className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all duration-150 ease-ds"
                        style={{ left: config.swapDirections?.[config.flowId] ? 16 : 2 }}
                      />
                    </button>
                  </div>
                  {(config.clientDirections ?? "both") === "both" && (
                    <div className="mt-2 flex items-center justify-between rounded-[9px] border border-hairline-control bg-surface-input px-3 py-2">
                      <span className="text-[11px] text-muted">Client can flip Pay-in / Pay-out</span>
                      <button
                        role="switch"
                        aria-checked={!config.hideDirectionToggle}
                        aria-label="Client can flip Pay-in / Pay-out"
                        onClick={() => patch({ hideDirectionToggle: config.hideDirectionToggle ? undefined : true })}
                        className="relative h-[18px] w-[32px] shrink-0 rounded-full transition duration-150 ease-ds"
                        style={{ background: config.hideDirectionToggle ? "#2a332e" : "#00f2b1" }}
                      >
                        <span
                          className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all duration-150 ease-ds"
                          style={{ left: config.hideDirectionToggle ? 2 : 16 }}
                        />
                      </button>
                    </div>
                  )}
                </Field>

                {usesStablecoin(config.flowId) && (
                  <Field label="Stablecoin">
                    <Segmented
                      value={config.stablecoin}
                      options={STABLECOINS}
                      onChange={(s) => patch({ stablecoin: s })}
                    />
                  </Field>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <StepTitle title="Present and share" sub="Template, your contact slide, and the rates the client sees." />
              <div className="space-y-4">
                <Field label="Proposal template">
                  <Segmented
                    value={proposalType}
                    options={(["standard", "brazil-market"] as ProposalType[]).map((t) => ({ value: t, label: PROPOSAL_LABELS[t] }))}
                    onChange={(t) => patchSetup({ proposalType: t })}
                  />
                </Field>

                <Field label="Trace representative">
                  <select
                    value={traceRepId}
                    onChange={(e) => patchSetup({ traceRepId: e.target.value })}
                    className="w-full rounded-[9px] border border-hairline-control bg-surface-input px-3 py-2.5 text-sm text-title outline-none transition duration-150 ease-ds focus:border-hairline-selected"
                  >
                    {TRACE_REPS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="flex items-center justify-between rounded-[9px] border border-hairline-control bg-surface-input px-3 py-2">
                  <span className="text-[11px] text-muted">Include pricing in the client link</span>
                  <button
                    role="switch"
                    aria-checked={includePricing}
                    aria-label="Include pricing in the client link"
                    onClick={() => onIncludePricingChange?.(!includePricing)}
                    className="relative h-[18px] w-[32px] shrink-0 rounded-full transition duration-150 ease-ds"
                    style={{ background: includePricing ? "#00f2b1" : "#2a332e" }}
                  >
                    <span
                      className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all duration-150 ease-ds"
                      style={{ left: includePricing ? 16 : 2 }}
                    />
                  </button>
                </div>
                {includePricing ? (
                  <PricingEditor pricing={pricing} onChange={onPricingChange} proposalType={proposalType} />
                ) : (
                  <p className="text-[11px] leading-snug text-muted">
                    The client link will show the flow only — no Pricing tab.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="border-t border-hairline-row px-5 pb-5 pt-3.5">
          <p className="mb-3 text-[11px] leading-snug text-[#5c6b65]">The client sees only this canvas. The rail is yours.</p>

          {step < 2 ? (
            <div className="flex gap-2">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="rounded-[10px] border border-hairline-control px-3.5 py-2.5 text-[13px] font-semibold text-[#8b948f] transition duration-150 ease-ds enabled:hover:text-title disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={() => setStep((s) => Math.min(2, s + 1))}
                className="flex-1 rounded-[10px] bg-mint px-3 py-2.5 text-[13px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover active:bg-mint-press"
              >
                {step === 1 ? "Continue to Present →" : "Continue →"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-[10px] border border-hairline-control px-3.5 py-2.5 text-[13px] font-semibold text-[#8b948f] transition duration-150 ease-ds hover:text-title"
                >
                  Back
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={pdf === "working"}
                  className="flex-1 rounded-[10px] bg-mint px-3 py-2.5 text-[13px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover active:bg-mint-press disabled:opacity-60"
                >
                  {pdf === "working" ? "Building proposal…" : pdf === "error" ? "Try again" : "Download proposal PDF"}
                </button>
              </div>

              {isShareConfigured() ? (
                <>
                  <button
                    onClick={saveFlow}
                    disabled={share.status === "loading"}
                    className="w-full rounded-[10px] bg-mint px-3 py-2.5 text-[13px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover disabled:opacity-60"
                  >
                    {share.status === "loading" ? "Saving…" : "Save flow"}
                  </button>
                  <p className="text-[10px] leading-snug text-muted">
                    Saves your edits, updates the client link{editingCode ? "" : " (creates it the first time)"}, then opens it and copies it to your clipboard.
                  </p>
                  {share.status === "done" && share.url && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          readOnly
                          value={share.url}
                          onFocus={(e) => e.target.select()}
                          className="w-full rounded-md border border-hairline-control bg-surface-input px-2 py-1.5 font-mono text-[11px] text-subtitle outline-none"
                        />
                        <button
                          onClick={copyLink}
                          className="shrink-0 rounded-md bg-mint px-2.5 py-1.5 text-xs font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover"
                        >
                          {share.copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className={`text-[10px] leading-snug ${sandbox ? "text-[#e6b566]" : "text-mint-muted"}`}>
                        {sandbox
                          ? "Saved · opened · copied. Sandbox link: works like the real thing but stays off your pipeline."
                          : "Saved · opened in a new tab · copied to your clipboard."}
                      </p>
                    </div>
                  )}
                  {share.status === "error" && <p className="text-[11px] text-status-draftFg">{share.msg}</p>}
                </>
              ) : (
                <p className="text-[11px] leading-snug text-muted">
                  Client links need <code className="font-mono text-subtitle">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. The PDF works without it.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Step 1: Deal — intake / manual picker + the proposal-flow stack ──────────

// The Deal step is a launcher into the Flow Studio (design 3c): the rail stays
// lean; describing the deal and browsing the library happen in the dedicated
// full-screen space. Here: the two entry points, what's on canvas, and the deck.
function DealStep({
  resolution,
  selectedFlowId,
  flows,
  onAdd,
  onRemove,
  onSelect,
  onOpenStudio,
  tailored,
  onNewTailored,
  onEditTailored,
  onUseTailored,
  onDeleteTailored,
}: {
  resolution: ReturnType<typeof resolve>;
  selectedFlowId: string;
  flows: { flowId: string; name: string }[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  /** Flip the canvas to a deck flow so it becomes the one being edited. */
  onSelect: (flowId: string) => void;
  onOpenStudio: (mode: StudioMode) => void;
  tailored: Flow[];
  onNewTailored: () => void;
  onEditTailored: (f: Flow) => void;
  onUseTailored: (f: Flow) => void;
  onDeleteTailored: (f: Flow) => void;
}) {
  const added = flows.some((x) => x.flowId === selectedFlowId);
  const current = getFlow(selectedFlowId);
  return (
    <div>
      <StepTitle title="What's the deal?" sub="Answer a few plain questions and the right flow resolves itself." />

      <button
        onClick={() => onOpenStudio("describe")}
        className="flex w-full items-center justify-between rounded-xl bg-mint px-4 py-3.5 text-left transition duration-150 ease-ds hover:bg-mint-hover"
      >
        <span>
          <span className="block text-[13.5px] font-semibold text-mint-on">Describe the deal</span>
          <span className="block text-[11px] text-mint-on/70">Plain-language questions, resolved live</span>
        </span>
        <span className="font-mono text-[13px] text-mint-on">&rarr;</span>
      </button>
      <button
        onClick={() => onOpenStudio("browse")}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-hairline-control px-4 py-3 text-left transition duration-150 ease-ds hover:border-mint/40"
      >
        <span className="text-[12.5px] font-medium text-subtitle">Browse all flows</span>
        <span className="font-mono text-[12px] text-muted">{FLOWS.length}</span>
      </button>
      <button
        onClick={onNewTailored}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-hairline-control px-4 py-3 text-left transition duration-150 ease-ds hover:border-mint/40"
      >
        <span>
          <span className="block text-[12.5px] font-medium text-subtitle">Tailored flow</span>
          <span className="block text-[10.5px] text-muted">Build a client-specific diagram from scratch</span>
        </span>
        <span className="font-mono text-[13px] text-muted">＋</span>
      </button>

      {tailored.length > 0 && (
        <div className="mt-3 rounded-xl border border-hairline-card bg-node-fill/40 p-3">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[.1em] text-mint-muted">
            Your tailored flows · {tailored.length}
          </span>
          <div className="mt-2 space-y-1.5">
            {tailored.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <button
                  onClick={() => onUseTailored(f)}
                  title="Put on canvas"
                  className={`min-w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-left text-[11.5px] transition duration-150 ease-ds ${
                    selectedFlowId === f.id
                      ? "border-hairline-selected text-mint"
                      : "border-hairline-control text-title hover:border-mint/40"
                  }`}
                >
                  {f.title}
                </button>
                <button
                  onClick={() => onEditTailored(f)}
                  aria-label={`Edit ${f.title}`}
                  className="shrink-0 rounded-md border border-hairline-control px-2 py-1.5 text-[11px] text-[#8b948f] transition hover:text-title"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDeleteTailored(f)}
                  aria-label={`Delete ${f.title}`}
                  className="shrink-0 rounded-md px-1 py-1.5 text-muted transition hover:text-title"
                >
                  <XIcon size={9} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* what's on the canvas right now */}
      <div className="mt-4 rounded-xl border border-hairline-card bg-node-fill/40 p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-[.1em] text-mint-muted">On canvas</span>
          {resolution.status === "exact" && (
            <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wide text-mint">
              <CheckIcon size={9} /> resolved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-hairline-control px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-mint">
            {current?.displayId ?? "?"}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-title">{current?.title ?? selectedFlowId}</span>
          {current?.custom && (
            <button
              onClick={() => current && onEditTailored(current)}
              aria-label={`Edit ${current.title}`}
              className="shrink-0 rounded-md border border-hairline-control px-2 py-1 text-[11px] text-[#8b948f] transition hover:text-title"
            >
              Edit
            </button>
          )}
          <button
            onClick={onAdd}
            disabled={added}
            className="flex shrink-0 items-center gap-1 rounded-md bg-mint px-2.5 py-1 text-[11px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover disabled:cursor-default disabled:bg-status-viewedBg disabled:text-mint"
          >
            {added ? (
              <>
                <CheckIcon size={10} /> In deck
              </>
            ) : (
              <>
                <PlusIcon size={10} /> Add to deck
              </>
            )}
          </button>
        </div>
      </div>

      {/* the deck so far */}
      <div className="mt-3 rounded-xl border border-hairline-card bg-node-fill/40 p-3">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[.1em] text-mint-muted">
          The deck{flows.length ? ` \u00b7 ${flows.length}` : ""}
        </span>
        {flows.length === 0 ? (
          <p className="mt-1.5 text-[10.5px] leading-snug text-muted">
            Empty deck presents just the flow on canvas. Add flows to stack several.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-[10.5px] leading-snug text-muted">Click a flow to edit it on the canvas.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {flows.map((f, i) => {
                const resolves = !!getFlow(f.flowId);
                const active = f.flowId === selectedFlowId;
                return (
                  <span
                    key={f.flowId}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition duration-150 ease-ds ${
                      active
                        ? "border-hairline-selected bg-node-fill text-mint"
                        : "border-hairline-control bg-node-fill text-title"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-mint">{i + 1}</span>
                    <button
                      onClick={() => resolves && onSelect(f.flowId)}
                      disabled={!resolves}
                      title={resolves ? "Edit this flow on the canvas" : "This flow can't be resolved"}
                      className={`max-w-[140px] truncate text-left transition ${
                        active ? "font-semibold" : resolves ? "hover:text-mint" : "text-muted line-through"
                      }`}
                    >
                      {f.name}
                    </button>
                    <button onClick={() => onRemove(f.flowId)} aria-label={`Remove ${f.name}`} className="text-muted transition hover:text-title">
                      <XIcon size={9} />
                    </button>
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <div className="font-display text-[17px] font-semibold tracking-[-0.01em] text-title">{title}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-[#8b948f]">{label}</label>
      {children}
    </div>
  );
}

/** DS segmented control: active = solid mint + dark text, inactive transparent. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="grid gap-[3px] rounded-[10px] border border-hairline-card bg-surface-input p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[7px] px-1.5 py-[7px] text-xs transition duration-150 ease-ds ${
            value === o.value ? "bg-mint font-semibold text-mint-on" : "font-medium text-[#8b948f] hover:text-title"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Select({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[9px] border border-hairline-control bg-surface-input px-3 py-2.5 text-sm text-title outline-none transition duration-150 ease-ds focus:border-hairline-selected"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
