"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { FlowExperience, useIsMobile } from "@/flow-tool/components/FlowExperience";
import { ASSETS, C, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { loadSharedFlow } from "@/flow-tool/lib/share";
import type { Direction, FlowConfig } from "@/flow-tool/data/schema";

// A shared link may carry more than one flow "variant" (e.g. ARQ's With-Arq-IP
// vs Direct structures). The viewer switches between them with a left-side
// toggle that mirrors the Pay-in / Pay-out control on the right.
type Variant = { flowId: string; name: string };
// `proposalUrl` (optional) points to a curated proposal PDF to serve on
// "Download Proposal"; without it we fall back to the live-generated deck.
// `pricing` (optional) drives the native Pricing tab (rendered as web content).
type PriceRow = { label: string; value: string };
type PriceCard = { badge: string; tone?: "green" | "cyan"; title: string; sub?: string; rows: PriceRow[] };
type Pricing = { region: string; flag?: string; subtitle?: string; cards: PriceCard[]; footer?: string };
// `salesperson` (optional) renders the closing "last deck" of the proposal.
type Salesperson = { name: string; title?: string; email?: string; phone?: string; photo?: string; bio?: string; bookingUrl?: string };
type SharedConfig = FlowConfig & { variants?: Variant[]; proposalUrl?: string; pricing?: Pricing; salesperson?: Salesperson };

type State =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "unconfigured" }
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

export function SharedFlowView({ code }: { code: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [intro, setIntro] = useState<Intro>("loading");
  const [direction, setDirection] = useState<Direction>("collection");
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<"idle" | "working" | "error">("idle");
  const [ppt, setPpt] = useState<"idle" | "working" | "error">("idle");
  const [view, setView] = useState<"flow" | "pricing">("flow"); // top-left Flow | Pricing tab

  const config = state.status === "ready" ? state.config : null;
  const variants = config?.variants;
  const flowId = activeFlowId ?? config?.flowId ?? "";
  const repName = config?.clientRep?.split(",")[0]?.trim();

  // "Download Proposal": serve the curated proposal PDF when one is attached,
  // otherwise fall back to a live-generated deck (title slide + one per flow).
  async function onProposal() {
    if (!config) return;
    if (config.proposalUrl) {
      const a = document.createElement("a");
      a.href = config.proposalUrl;
      a.download = `Trace Finance - ${config.clientName} - Proposal.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    setPdf("working");
    try {
      const { variants: _v, proposalUrl: _p, ...base } = config;
      const { downloadFlowDeckPdf } = await import("@/flow-tool/lib/pptx");
      await downloadFlowDeckPdf({ ...base, direction }, variants);
      setPdf("idle");
    } catch {
      setPdf("error");
      setTimeout(() => setPdf("idle"), 3000);
    }
  }

  // same deck, as an editable PowerPoint
  async function onPptx() {
    if (!config) return;
    setPpt("working");
    try {
      const { variants: _v, proposalUrl: _p, ...base } = config;
      const { downloadFlowPptx } = await import("@/flow-tool/lib/pptx");
      await downloadFlowPptx({ ...base, direction }, variants);
      setPpt("idle");
    } catch {
      setPpt("error");
      setTimeout(() => setPpt("idle"), 3000);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // hold the loading screen a beat so it reads, even on a fast fetch
        const [loaded] = await Promise.all([
          loadSharedFlow(code) as Promise<SharedConfig | null>,
          new Promise((r) => setTimeout(r, MIN_LOAD_MS)),
        ]);
        if (cancelled) return;
        if (!loaded) setState({ status: "notfound" });
        else {
          setDirection(loaded.direction);
          setActiveFlowId(loaded.variants?.[0]?.flowId ?? loaded.flowId);
          setState({ status: "ready", config: loaded });
        }
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

  // deep-link straight to the pricing tab with ?view=pricing
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "pricing") setView("pricing");
  }, []);

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
  const hasPricing = !!config?.pricing;
  const showWelcomeLogo = intro === "welcome";
  const showChrome = intro === "fadeout" || intro === "done"; // header + downloads settle in

  // the FlowConfig handed to the flow renderer (strip the proposal-only extras)
  const fxConfig: FlowConfig | null = config
    ? (() => {
        const { variants: _v, proposalUrl: _p, pricing: _pr, salesperson: _s, ...base } = config;
        return { ...base, flowId, direction };
      })()
    : null;

  return (
    <LayoutGroup>
      <main className="relative overflow-x-hidden bg-[#07090b]">
        {config && fxConfig && (
          isMobile ? (
            /* ── phone: sticky top bar + inline controls + vertical flow ── */
            <>
              <header className="sticky top-0 z-40 border-b border-white/5 bg-[#07090b]/90 px-4 pb-2.5 pt-3 backdrop-blur">
                {showChrome && (
                  <div className="tf-fade">
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
                      {view === "flow" && (
                        <SegToggle value={direction} onChange={setDirection} options={[{ value: "collection", label: "Pay-in" }, { value: "disbursement", label: "Pay-out" }]} />
                      )}
                      {view === "flow" && hasVariants && (
                        <SegToggle full value={flowId} onChange={setActiveFlowId} options={variants!.map((v) => ({ value: v.flowId, label: v.name }))} />
                      )}
                    </div>
                  </div>
                )}
              </header>

              {hasPricing && view === "pricing" ? (
                <PricingView pricing={config.pricing!} inline />
              ) : (
                <>
                  <FlowExperience config={fxConfig} presentation onDirectionChange={setDirection} />
                  <div className="flex flex-col gap-2 px-4 pb-10 pt-1">
                    <button
                      onClick={onProposal}
                      disabled={pdf === "working"}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-accent/40 bg-[#0e1410] px-5 py-3 text-sm font-semibold text-[#bfe8d4] transition hover:bg-[#13201a] disabled:opacity-60"
                    >
                      {pdf === "working" ? "Building deck…" : pdf === "error" ? "Try again" : "Download Proposal ↓"}
                    </button>
                    <button
                      onClick={onPptx}
                      disabled={ppt === "working"}
                      className="w-full rounded-xl border border-white/10 bg-[#0e1410] px-4 py-2.5 text-sm font-medium text-subtitle transition hover:text-title disabled:opacity-60"
                    >
                      {ppt === "working" ? "Building…" : ppt === "error" ? "Try again" : "PowerPoint"}
                    </button>
                  </div>
                  {config.salesperson && <SalespersonClosing sp={config.salesperson} />}
                </>
              )}
            </>
          ) : (
            /* ── desktop: fixed-corner chrome + scroll-dive (unchanged) ── */
            <>
              <div className="no-print fixed left-6 top-4 z-[55] flex flex-col items-start gap-3">
                {showChrome && (
                  <>
                    <div className="flex items-center gap-3">
                      <ClientLogo config={config} size="header" />
                      <div className="tf-fade leading-tight">
                        <div className="text-sm font-semibold text-title">{config.clientName}</div>
                        {config.clientRep && <div className="text-[11px] text-muted">Prepared for {config.clientRep}</div>}
                      </div>
                    </div>
                    <div className="tf-fade flex flex-col gap-1.5">
                      {hasPricing && <ViewSwitch view={view} onChange={setView} />}
                      <AnimatePresence initial={false}>
                        {(!hasPricing || view === "flow") && hasVariants && (
                          <motion.div
                            key="variants"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                            className="flex flex-col gap-1.5 overflow-hidden"
                          >
                            <span className="pl-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Flows</span>
                            <FlowSwitch variants={variants!} activeId={flowId} onChange={setActiveFlowId} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>

              {hasPricing && view === "pricing" ? (
                <PricingView pricing={config.pricing!} />
              ) : (
                <>
                  <FlowExperience config={fxConfig} presentation onDirectionChange={setDirection} />
                  {config.salesperson && <SalespersonClosing sp={config.salesperson} />}
                </>
              )}

              {showChrome && (
                <div className="tf-fade fixed bottom-6 left-6 z-40 flex items-center gap-2">
                  <button
                    onClick={onProposal}
                    disabled={pdf === "working"}
                    className="flex items-center gap-2 rounded-xl border border-green-accent/40 bg-[#0e1410]/85 px-5 py-3 text-sm font-semibold text-[#bfe8d4] shadow-xl backdrop-blur transition hover:border-green-accent hover:bg-[#13201a] disabled:opacity-60"
                  >
                    {pdf === "working" ? "Building deck…" : pdf === "error" ? "Try again" : "Download Proposal ↓"}
                  </button>
                  <button
                    onClick={onPptx}
                    disabled={ppt === "working"}
                    className="rounded-xl border border-white/10 bg-[#0e1410]/85 px-4 py-3 text-sm font-medium text-subtitle shadow-xl backdrop-blur transition hover:border-green-accent/40 hover:text-title disabled:opacity-60"
                  >
                    {ppt === "working" ? "Building…" : ppt === "error" ? "Try again" : "PowerPoint"}
                  </button>
                </div>
              )}
            </>
          )
        )}

        {/* intro overlay: opaque backdrop + welcome text, fading out on reveal */}
        {intro !== "done" && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090b] px-6 text-center"
            style={{ transition: `opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1)`, opacity: intro === "fadeout" ? 0 : 1, pointerEvents: intro === "fadeout" ? "none" : "auto" }}
          >
            {state.status === "ready" ? (
              <div className="flex flex-col items-center gap-5">
                <Brandmark size="lg" />
                {showWelcomeLogo && <ClientLogo config={config!} size="hero" />}
                <h1 className="text-3xl font-bold tracking-tight text-title md:text-4xl">
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
                  {state.status === "error" && state.msg}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </LayoutGroup>
  );
}

// The client logo, as a single layoutId element so it can "magic-move" between
// the centred welcome and its header slot. Honours the logo plate (a dark logo
// rides a white card; a light/transparent logo sits straight on the deck).
function ClientLogo({ config, size }: { config: SharedConfig; size: "header" | "hero" }) {
  if (!config.clientLogoUrl) {
    if (size === "header") return null;
    return <div className="text-2xl font-semibold text-title">{config.clientName}</div>;
  }
  const t = { layout: { duration: 0.78, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } };
  const light = config.clientLogoPlate === "light";
  if (light) {
    const wrap = size === "header" ? "px-1.5 py-1 rounded-md" : "px-6 py-4 rounded-2xl";
    const img = size === "header" ? "h-6 max-w-[110px]" : "h-14 max-w-[260px]";
    return (
      <motion.span layoutId="client-logo" transition={t} className={`flex items-center justify-center bg-white ${wrap}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={config.clientLogoUrl} alt={config.clientName} className={`${img} object-contain`} />
      </motion.span>
    );
  }
  const img = size === "header" ? "h-7 max-w-[120px]" : "h-16 max-w-[280px]";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <motion.img layoutId="client-logo" transition={t} src={config.clientLogoUrl} alt={config.clientName} className={`${img} object-contain`} />
  );
}

// Horizontal Flow | Pricing tab — sits above the variant toggle. Selecting Flow
// drops the variant lines down; Pricing swaps the main view to the proposal.
function ViewSwitch({ view, onChange }: { view: "flow" | "pricing"; onChange: (v: "flow" | "pricing") => void }) {
  return (
    <div className="flex gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] backdrop-blur">
      {(["flow", "pricing"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-lg px-[15px] py-[6px] text-[12.5px] font-medium tracking-[0.2px] capitalize transition ${
            view === v ? "bg-[#46d39a24] text-[#bfe8d4]" : "text-[#8b948f] hover:text-[#bfe8d4]"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

// Horizontal segmented toggle used by the mobile header (Flow/Pricing, Pay-in/out,
// variant). Same pill styling as the desktop controls.
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
    <div className={`flex gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] ${full ? "w-full" : ""}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-[6px] text-[12.5px] font-medium tracking-[0.2px] transition ${full ? "flex-1" : ""} ${
            value === o.value ? "bg-[#46d39a24] text-[#bfe8d4]" : "text-[#8b948f]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Pricing view — the pricing slide rebuilt as native, deck-styled web content
// (selectable, responsive) from config.pricing.
function PricingView({ pricing, inline }: { pricing: Pricing; inline?: boolean }) {
  return (
    <div
      className={inline ? "w-full overflow-x-hidden" : "fixed inset-0 z-10 overflow-y-auto overflow-x-hidden"}
      style={{ background: "radial-gradient(62% 60% at 50% 28%, #15392d40 0%, rgba(7,9,11,0) 70%), #07090b" }}
    >
      <div className={`mx-auto flex flex-col ${inline ? "px-4 pb-12 pt-4" : "min-h-full justify-center px-5 pb-16 pt-28 md:px-10"}`} style={{ width: "min(64rem, 100vw)" }}>
        <div className="mb-7">
          <div className="flex items-center gap-3">
            {pricing.flag && <span className="shrink-0 text-4xl leading-none">{pricing.flag}</span>}
            <h2 className="text-3xl font-bold tracking-tight text-title md:text-4xl">{pricing.region}</h2>
          </div>
          {pricing.subtitle && <p className="mt-1.5 text-sm text-green-accent md:text-[15px]">{pricing.subtitle}</p>}
        </div>

        <div className="space-y-5 md:grid md:grid-cols-2 md:gap-5 md:space-y-0">
          {pricing.cards.map((card, i) => (
            <div key={i} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-xl md:p-6" style={{ maxWidth: "calc(100vw - 2.5rem)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-[#06120c]"
                  style={{ background: card.tone === "cyan" ? "#2bd4c0" : "#46d39a" }}
                >
                  {card.badge}
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-bold text-title">{card.title}</div>
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
      </div>
    </div>
  );
}

// Closing "last deck" — the salesperson's profile + contact, at the end of the
// proposal scroll. Deck-styled to match the rest.
function SalespersonClosing({ sp }: { sp: Salesperson }) {
  const initials = sp.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <section
      className="relative flex min-h-screen w-full flex-col items-center justify-center px-6 text-center"
      style={{ background: "radial-gradient(60% 60% at 50% 42%, #15392d40 0%, rgba(7,9,11,0) 70%), #07090b" }}
    >
      <div className="mb-7 text-[11px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">Your Trace Finance contact</div>
      <div className="flex max-w-md flex-col items-center gap-5">
        {sp.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sp.photo} alt={sp.name} className="h-28 w-28 rounded-full border border-white/10 object-cover" />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded-full border border-green-accent/30 bg-[#0f1814] text-3xl font-semibold text-[#9cc4b3]">
            {initials}
          </div>
        )}
        <div>
          <div className="text-2xl font-bold tracking-tight text-title">{sp.name}</div>
          {sp.title && <div className="mt-0.5 text-sm text-subtitle">{sp.title}</div>}
        </div>
        {sp.bio && <p className="text-sm leading-relaxed text-subtitle">{sp.bio}</p>}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {sp.bookingUrl && (
            <a href={sp.bookingUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-green-accent px-5 py-2.5 text-sm font-semibold text-[#06120c] transition hover:brightness-110">
              Book a call →
            </a>
          )}
          {sp.email && (
            <a href={`mailto:${sp.email}`} className="rounded-xl border border-green-accent/40 px-4 py-2.5 text-sm font-medium text-[#bfe8d4] transition hover:bg-[#13201a]">
              {sp.email}
            </a>
          )}
          {sp.phone && (
            <a href={`tel:${sp.phone.replace(/[^+\d]/g, "")}`} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-subtitle transition hover:text-title">
              {sp.phone}
            </a>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ASSETS.traceLogo} alt="" style={{ height: 20, width: 20 * TRACE_LOGO_AR }} />
        <span className="text-[14px] font-semibold text-title">Trace Finance</span>
      </div>
    </section>
  );
}

// Left-side flow switch — same segmented-pill styling as the Pay-in / Pay-out
// toggle, but it swaps the whole flow between the prepared variants.
function FlowSwitch({ variants, activeId, onChange }: { variants: Variant[]; activeId: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[11px] border border-white/10 bg-[#0e1410]/70 p-[3px] backdrop-blur">
      {variants.map((v) => (
        <button
          key={v.flowId}
          onClick={() => onChange(v.flowId)}
          className={`w-full rounded-lg px-[15px] py-[6px] text-left text-[12.5px] font-medium tracking-[0.2px] transition ${
            activeId === v.flowId ? "bg-[#46d39a24] text-[#bfe8d4]" : "text-[#8b948f] hover:text-[#bfe8d4]"
          }`}
        >
          {v.name}
        </button>
      ))}
    </div>
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
