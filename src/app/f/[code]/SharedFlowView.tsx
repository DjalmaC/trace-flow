"use client";
import { useEffect, useState, type FormEvent } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { FlowExperience, useIsMobile } from "@/flow-tool/components/FlowExperience";
import { GlassPanel, SilkBackdrop } from "@/flow-tool/components/Glass";
import { NotesDrawer } from "@/components/NotesDrawer";
import { ASSETS, C, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { loadSharedFlowGated } from "@/flow-tool/lib/share";
import { getRep } from "@/flow-tool/data/reps";
import { clientFlowName, deckPricing, directionOptions, flatRowText, normalizePricing, tierText } from "@/flow-tool/data/schema";
import type { Direction, Flow, FlowConfig, PriceCard, ProposalPricing, ProposalType } from "@/flow-tool/data/schema";
import { registerCustomFlows } from "@/flow-tool/data/custom-flows";
import { getFlow } from "@/flow-tool/data";

// A shared link may carry more than one flow "variant" (e.g. a With-IP
// vs Direct structures). The viewer switches between them with a
// toggle that sits alongside the Pay-in / Pay-out control.
type Variant = { flowId: string; name: string };
// `proposalUrl` (optional) points to a curated proposal PDF to serve on
// "Download Proposal"; without it we fall back to the live-generated deck.
// `pricing` (optional) drives the native Pricing tab. New links carry a
// ProposalPricing (design handoff 2a/2b); older rows (e.g. the live ARQ link)
// carry the legacy region/cards/rows shape, which keeps its original renderer.
type PriceRow = { label: string; value: string };
type LegacyCard = { badge: string; tone?: "green" | "cyan"; title: string; sub?: string; rows: PriceRow[] };
type LegacyPricing = { region: string; flag?: string; subtitle?: string; cards: LegacyCard[]; footer?: string };
// `salesperson` (optional) renders the closing "last deck" of the proposal.
type Salesperson = { name: string; title?: string; email?: string; phone?: string; photo?: string; bio?: string; bookingUrl?: string };
// `proposalType`/`date`/`traceRepId` (optional, set by the proposal generator)
// let "Download Proposal" assemble the full templated PDF on the fly.
type SharedConfig = FlowConfig & {
  variants?: Variant[];
  proposalUrl?: string;
  pricing?: ProposalPricing | LegacyPricing;
  salesperson?: Salesperson;
  proposalType?: ProposalType;
  date?: string;
  traceRepId?: string;
  /** Tailored flows this link uses (plain Flow objects, editor state stripped). */
  customFlows?: Flow[];
};

// A shared row is only writable by an authenticated rep, but it's still
// attacker-shaped data rendered on our own origin, so every URL that becomes an
// href/src is scheme-checked. javascript: and other odd schemes are dropped.
function safeSrc(url?: string): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  return /^data:image\//i.test(u) || /^https:\/\//i.test(u) || u.startsWith("/") ? u : undefined;
}
function safeLink(url?: string): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  return /^https:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u) ? u : undefined;
}
// Curated "Download Proposal" target. Legacy /proposals/*.pdf rows are rewritten
// to the gated asset route, carrying the client's own share code as the key.
function resolveProposalHref(url: string, code: string): string | null {
  const u = url.trim();
  const legacy = u.match(/^\/proposals\/([\w.-]+\.pdf)$/i);
  if (legacy) return `/api/asset/${legacy[1]}?code=${encodeURIComponent(code)}`;
  if (u.startsWith("/api/asset/")) return u.includes("?") ? u : `${u}?code=${encodeURIComponent(code)}`;
  if (/^data:application\/pdf/i.test(u) || /^https:\/\//i.test(u) || u.startsWith("/")) return u;
  return null;
}

// Old rows store pricing as region/cards (no mode); newer rows store
// ProposalPricing — either the legacy pix/spread pair or the card model.
// normalizePricing upgrades both stored ProposalPricing shapes.
function isLegacyPricing(p: ProposalPricing | LegacyPricing): p is LegacyPricing {
  return Array.isArray((p as LegacyPricing).cards) && !("mode" in p);
}
function isProposalPricing(p: ProposalPricing | LegacyPricing): p is ProposalPricing {
  const c = p as ProposalPricing & { pix?: unknown; spread?: unknown };
  if (c.pix && typeof c.pix === "object" && c.spread && typeof c.spread === "object") return true;
  return "mode" in c && Array.isArray(c.cards);
}

type State =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "unconfigured" }
  | { status: "expired" }
  // gate present; `wrong` marks a failed password attempt (2c client gate)
  | { status: "locked"; wrong?: boolean }
  | { status: "error"; msg: string }
  | { status: "ready"; config: SharedConfig };

// intro choreography after a private link opens:
//   loading → welcome (held) → fadeout → done. On fadeout the client logo
//   "magic-moves" (layoutId) from the centred welcome to its header slot, while
//   the welcome backdrop + text fade and the flow is revealed underneath.
type Intro = "loading" | "welcome" | "fadeout" | "done";
const MIN_LOAD_MS = 1500;
const WELCOME_HOLD_MS = 2300;
const FADE_MS = 950;

// 3px brand strip (design 1c): mint→cyan gradient, full width. FlowExperience
// paints its own solid rule; this overlay sits above it (z-60) so the client
// page reads gradient without touching FlowExperience internals.
const STRIP_GRADIENT = "linear-gradient(90deg,#2be8d6,#00f2b1)";

export function SharedFlowView({ code }: { code: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [intro, setIntro] = useState<Intro>("loading");
  const [direction, setDirection] = useState<Direction>("collection");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<"idle" | "working" | "error">("idle");
  const [view, setView] = useState<"flow" | "pricing">("flow"); // Flow | Pricing tab
  // Desktop header banner: rides in-flow at the top, then sticks and
  // compresses into a frosted strip once the page scrolls.
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const on = () => setStuck(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const config = state.status === "ready" ? state.config : null;
  const variants = config?.variants;
  const flowId = activeFlowId ?? config?.flowId ?? "";
  const repName = config?.clientRep?.split(",")[0]?.trim();

  // Switching flows re-renders the machinery panel, and some engines (Safari)
  // clamp the scroll position while its height settles. Picking a flow keeps
  // the viewer where they are when they're ABOVE the machinery (the canvas
  // updates in place), and preserves their relative depth when they're inside
  // it — offset by the panel's scroll margin so the sticky banner never cuts
  // the heading.
  function switchFlow(id: string) {
    const sec = document.querySelector("[data-flow-dive]");
    const before = sec
      ? (window.scrollY - (sec.getBoundingClientRect().top + window.scrollY)) / Math.max(1, (sec as HTMLElement).offsetHeight)
      : null;
    setActiveFlowId(id);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const s = document.querySelector("[data-flow-dive]");
        if (!s || before == null || before < 0) return; // above the panel — stay put
        const el = s as HTMLElement;
        const top = el.getBoundingClientRect().top + window.scrollY;
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        const frac = before >= 0.98 ? 0.62 : before;
        window.scrollTo({ top: Math.max(0, top - margin + frac * el.offsetHeight), behavior: "auto" });
      }),
    );
  }

  // "Download Proposal", in order of preference:
  //   1. a curated proposal PDF attached to the link (proposalUrl),
  //   2. the full templated proposal assembled on the fly (proposalType),
  //   3. the live-generated flow deck (title slide + one per flow).
  async function onProposal() {
    if (!config) return;
    if (config.proposalUrl) {
      const href = resolveProposalHref(config.proposalUrl, code);
      if (!href) {
        setPdf("error");
        setTimeout(() => setPdf("idle"), 3000);
        return;
      }
      const a = document.createElement("a");
      a.href = href;
      a.download = `Trace Finance - ${config.clientName} - Proposal.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    setPdf("working");
    try {
      if (config.proposalType) {
        const { downloadProposalPdf } = await import("@/flow-tool/lib/proposal");
        await downloadProposalPdf({
          proposalType: config.proposalType,
          company: config.clientName,
          companyRep: config.clientRep,
          date: config.date ?? "",
          companyLogoUrl: config.clientLogoUrl,
          companyLogoPlate: config.clientLogoPlate,
          flows: variants ?? [{ flowId, name: "Flow" }],
          direction,
          stablecoin: config.stablecoin,
          collected: config.collected,
          delivered: config.delivered,
          rep: getRep(config.traceRepId),
          pricing: config.pricing && isProposalPricing(config.pricing) ? config.pricing : undefined,
          nodeLabels: config.nodeLabels,
          nodeOrder: config.nodeOrder,
          laneLabels: config.laneLabels,
          heroSupport: config.heroSupport,
          platform: config.platform,
          brandColor: config.brandColor,
          assetAuth: { code },
        });
      } else {
        const { variants: _v, proposalUrl: _p, ...base } = config;
        const { downloadFlowDeckPdf } = await import("@/flow-tool/lib/pptx");
        await downloadFlowDeckPdf({ ...base, direction }, variants);
      }
      setPdf("idle");
    } catch {
      setPdf("error");
      setTimeout(() => setPdf("idle"), 3000);
    }
  }

  function applyLoaded(loaded: SharedConfig) {
    // Tailored flows travel inside the link's config; registering them lets
    // getFlow resolve them everywhere (deck render + PDF export) exactly like
    // library flows.
    registerCustomFlows(loaded.customFlows);
    // single-direction offers lock the link to that direction
    setDirection(
      loaded.clientDirections && loaded.clientDirections !== "both" ? loaded.clientDirections : loaded.direction,
    );
    // Older links can carry a dangling flowId (an abandoned draft that never
    // shipped inside customFlows). Show the first flow that actually resolves
    // rather than a blank "Unknown flow" page.
    const candidates = [loaded.flowId, ...(loaded.variants ?? []).map((v) => v.flowId), ...(loaded.customFlows ?? []).map((f) => f.id)];
    setActiveFlowId(candidates.find((id) => !!getFlow(id)) ?? loaded.variants?.[0]?.flowId ?? loaded.flowId);
    setState({ status: "ready", config: loaded });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // hold the loading screen a beat so it reads, even on a fast fetch
        const [res] = await Promise.all([
          loadSharedFlowGated(code),
          new Promise((r) => setTimeout(r, MIN_LOAD_MS)),
        ]);
        if (cancelled) return;
        if (res.status === "ok") applyLoaded(res.config as SharedConfig);
        else if (res.status === "expired") setState({ status: "expired" });
        // wrong-password without an attempt just means "gated" — show the gate
        else if (res.status === "locked" || res.status === "wrong-password") setState({ status: "locked" });
        else setState({ status: "notfound" });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Could not load this flow.";
        if (msg.includes("not configured")) setState({ status: "unconfigured" });
        else setState({ status: "error", msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // 2c client gate — retry the read with the supplied password.
  async function submitPassword(pw: string) {
    try {
      const res = await loadSharedFlowGated(code, pw);
      if (res.status === "ok") applyLoaded(res.config as SharedConfig);
      else if (res.status === "expired") setState({ status: "expired" });
      else if (res.status === "notfound") setState({ status: "notfound" });
      else setState({ status: "locked", wrong: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load this flow.";
      if (msg.includes("not configured")) setState({ status: "unconfigured" });
      else setState({ status: "error", msg });
    }
  }

  // deep-link straight to pricing with ?view=pricing: the mobile tab switches;
  // the desktop panel layout scrolls the rail into view once the intro settles.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "pricing") setView("pricing");
  }, []);
  useEffect(() => {
    if (intro !== "done" || window.matchMedia("(max-width: 767px)").matches) return;
    if (new URLSearchParams(window.location.search).get("view") === "pricing")
      document.querySelector(".tf-rail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [intro]);

  // once loaded, run the welcome → fadeout → done sequence
  useEffect(() => {
    if (state.status !== "ready") return;
    setIntro("welcome");
    const t1 = setTimeout(() => setIntro("fadeout"), WELCOME_HOLD_MS);
    const t2 = setTimeout(() => setIntro("done"), WELCOME_HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state.status]);

  const isMobile = useIsMobile();
  const hasVariants = !!variants && variants.length > 1;
  const showWelcomeLogo = intro === "welcome";
  const showChrome = intro === "fadeout" || intro === "done"; // header + downloads settle in

  // Pricing source (design 2a): the link's ProposalPricing when present, the
  // legacy card shape as-is when detected (keeps the live ARQ link rendering),
  // otherwise the deck defaults. Pricing is therefore always available.
  const legacyPricing = config?.pricing && isLegacyPricing(config.pricing) ? config.pricing : null;
  const proposalPricing: ProposalPricing =
    config?.pricing && !legacyPricing && isProposalPricing(config.pricing)
      ? normalizePricing(config.pricing, config.proposalType ?? "standard")
      : deckPricing(config?.proposalType ?? "standard");

  // the FlowConfig handed to the flow renderer (strip the proposal-only extras)
  const fxConfig: FlowConfig | null = config
    ? (() => {
        const { variants: _v, proposalUrl: _p, pricing: _pr, salesperson: _s, ...base } = config;
        return { ...base, flowId, direction };
      })()
    : null;

  const pricingEl = config
    ? legacyPricing
      ? <LegacyPricingView pricing={legacyPricing} inline={isMobile} />
      : <PricingView pricing={proposalPricing} clientName={config.clientName} inline={isMobile} />
    : null;

  // Only offer pricing when the link actually carries it. A link saved
  // without any rates is flow-only — no rail/tab, and a ?view=pricing deep
  // link falls back to the flow.
  const hasPricing = !!config?.pricing;
  const effView: "flow" | "pricing" = hasPricing ? view : "flow";
  const showDirectionToggle = !!config && !config.hideDirectionToggle && (config.clientDirections ?? "both") === "both";
  // Rail density: the side rail comfortably fits ~12 "rows" beside the canvas
  // (a card's header weighs about two). Anything denser — many tiers, many
  // products — takes its own full-width section below the canvas instead of
  // crowding or scrolling the rail. Side placement stays the default UX.
  const railRows = legacyPricing
    ? legacyPricing.cards.reduce((n, c) => n + c.rows.length + 2, 0)
    : proposalPricing.cards.reduce((n, c) => n + cardRows(c).length + 2, 0);
  const railBelow = railRows > 12;

  return (
    <LayoutGroup>
      {/* overflow-x:clip (not hidden) contains horizontal overflow WITHOUT
          making <main> a scroll container — `hidden` would promote overflow-y
          to auto and break the desktop scroll-dive's position:sticky. */}
      {/* No opaque background here — the fixed SilkBackdrop (-z-10) must show
          through; it carries the #07090b base under the silk plate itself. */}
      <main className="relative overflow-x-clip">
        {/* BRLT deck backdrop: silk plate + dark wash + top-right green glow */}
        <SilkBackdrop />
        {/* 1c: 3px mint→cyan strip, above FlowExperience's solid rule */}
        {(showChrome || state.status === "locked") && (
          <div
            aria-hidden
            className="no-print tf-fade pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]"
            style={{ background: STRIP_GRADIENT }}
          />
        )}

        {config && fxConfig && (
          isMobile ? (
            /* ── phone: sticky top bar + inline controls + vertical flow ── */
            <>
              <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07090b]/70 px-4 pb-2.5 pt-3 backdrop-blur-xl">
                {showChrome && (
                  <div className="tf-fade">
                    <div className="mb-2 font-jbmono text-[9.5px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
                      A Trace Finance Proposal
                    </div>
                    <div className="flex items-center gap-3">
                      <ClientLogo config={config} size="header" />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-sm font-semibold text-title">{config.clientName}</div>
                        {config.clientRep && <div className="truncate text-[11px] text-muted">Prepared for {config.clientRep}</div>}
                      </div>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {hasPricing && (
                        <SegToggle value={view} onChange={setView} options={[{ value: "flow", label: "Flow" }, { value: "pricing", label: "Pricing" }]} />
                      )}
                      {effView === "flow" && !config.hideDirectionToggle && (config.clientDirections ?? "both") === "both" && (
                        <SegToggle value={direction} onChange={setDirection} options={directionOptions(config, flowId)} />
                      )}
                      {effView === "flow" && hasVariants && (
                        <SegToggle full value={flowId} onChange={switchFlow} options={variants!.map((v) => ({ value: v.flowId, label: clientFlowName(v.name) }))} />
                      )}
                    </div>
                  </div>
                )}
              </header>

              {effView === "pricing" ? (
                pricingEl
              ) : (
                <>
                  <FlowExperience config={fxConfig} presentation skin="glass" onDirectionChange={config.hideDirectionToggle || (config.clientDirections ?? "both") !== "both" ? undefined : setDirection} />
                  <div className="relative flex flex-col gap-2 px-4 pb-10 pt-1">
                    <button
                      onClick={onProposal}
                      disabled={pdf === "working"}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-accent/40 bg-[#0e1410] px-5 py-3 text-sm font-semibold text-[#bfe8d4] transition duration-200 ease-ds hover:bg-[#13201a] disabled:opacity-60"
                    >
                      {pdf === "working" ? "Building deck…" : pdf === "error" ? "Try again" : "Download Proposal ↓"}
                    </button>
                  </div>
                  {config.salesperson && <SalespersonClosing sp={config.salesperson} company={config.clientName} />}
                </>
              )}
            </>
          ) : (
            /* ── desktop: the BRLT deck panel architecture — in-flow header,
                  canvas + pricing rail panel, machinery panel with the rep
                  row, footer logo. The flow diagrams and every interaction
                  render exactly as before; only the shell changed. ── */
            <>
              {/* header banner — eyebrow + client identity left, Trace right.
                  In-flow at the top of the page; once the page scrolls it
                  sticks under the brand strip and compresses into a frosted
                  glass band. */}
              <div
                className={`sticky top-0 z-40 flex flex-wrap justify-between gap-x-6 px-4 transition-all duration-300 ease-ds md:px-11 ${
                  stuck
                    ? "items-center border-b border-white/10 bg-[#07090b]/70 pb-3 pt-[15px] backdrop-blur-xl"
                    : "items-end border-b border-transparent pb-5 pt-12"
                }`}
              >
                <div>
                  {showChrome && (
                    <>
                      <div className="tf-fade font-jbmono text-[10.5px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
                        A Trace Finance Proposal
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <ClientLogo config={config} size="header" />
                        <div className="tf-fade leading-tight">
                          <div className="text-[15px] font-semibold text-title">{config.clientName}</div>
                          <div className="text-[12px] text-muted">
                            {config.clientRep ? `Prepared for ${config.clientRep}` : "Prepared by Trace Finance"}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {showChrome && (
                  <div className="tf-fade flex items-center gap-5 self-center">
                    <button
                      onClick={onProposal}
                      disabled={pdf === "working"}
                      className="flex items-center gap-2 rounded-[10px] border border-green-accent/40 bg-[#0e1410]/85 px-4 py-2 text-[12.5px] font-semibold text-[#bfe8d4] transition duration-200 ease-ds hover:border-green-accent hover:bg-[#13201a] disabled:opacity-60"
                    >
                      {pdf === "working" ? "Building deck…" : pdf === "error" ? "Try again" : "Download Proposal ↓"}
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/trace-logo-white.svg" alt="Trace Finance" className="h-[22px] w-auto opacity-90" />
                  </div>
                )}
              </div>

              <FlowExperience
                config={fxConfig}
                presentation
                skin="glass"
                architecture="panels"
                panelSlots={{
                  // only render the controls row when it has something in it —
                  // a single-flow link with a locked direction shows no chrome
                  controls:
                    hasVariants || showDirectionToggle ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          {hasVariants && (
                            <SegToggle value={flowId} onChange={switchFlow} options={variants!.map((v) => ({ value: v.flowId, label: clientFlowName(v.name) }))} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {showDirectionToggle && (
                            <SegToggle value={direction} onChange={setDirection} options={directionOptions(config, flowId)} />
                          )}
                        </div>
                      </>
                    ) : undefined,
                  rail: hasPricing ? (
                    <PricingRail pricing={proposalPricing} legacy={legacyPricing} clientName={config.clientName} />
                  ) : undefined,
                  railPosition: railBelow ? "below" : "beside",
                  closing: config.salesperson ? <RepRow sp={config.salesperson} company={config.clientName} /> : undefined,
                }}
              />

              {/* footer — the quiet centered wordmark */}
              <div className="relative z-10 flex items-center justify-center pb-9 pt-7">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/trace-logo-white.svg" alt="Trace Finance" className="h-[18px] w-auto opacity-85" />
              </div>

            </>
          )
        )}

        {/* proposal-level notes — a slide-out drawer, once the intro has settled */}
        {showChrome && config && <NotesDrawer notes={config.proposalNotes?.[flowId]} />}

        {/* 2c client gate — or the intro overlay for every other state */}
        {state.status === "locked" ? (
          <GateScreen wrong={!!state.wrong} onSubmit={submitPassword} />
        ) : intro !== "done" ? (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center backdrop-blur-2xl"
            style={{
              background: "linear-gradient(rgba(2,4,7,.6), rgba(2,4,7,.78))",
              transition: `opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1)`,
              opacity: intro === "fadeout" ? 0 : 1,
              pointerEvents: intro === "fadeout" ? "none" : "auto",
            }}
          >
            {state.status === "ready" ? (
              <div className="flex flex-col items-center gap-5">
                <Brandmark size="lg" />
                {showWelcomeLogo && <ClientLogo config={config!} size="hero" />}
                <h1 className="font-display text-3xl font-semibold tracking-[-0.01em] text-title md:text-4xl">
                  Welcome{repName ? `, ${repName}` : ""}
                </h1>
                <p className="max-w-md text-sm text-subtitle">
                  {hasVariants
                    ? `Here are the cross-border payment flows we’ve prepared for ${config!.clientName}.`
                    : `Here’s the cross-border payment flow we’ve prepared for ${config!.clientName}.`}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Brandmark />
                <p className="text-sm text-subtitle">
                  {state.status === "loading" && "Loading the flow…"}
                  {state.status === "notfound" && "This link is invalid or has expired."}
                  {state.status === "unconfigured" && "Sharing isn’t configured yet."}
                  {state.status === "expired" && "This link has expired."}
                  {state.status === "error" && state.msg}
                </p>
                {state.status === "expired" && (
                  <p className="text-[12.5px] text-muted">Ask your Trace contact for a fresh one.</p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </LayoutGroup>
  );
}

// 2c — the client link gate: lock in a mint ring, ordinary password field,
// mint CTA. The password is auto-set at share time; the UI never hints at what
// it is — the rep communicates it.
function GateScreen({ wrong, onSubmit }: { wrong: boolean; onSubmit: (pw: string) => Promise<void> }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false); // typing quiets the error until the next attempt

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pw.trim() || busy) return;
    setBusy(true);
    setDirty(false);
    try {
      await onSubmit(pw);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6">
      <SilkBackdrop />
      <GlassPanel className="w-full max-w-[380px] px-10 py-9">
      <form onSubmit={submit} className="tf-rise flex w-full flex-col items-center text-center">
        <span className="mb-[18px] flex h-[46px] w-[46px] items-center justify-center rounded-full border border-[rgba(0,242,177,.3)] bg-[#0f1814] text-mint">
          {/* Lucide-style lock, 2px stroke */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <h1 className="font-display text-[19px] font-semibold tracking-[-0.01em] text-title">This proposal is private</h1>
        <p className="mb-[22px] mt-2 text-[12.5px] leading-normal text-[#8b948f]">
          Enter the password your Trace contact shared with you.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setDirty(true);
          }}
          autoFocus
          autoComplete="current-password"
          aria-label="Proposal password"
          aria-invalid={wrong && !dirty}
          className="w-full rounded-lg border border-hairline-control bg-surface-input px-3 py-[11px] text-center font-mono text-[15px] tracking-[4px] text-title outline-none transition duration-200 ease-ds focus:border-mint"
        />
        {wrong && !dirty && (
          <p className="mt-2.5 text-[11.5px] text-[#e6b566]" role="alert">
            That’s not it. Check with your Trace contact.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !pw.trim()}
          className="mt-2.5 w-full rounded-[9px] bg-mint px-4 py-[11px] text-[13px] font-semibold text-mint-on transition duration-200 ease-ds hover:bg-mint-hover active:bg-mint-press disabled:opacity-60"
        >
          {busy ? "Checking…" : "View proposal"}
        </button>
        <p className="mt-3.5 text-[11px] text-[#4a5651]">Link expires 30 days after sending.</p>
      </form>
      </GlassPanel>
    </div>
  );
}

// The client logo, as a single layoutId element so it can "magic-move" between
// the centred welcome and its header slot. Honours the logo plate (a dark logo
// rides a white card; a light/transparent logo sits straight on the deck).
function ClientLogo({ config, size }: { config: SharedConfig; size: "header" | "hero" }) {
  const logoSrc = safeSrc(config.clientLogoUrl);
  if (!logoSrc) {
    if (size === "header") return null;
    return <div className="font-display text-2xl font-semibold text-title">{config.clientName}</div>;
  }
  const t = { layout: { duration: 0.78, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } };
  const light = config.clientLogoPlate === "light";
  if (light) {
    const wrap = size === "header" ? "px-1.5 py-1 rounded-md" : "px-6 py-4 rounded-2xl";
    const img = size === "header" ? "h-6 max-w-[110px]" : "h-14 max-w-[260px]";
    return (
      <motion.span layoutId="client-logo" transition={t} className={`flex items-center justify-center bg-white ${wrap}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt={config.clientName} className={`${img} object-contain`} />
      </motion.span>
    );
  }
  const img = size === "header" ? "h-7 max-w-[120px]" : "h-16 max-w-[280px]";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <motion.img layoutId="client-logo" transition={t} src={logoSrc} alt={config.clientName} className={`${img} object-contain`} />
  );
}

// ── the pricing rail (panel architecture) ────────────────────────────────────
// "What {Client} pays" beside the flow canvas — the link's tailored rates
// (ProposalPricing) or a legacy link's hand-built cards, in the mock's compact
// card style. Reflows to a 2-column grid when the rail drops below the canvas
// (globals.css .tf-price-list).
function PricingRail({ pricing, legacy, clientName }: { pricing: ProposalPricing; legacy: LegacyPricing | null; clientName: string }) {
  const cards = legacy
    ? legacy.cards.map((c) => ({
        key: c.title,
        badge: c.badge,
        bg: c.tone === "cyan" ? "#2be8d6" : "#00f2b1",
        title: c.title,
        sub: c.sub,
        rows: c.rows,
      }))
    : pricing.cards.map((card) => ({
        key: card.key,
        badge: CARD_BADGE[card.badge] ?? "$",
        bg: card.accent === "blue" ? "#2be8d6" : "#00f2b1",
        title: card.title,
        sub: card.sub,
        rows: cardRows(card),
      }));
  return (
    <>
      <div className="font-display text-[21px] font-semibold tracking-[-0.01em] text-title">
        What <span className="text-mint">{clientName}</span> pays
      </div>
      {legacy && (
        <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-[#8b948f]">
          {legacy.flag && <span className="text-[15px] leading-none">{legacy.flag}</span>}
          <span>
            {legacy.region}
            {legacy.subtitle ? ` · ${legacy.subtitle}` : ""}
          </span>
        </div>
      )}
      <div className="tf-price-list mt-5 flex flex-col gap-4">
        {cards.map((card) => (
          <div key={card.key} className="min-w-0 rounded-2xl border border-[#1c2621] bg-white/[0.02] px-5 py-[18px]">
            <div className="flex items-center gap-[11px] pb-3">
              <span
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-display text-[15px] font-bold text-mint-on"
                style={{ background: card.bg }}
              >
                {card.badge}
              </span>
              <div className="min-w-0">
                <div className="font-display text-[14.5px] font-semibold text-title">{card.title}</div>
                {card.sub && <div className="text-[11px] text-muted">{card.sub}</div>}
              </div>
            </div>
            {card.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 border-t border-[#17201c] py-[7px]">
                <span className="min-w-0 truncate text-[12.5px] text-node-text">{r.label}</span>
                <span className="flex-none font-jbmono text-[12.5px] font-medium text-mint">{r.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {legacy?.footer && <div className="mt-auto pt-4 text-[11px] leading-[1.6] text-[#4a5651]">{legacy.footer}</div>}
    </>
  );
}

// ── the rep contact row (panel architecture) ─────────────────────────────────
// Bottom of the machinery panel: photo + identity left, contact CTAs right.
function RepRow({ sp, company }: { sp: Salesperson; company?: string }) {
  const initials = sp.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const photo = safeSrc(sp.photo);
  const bookingUrl = safeLink(sp.bookingUrl);
  const subject = company?.trim() ? `Trace Finance proposal for ${company.trim()}` : "Our Trace Finance proposal";
  const emailHref = sp.email ? `mailto:${sp.email}?subject=${encodeURIComponent(subject)}` : undefined;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-7">
        <div className="flex min-w-0 items-center gap-5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={sp.name} className="h-24 w-24 flex-none rounded-full border border-white/10 object-cover" />
          ) : (
            <div className="flex h-24 w-24 flex-none items-center justify-center rounded-full border border-green-accent/30 bg-[#0f1814] text-2xl font-semibold text-[#9cc4b3]">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-jbmono text-[10px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">Your Trace Finance contact</div>
            <div className="mt-2 font-display text-[19px] font-semibold tracking-[-0.01em] text-title">{sp.name}</div>
            {sp.title && <div className="mt-0.5 text-[13px] text-subtitle">{sp.title}</div>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {bookingUrl && (
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-green-accent px-5 py-2.5 text-sm font-semibold text-[#06120c] transition duration-200 ease-ds hover:brightness-110">
              Book a call →
            </a>
          )}
          {sp.email && emailHref && (
            <a href={emailHref} className="rounded-xl border border-green-accent/40 px-4 py-2.5 text-sm font-medium text-[#bfe8d4] transition duration-200 ease-ds hover:bg-[#13201a]">
              {sp.email}
            </a>
          )}
          {sp.phone && (
            <a href={`tel:${sp.phone.replace(/[^+\d]/g, "")}`} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-subtitle transition duration-200 ease-ds hover:text-title">
              {sp.phone}
            </a>
          )}
        </div>
      </div>
      {sp.bio && <p className="mt-5 max-w-[640px] text-sm leading-relaxed text-subtitle">{sp.bio}</p>}
    </div>
  );
}

// Segmented toggle (Flow/Pricing, Pay-in/out, variants). DS segmented style:
// active = solid mint + dark text; inactive = transparent + #8b948f.
function SegToggle<T extends string>({
  options,
  value,
  onChange,
  full,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  full?: boolean;
}) {
  return (
    <div className={`flex gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] backdrop-blur ${full ? "w-full" : ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-lg px-3 py-[6px] text-[12.5px] tracking-[0.2px] transition duration-200 ease-ds ${full ? "flex-1" : ""} ${
            value === o.value ? "bg-mint font-semibold text-mint-on" : "font-medium text-[#8b948f] hover:text-[#bfe8d4]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── 2a Pricing view ──────────────────────────────────────────────────────────
// "What {Client} pays" — proof chips + two rate cards rendered from the
// proposal's ProposalPricing (tiers or a flat rate). No calculator (removed at
// user request). Direction-independent, so the Pay-in/Pay-out toggle is hidden.

function cardRows(card: PriceCard): PriceRow[] {
  if (card.type === "flat") return [{ label: "All volumes", value: flatRowText(card) }];
  return card.tiers.map((t) => ({ label: t.label, value: tierText(card, t) }));
}

const CARD_BADGE: Record<PriceCard["badge"], string> = { pix: "P", dollar: "$", percent: "%", up: "↑", down: "↓" };

function PricingView({ pricing, clientName, inline }: { pricing: ProposalPricing; clientName: string; inline?: boolean }) {
  const cards = pricing.cards.map((card) => ({
    badge: CARD_BADGE[card.badge] ?? "$",
    badgeBg: card.accent === "blue" ? "#2be8d6" : "#00f2b1",
    title: card.title,
    sub: card.sub,
    rows: cardRows(card),
  }));
  return (
    <div className={inline ? "w-full overflow-x-hidden" : "fixed inset-0 z-10 overflow-y-auto overflow-x-hidden"}>
      {!inline && <SilkBackdrop />}
      <div className={`mx-auto flex flex-col ${inline ? "px-4 pb-12 pt-5" : "min-h-full justify-center px-5 pb-20 pt-24 md:px-10"}`} style={{ width: "min(64rem, 100vw)" }}>
        <GlassPanel className={inline ? "px-5 py-7" : "px-8 py-9 md:px-10"}>
        <div className="text-center">
          <h1 className="font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] text-title md:text-[37px]">
            What <span className="text-mint">{clientName}</span> pays
          </h1>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <div key={card.title} className="tf-rise min-w-0 rounded-2xl border border-hairline-card bg-white/[0.02] px-[22px] py-5" style={{ maxWidth: "calc(100vw - 2rem)" }}>
              <div className="mb-3.5 flex items-center gap-[11px]">
                <span
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold text-mint-on"
                  style={{ background: card.badgeBg }}
                >
                  {card.badge}
                </span>
                <div className="min-w-0">
                  <div className="font-display text-[15px] font-semibold text-title">{card.title}</div>
                  <div className="text-[11px] text-muted">{card.sub}</div>
                </div>
              </div>
              {card.rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-3 border-t border-hairline-row py-[6.5px]">
                  <span className="min-w-0 truncate text-[12.5px] text-node-text">{r.label}</span>
                  <span className="shrink-0 font-jbmono text-[12.5px] font-medium text-mint">{r.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        </GlassPanel>
      </div>
    </div>
  );
}

// Legacy pricing renderer — the pricing slide as stored on older links (region +
// hand-built cards, e.g. the live ARQ proposal). Data renders as-is.
function LegacyPricingView({ pricing, inline }: { pricing: LegacyPricing; inline?: boolean }) {
  return (
    <div className={inline ? "w-full overflow-x-hidden" : "fixed inset-0 z-10 overflow-y-auto overflow-x-hidden"}>
      {!inline && <SilkBackdrop />}
      <div className={`mx-auto flex flex-col ${inline ? "px-4 pb-12 pt-4" : "min-h-full justify-center px-5 pb-16 pt-28 md:px-10"}`} style={{ width: "min(68rem, 100vw)" }}>
        <GlassPanel className={inline ? "px-5 py-7" : "px-8 py-9 md:px-10"}>
        <div className="mb-7">
          <div className="flex items-center gap-3">
            {pricing.flag && <span className="shrink-0 text-4xl leading-none">{pricing.flag}</span>}
            <h2 className="font-display text-3xl font-semibold tracking-tight text-title md:text-4xl">{pricing.region}</h2>
          </div>
          {pricing.subtitle && <p className="mt-1.5 text-sm text-green-accent md:text-[15px]">{pricing.subtitle}</p>}
        </div>

        <div className="space-y-5 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
          {pricing.cards.map((card, i) => (
            <div key={i} className="tf-rise min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-xl md:p-6" style={{ maxWidth: "calc(100vw - 2.5rem)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-[#06120c]"
                  style={{ background: card.tone === "cyan" ? "#2bd4c0" : "#46d39a" }}
                >
                  {card.badge}
                </div>
                <div className="min-w-0">
                  <div className="font-display text-xl font-semibold text-title">{card.title}</div>
                  {card.sub && <div className="text-[13px] text-subtitle">{card.sub}</div>}
                </div>
              </div>
              <div className="my-4 h-px bg-white/10" />
              <div className="space-y-2.5">
                {card.rows.map((r, j) => (
                  <div key={j} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-subtitle">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ASSETS.traceLogo} alt="" className="shrink-0" style={{ height: 12, width: 12 * TRACE_LOGO_AR }} />
                      <span className="truncate">{r.label}</span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-green-accent">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {pricing.footer && <p className="mt-8 text-[11px] text-muted">{pricing.footer}</p>}
        </GlassPanel>
      </div>
    </div>
  );
}

// Closing "last deck" — the salesperson's profile + contact, at the end of the
// proposal scroll. Deck-styled to match the rest.
function SalespersonClosing({ sp, company }: { sp: Salesperson; company?: string }) {
  const initials = sp.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const photo = safeSrc(sp.photo);
  const bookingUrl = safeLink(sp.bookingUrl);
  // Pre-fill the subject so the client's reply lands with context and the rep
  // can triage at a glance. Personalised to the company when we have it.
  const subject = company?.trim() ? `Trace Finance proposal for ${company.trim()}` : "Our Trace Finance proposal";
  const emailHref = sp.email ? `mailto:${sp.email}?subject=${encodeURIComponent(subject)}` : undefined;
  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center px-6">
      <GlassPanel className="w-full max-w-4xl px-8 py-8 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-7">
          <div className="flex min-w-0 items-center gap-5">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={sp.name} className="h-24 w-24 shrink-0 rounded-full border border-white/10 object-cover" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-green-accent/30 bg-[#0f1814] text-2xl font-semibold text-[#9cc4b3]">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-jbmono text-[10px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">Your Trace Finance contact</div>
              <div className="mt-2 font-display text-[19px] font-semibold tracking-[-0.01em] text-title">{sp.name}</div>
              {sp.title && <div className="mt-0.5 text-[13px] text-subtitle">{sp.title}</div>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-green-accent px-5 py-2.5 text-sm font-semibold text-[#06120c] transition duration-200 ease-ds hover:brightness-110">
                Book a call →
              </a>
            )}
            {sp.email && emailHref && (
              <a href={emailHref} className="rounded-xl border border-green-accent/40 px-4 py-2.5 text-sm font-medium text-[#bfe8d4] transition duration-200 ease-ds hover:bg-[#13201a]">
                {sp.email}
              </a>
            )}
            {sp.phone && (
              <a href={`tel:${sp.phone.replace(/[^+\d]/g, "")}`} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-subtitle transition duration-200 ease-ds hover:text-title">
                {sp.phone}
              </a>
            )}
          </div>
        </div>
        {sp.bio && <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-relaxed text-subtitle">{sp.bio}</p>}
      </GlassPanel>
      <div className="absolute bottom-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/trace-logo-white.svg" alt="Trace Finance" className="h-[18px] w-auto opacity-85" />
      </div>
    </section>
  );
}

function Brandmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const h = size === "lg" ? 32 : 22;
  return (
    <div className={`flex items-center ${size === "lg" ? "gap-3" : "gap-2"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.traceLogo} alt="" style={{ height: h, width: h * TRACE_LOGO_AR }} />
      <span className={`font-semibold ${size === "lg" ? "text-[24px]" : "text-[15px]"}`} style={{ color: C.title }}>
        Trace Finance
      </span>
    </div>
  );
}
