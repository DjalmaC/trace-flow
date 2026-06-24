"use client";
// ─────────────────────────────────────────────────────────────────────────────
// ProposalDocument — a print-optimized, branded client proposal generated from
// the current FlowConfig. Renders as a full-page "paper" view; the on-screen
// Print / Exit controls are print:hidden so window.print() (browser "Save as
// PDF") yields a clean document. Structural today; the Pricing block reads the
// optional ProposalPricing seam (build brief §10) and otherwise shows a "to be
// completed" placeholder.
// ─────────────────────────────────────────────────────────────────────────────
import type { FlowConfig, ProposalPricing, TraceRole } from "../data/schema";
import { getFlow } from "../data";
import { ASSETS, TRACE_LOGO_AR } from "../components/tokens";
import { buildProposal, type ProposalRouteLeg } from "./buildProposal";

const ROLE_STYLE: Record<TraceRole, string> = {
  VASP: "bg-[#e6f7f4] text-[#0b6b5f] ring-1 ring-[#9ad9cf]",
  "Correspondente Cambial": "bg-[#eafaf2] text-[#11603f] ring-1 ring-[#9fd9bd]",
};

export function ProposalDocument({
  config,
  onExit,
}: {
  config: FlowConfig;
  onExit?: () => void;
}) {
  const flow = getFlow(config.flowId);
  if (!flow) return null;
  const p = buildProposal(flow, config);

  // Stamped at render in the browser; proposals are generated on-demand.
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-300 print:bg-white print:static print:overflow-visible">
      {/* on-screen controls — never printed */}
      <div className="fixed right-4 top-4 z-10 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-green-accent px-3 py-1.5 text-sm font-semibold text-[#06120c] shadow transition hover:brightness-110"
        >
          Print / Save PDF ⎙
        </button>
        {onExit && (
          <button
            onClick={onExit}
            className="rounded-lg border border-neutral-400 bg-white/90 px-3 py-1.5 text-sm text-neutral-700 shadow backdrop-blur transition hover:text-neutral-900"
          >
            Exit ✕
          </button>
        )}
      </div>

      {/* the paper */}
      <article className="mx-auto my-8 w-[820px] max-w-[calc(100vw-2rem)] bg-white text-neutral-900 shadow-2xl print:my-0 print:w-full print:max-w-none print:shadow-none">
        {/* dark Trace header band */}
        <header className="flex items-center justify-between bg-deck-base px-10 py-6 print:px-12">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ASSETS.traceLogo} alt="Trace Finance" height={26} width={26 * TRACE_LOGO_AR} style={{ height: 26, width: 26 * TRACE_LOGO_AR }} />
            <span className="text-sm font-semibold tracking-wide text-title">Trace Finance</span>
          </div>
          <span className="text-xs uppercase tracking-[0.2em] text-subtitle">Payment Flow Proposal</span>
        </header>

        <div className="px-10 py-8 print:px-12">
          {/* client + date */}
          <div className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-6">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Prepared for</div>
              <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{config.clientName}</h1>
            </div>
            <div className="flex items-center gap-4">
              {config.clientLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.clientLogoUrl} alt={`${config.clientName} logo`} className="max-h-12 max-w-[140px] object-contain" />
              )}
              <div className="text-right text-xs text-neutral-500">{date}</div>
            </div>
          </div>

          {/* flow summary */}
          <section className="mt-6">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#0b8f6a]">Flow {p.displayId}</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-neutral-900">{p.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-neutral-700">{p.narrative}</p>

            {/* fact chips */}
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
              <Fact label="Direction" value={p.directionLabel} />
              <Fact label="Collected → Delivered" value={`${p.collected} → ${p.delivered}`} />
              <Fact label="Settlement form" value={p.settlementForm === "virtual-asset" ? "Virtual asset" : "Fiat"} />
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Trace role</span>
              {p.traceRole.length === 0 ? (
                <span className="text-sm text-neutral-500">—</span>
              ) : (
                p.traceRole.map((r) => (
                  <span key={r} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLE[r]}`}>
                    {r}
                  </span>
                ))
              )}
            </div>
          </section>

          {/* end-to-end headline */}
          <section className="mt-8">
            <SectionTitle>End to end</SectionTitle>
            <div className="mt-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-800 ring-1 ring-neutral-200">
              <span className="font-medium">{p.headline.fromLabel}</span>
              <span className="mx-2 text-neutral-400">→</span>
              <span className="font-medium">{p.headline.toLabel}</span>
              <span className="ml-3 text-neutral-500">
                {p.headline.carries}
                {p.headline.convertsTo ? ` → ${p.headline.convertsTo}` : ""}
              </span>
            </div>
          </section>

          {/* route */}
          <section className="mt-8">
            <SectionTitle>How the value moves</SectionTitle>
            <ol className="mt-2 divide-y divide-neutral-100 overflow-hidden rounded-lg ring-1 ring-neutral-200">
              {p.route.map((leg, i) => (
                <RouteRow key={i} index={i + 1} leg={leg} />
              ))}
            </ol>
          </section>

          {/* pricing seam */}
          <section className="mt-8">
            <SectionTitle>Pricing</SectionTitle>
            <Pricing pricing={config.pricing} />
          </section>

          <footer className="mt-10 border-t border-neutral-200 pt-4 text-[11px] leading-relaxed text-neutral-400">
            This proposal describes the structure of the cross-border payment flow. Commercial terms are
            indicative and subject to a final agreement with Trace Finance.
          </footer>
        </div>
      </article>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-800">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">{children}</h3>;
}

function RouteRow({ index, leg }: { index: number; leg: ProposalRouteLeg }) {
  return (
    <li className="flex items-center gap-3 bg-white px-4 py-2.5 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-medium text-neutral-500">
        {index}
      </span>
      <span className="text-neutral-800">{leg.fromLabel}</span>
      <span className="text-neutral-400">→</span>
      <span className="text-neutral-800">{leg.toLabel}</span>
      <span className="ml-auto flex items-center gap-2 text-xs">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-600">
          {leg.carries}
          {leg.convertsTo ? ` → ${leg.convertsTo}` : ""}
        </span>
        {leg.crosses && (
          <span className="rounded bg-[#eafaf2] px-1.5 py-0.5 font-medium text-[#11603f]">crosses border</span>
        )}
      </span>
    </li>
  );
}

function Pricing({ pricing }: { pricing?: ProposalPricing }) {
  if (!pricing) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-sm text-neutral-500">
        Pricing — to be completed with the Trace team.
      </div>
    );
  }
  return (
    <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-neutral-200">
      {pricing.amountIn && (
        <Row label={`Amount in (${pricing.amountIn.currency})`} value={fmt(pricing.amountIn.amount)} />
      )}
      {typeof pricing.fxRate === "number" && <Row label="FX rate" value={String(pricing.fxRate)} />}
      {pricing.lineItems.map((item, i) => (
        <Row key={i} label={item.label} value={item.value} note={item.note} />
      ))}
      {pricing.amountOut && (
        <Row label={`Amount delivered (${pricing.amountOut.currency})`} value={fmt(pricing.amountOut.amount)} strong />
      )}
    </div>
  );
}

function Row({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0 ${strong ? "bg-neutral-50 font-semibold text-neutral-900" : "text-neutral-700"}`}>
      <span>
        {label}
        {note && <span className="ml-2 text-xs text-neutral-400">{note}</span>}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
