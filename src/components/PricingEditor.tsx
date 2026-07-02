"use client";
import { useMemo, useState } from "react";
import {
  deckPricing,
  type PriceComponent,
  type ProposalPricing,
  type ProposalType,
} from "@/flow-tool/data/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Rep pricing editor (design handoff 2b). Lives inside the Present step of the
// build rail. Three modes: From deck (read-only template rates), Override
// (edit any field; deltas are highlighted with a per-field reset), Custom
// (rewrite entirely, starting from the deck values). All values land in the
// client link (Pricing tab) and the downloadable PDF.
// ─────────────────────────────────────────────────────────────────────────────

/** Volume-band labels, index-aligned with deckPricing() tiers. */
const TIER_LABELS = ["Up to $5M", "$5-10M", "$10-30M", "$30-50M", "Above $50M"];
const BAND_LABELS_LONG = [
  "Up to $5M / month",
  "$5M to $10M / month",
  "$10M to $30M / month",
  "$30M to $50M / month",
  "Above $50M / month",
];

type CompKey = "pix" | "spread";
type PricingMode = ProposalPricing["mode"];

const fmt = (n: number) => n.toFixed(2);

export function PricingEditor({
  pricing,
  onChange,
  proposalType,
}: {
  pricing: ProposalPricing;
  onChange: (next: ProposalPricing) => void;
  proposalType: ProposalType;
}) {
  const deck = useMemo(() => deckPricing(), []);
  // Local text drafts so a field can pass through "0." while typing; the parsed
  // number is committed on every valid keystroke and the draft snaps on blur.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const readOnly = pricing.mode === "deck";
  const isOverride = pricing.mode === "override";

  function setMode(mode: PricingMode) {
    setDrafts({});
    if (mode === "deck") {
      // From deck always shows (and shares) the template's own rates.
      onChange({ ...deckPricing(), mode: "deck" });
    } else {
      onChange({ ...pricing, mode });
    }
  }

  // Editing while on "From deck" upgrades to Override in the same stroke, so
  // the default mode never feels dead: touch a field and it just works.
  function patchComp(key: CompKey, comp: PriceComponent) {
    onChange({ ...pricing, mode: pricing.mode === "deck" ? "override" : pricing.mode, [key]: comp });
  }

  function display(k: string, v: number) {
    return drafts[k] ?? fmt(v);
  }
  function edit(k: string, raw: string, commit: (n: number) => void) {
    setDrafts((d) => ({ ...d, [k]: raw }));
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n >= 0) commit(n);
  }
  function settle(k: string) {
    setDrafts((d) => {
      const { [k]: _gone, ...rest } = d;
      return rest;
    });
  }

  function setTier(key: CompKey, i: number, value: number) {
    const comp = pricing[key];
    patchComp(key, { ...comp, tiers: comp.tiers.map((t, j) => (j === i ? { ...t, value } : t)) });
  }
  function setFlat(key: CompKey, value: number) {
    patchComp(key, { ...pricing[key], flat: value });
  }
  function setType(key: CompKey, type: "tiered" | "flat") {
    const comp = pricing[key];
    if (comp.type === type) return;
    setDrafts({});
    patchComp(key, {
      ...comp,
      type,
      // Seed the flat value from the middle band so it starts sensible.
      flat: type === "flat" ? comp.flat ?? comp.tiers[2]?.value ?? comp.tiers[0]?.value ?? 0 : comp.flat,
    });
  }

  function resetTier(key: CompKey, i: number) {
    setDrafts({});
    setTier(key, i, deck[key].tiers[i].value);
  }
  function resetComp(key: CompKey) {
    setDrafts({});
    patchComp(key, { ...deck[key] });
  }

  const tierOverridden = (key: CompKey, i: number) =>
    isOverride && pricing[key].type === "tiered" && pricing[key].tiers[i]?.value !== deck[key].tiers[i].value;
  // The deck is tiered, so a flat component is itself a (structural) override.
  const flatOverridden = (key: CompKey) => isOverride && pricing[key].type === "flat";

  const rampEnabled = proposalType === "brazil-market";

  const modeCaption: Record<PricingMode, string> = {
    deck: `Values come straight from the ${proposalType === "standard" ? "Standard" : "Brazil-market"} deck. Edit any field and it becomes an override.`,
    override: "Values loaded from the deck. Edit any field to override; overrides are marked with the deck's original.",
    custom: "Write pricing from scratch, starting from the deck values.",
  };

  function renderSection(key: CompKey, title: string, unit: { prefix?: string; suffix?: string }, flatCaption: string) {
    const comp = pricing[key];
    const renderDeck = (v: number) => (key === "pix" ? `$${fmt(v)}` : `${fmt(v)}%`);
    return (
      <div className="mb-[18px]">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] font-medium tracking-[.1em] text-mint-muted">{title}</span>
          <span className="flex gap-[2px] rounded-[7px] border border-hairline-card bg-surface-input p-[2px]">
            {(["tiered", "flat"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(key, t)}
                className={`rounded-[5px] px-2 py-[3px] text-[9.5px] transition duration-150 ease-ds ${
                  comp.type === t
                    ? "bg-mint font-semibold text-mint-on"
                    : "font-medium text-[#8b948f] hover:text-title"
                }`}
              >
                {t === "tiered" ? "Tiered" : "Flat"}
              </button>
            ))}
          </span>
        </div>

        {comp.type === "tiered" ? (
          <div className="flex flex-col gap-1.5">
            {comp.tiers.map((tier, i) => {
              const over = tierOverridden(key, i);
              const k = `${key}-${i}`;
              return (
                <div key={k} className="flex items-center gap-2">
                  <span className="flex-1 text-[11.5px] text-[#8b948f]">{TIER_LABELS[i] ?? `Band ${i + 1}`}</span>
                  <span
                    className={`flex w-[92px] items-center gap-1 rounded-[7px] border bg-surface-input px-2 py-[5px] transition duration-150 ease-ds ${
                      over ? "border-hairline-selected" : "border-hairline-control"
                    } focus-within:border-hairline-selected`}
                  >
                    {unit.prefix && <span className="font-mono text-[11px] text-muted">{unit.prefix}</span>}
                    <input
                      value={display(k, tier.value)}
                      onChange={(e) => edit(k, e.target.value, (n) => setTier(key, i, n))}
                      onBlur={() => settle(k)}
                      inputMode="decimal"
                      aria-label={`${title}, ${TIER_LABELS[i]}`}
                      className={`w-full bg-transparent font-mono text-xs font-medium outline-none ${
                        over ? "text-mint" : readOnly ? "text-subtitle" : "text-title"
                      }`}
                    />
                    {unit.suffix && <span className="font-mono text-[11px] text-muted">{unit.suffix}</span>}
                  </span>
                </div>
              );
            })}
            {isOverride &&
              comp.tiers.map((_, i) =>
                tierOverridden(key, i) ? (
                  <div key={`note-${key}-${i}`} className="flex items-center gap-1.5 text-[10.5px] text-mint">
                    <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-mint" />
                    <span>
                      {TIER_LABELS[i]} · deck was {renderDeck(deck[key].tiers[i].value)} ·{" "}
                      <button onClick={() => resetTier(key, i)} className="underline transition hover:text-mint-hover">
                        reset
                      </button>
                    </span>
                  </div>
                ) : null,
              )}
          </div>
        ) : (
          <div>
            <div
              className={`mb-1.5 flex items-center rounded-lg border bg-surface-input px-3 py-2 transition duration-150 ease-ds ${
                flatOverridden(key) ? "border-hairline-selected" : "border-hairline-control"
              }`}
            >
              <input
                value={display(`${key}-flat`, comp.flat ?? 0)}
                onChange={(e) => edit(`${key}-flat`, e.target.value, (n) => setFlat(key, n))}
                onBlur={() => settle(`${key}-flat`)}
                inputMode="decimal"
                aria-label={`${title}, flat`}
                className={`flex-1 bg-transparent font-mono text-[13px] font-medium outline-none ${
                  flatOverridden(key) ? "text-mint" : readOnly ? "text-subtitle" : "text-title"
                }`}
              />
              <span className="font-mono text-[11px] text-muted">{unit.suffix ?? unit.prefix}</span>
            </div>
            <p className="text-[10.5px] leading-normal text-muted">{flatCaption}</p>
            {flatOverridden(key) && (
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-mint">
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-mint" />
                <span>
                  Flat · deck was tiered ·{" "}
                  <button onClick={() => resetComp(key)} className="underline transition hover:text-mint-hover">
                    reset
                  </button>
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hairline-card bg-surface-card2">
      <div className="flex items-center justify-between border-b border-hairline-row px-4 py-3">
        <span className="text-[13px] font-semibold text-title">Pricing</span>
        <span className="rounded-[5px] border border-hairline-control px-1.5 py-[3px] font-mono text-[10px] font-medium text-mint-muted">
          {proposalType === "standard" ? "STANDARD" : "BRAZIL-MARKET"}
        </span>
      </div>

      <div className="px-4 py-3.5">
        {/* mode tabs */}
        <div className="mb-3 grid grid-cols-3 gap-[3px] rounded-[10px] border border-hairline-card bg-surface-input p-[3px]">
          {(
            [
              ["deck", "From deck"],
              ["override", "Override"],
              ["custom", "Custom"],
            ] as [PricingMode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-[7px] px-1 py-[7px] text-center text-[11px] transition duration-150 ease-ds ${
                pricing.mode === m ? "bg-mint font-semibold text-mint-on" : "font-medium text-[#8b948f] hover:text-title"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-[11px] leading-normal text-muted">{modeCaption[pricing.mode]}</p>

        {renderSection("pix", "PIX API · USD / PIX", { prefix: "$" }, "One flat fee across all volumes. Switch to Tiered for the five volume bands.")}
        {renderSection("spread", "FX SPREAD · % OVER SPOT", { suffix: "%" }, "One flat spread across all volumes. Switch to Tiered for the five volume bands.")}

        {/* on/off-ramp — placeholder; only "enabled-looking" on the Brazil-market template */}
        <div className={`mb-2 font-mono text-[10px] font-medium tracking-[.1em] ${rampEnabled ? "text-mint-muted" : "text-[#3f4a45]"}`}>
          ON/OFF-RAMP · BPS
        </div>
        <div
          className={`mb-[18px] rounded-lg px-3 py-[9px] text-[11.5px] ${
            rampEnabled
              ? "border border-hairline-control bg-surface-input text-[#8b948f]"
              : "border border-dashed border-hairline-control bg-[#0c110e] text-[#4a5651]"
          }`}
        >
          {rampEnabled ? "Not in the proposal" : "Not in the Standard proposal"}
        </div>

        <div className="border-t border-hairline-row pt-3.5">
          <p className="mb-2.5 text-[10.5px] leading-normal text-muted">
            These rates drive the client&apos;s <b className="font-semibold text-[#8b948f]">Pricing view</b> and the downloadable PDF.
          </p>
          <button
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 1600);
            }}
            className="w-full rounded-[9px] bg-mint py-2.5 text-[12.5px] font-semibold text-mint-on transition duration-150 ease-ds hover:bg-mint-hover active:bg-mint-press"
          >
            {saved ? "Pricing saved" : "Save pricing"}
          </button>
        </div>
      </div>
    </div>
  );
}
