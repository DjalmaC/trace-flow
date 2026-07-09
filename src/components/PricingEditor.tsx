"use client";
import { useMemo, useState } from "react";
import {
  cardEqualsDeck,
  deckPricing,
  normalizePricing,
  type PriceCard,
  type PriceTier,
  type ProposalPricing,
  type ProposalType,
} from "@/flow-tool/data/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Rep pricing editor (design handoff 2b). Lives inside the Present step of the
// build rail. Two modes: From deck (the template's own rates; touch any field
// and it upgrades to Custom) and Custom (everything is editable: values, band
// labels, tier count, flat rates, or a free-text rate per band). One section
// per priced product — the Standard deck's two, or the Brazil-market deck's
// five. All values land in the client link (Pricing tab) and the PDF, where an
// edited product's page is re-rendered in place.
// ─────────────────────────────────────────────────────────────────────────────

type PricingMode = ProposalPricing["mode"];

const fmt = (n: number) => n.toFixed(2);

export function PricingEditor({
  pricing: rawPricing,
  onChange,
  proposalType,
}: {
  pricing: ProposalPricing;
  onChange: (next: ProposalPricing) => void;
  proposalType: ProposalType;
}) {
  const deck = useMemo(() => deckPricing(proposalType), [proposalType]);
  const pricing = useMemo(() => normalizePricing(rawPricing, proposalType), [rawPricing, proposalType]);
  // Local text drafts so a numeric field can pass through "0." while typing;
  // the parsed number is committed on every valid keystroke and the draft
  // snaps on blur.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const readOnly = pricing.mode === "deck";

  function setMode(mode: PricingMode) {
    setDrafts({});
    if (mode === "deck") {
      // From deck always shows (and shares) the template's own rates.
      onChange({ ...deckPricing(proposalType), mode: "deck" });
    } else {
      onChange({ ...pricing, mode });
    }
  }

  // Editing while on "From deck" upgrades to Custom in the same stroke, so the
  // default mode never feels dead: touch a field and it just works.
  function patchCard(key: string, next: PriceCard) {
    onChange({
      mode: "custom",
      cards: pricing.cards.map((c) => (c.key === key ? next : c)),
    });
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

  function patchTier(card: PriceCard, i: number, patch: Partial<PriceTier>) {
    patchCard(card.key, { ...card, tiers: card.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  }
  function deleteTier(card: PriceCard, i: number) {
    setDrafts({});
    patchCard(card.key, { ...card, tiers: card.tiers.filter((_, j) => j !== i) });
  }
  function addTier(card: PriceCard) {
    const last = card.tiers[card.tiers.length - 1];
    patchCard(card.key, { ...card, tiers: [...card.tiers, { label: "New tier", value: last?.value ?? 0 }] });
  }
  function setType(card: PriceCard, type: "tiered" | "flat") {
    if (card.type === type) return;
    setDrafts({});
    patchCard(card.key, {
      ...card,
      type,
      // Seed the flat value from the middle band so it starts sensible.
      flat: type === "flat" ? card.flat ?? card.tiers[Math.floor(card.tiers.length / 2)]?.value ?? 0 : card.flat,
    });
  }
  function resetCard(card: PriceCard) {
    setDrafts({});
    const dc = deck.cards.find((c) => c.key === card.key);
    if (dc) patchCard(card.key, structuredClone(dc));
  }

  // ── product groups: remove from the offer / add back / add a new one ──
  function removeCard(key: string) {
    setDrafts({});
    onChange({ mode: "custom", cards: pricing.cards.filter((c) => c.key !== key) });
  }
  function restoreCard(key: string) {
    const dc = deck.cards.find((c) => c.key === key);
    if (!dc) return;
    // back into its deck position among the surviving cards
    const order = deck.cards.map((c) => c.key);
    const cards = [...pricing.cards, structuredClone(dc)].sort(
      (a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99),
    );
    onChange({ mode: "custom", cards });
  }
  function addNewCard(unit: "%" | "R$" | "$") {
    const card: PriceCard = {
      key: `xtra-${Math.random().toString(36).slice(2, 8)}`,
      title: "New product",
      sub: unit === "%" ? "% of volume, tiered" : "Per-transaction fee, tiered by volume",
      pageSub: "Tailored for this proposal",
      prefix: unit === "%" ? undefined : `${unit} `,
      suffix: unit === "%" ? "%" : undefined,
      badge: unit === "%" ? "percent" : "dollar",
      accent: "green",
      type: "tiered",
      tiers: [
        { label: "Up to BRL 1M", value: 0 },
        { label: "BRL 1M – 50M", value: 0 },
        { label: "Above BRL 50M", value: 0 },
      ],
    };
    onChange({ mode: "custom", cards: [...pricing.cards, card] });
  }
  const removedDeckCards = deck.cards.filter((dc) => !pricing.cards.some((c) => c.key === dc.key));

  const modeCaption: Record<PricingMode, string> = {
    deck: `Values come straight from the ${proposalType === "standard" ? "Standard" : "Brazil-market"} deck. Edit any field and it becomes Custom.`,
    custom: "Everything is editable: rates, band labels, tier count, flat rates, or free text (the Aa toggle) per band.",
  };

  /** Numeric-or-text rate box, shared by tier rows and the flat field. */
  function rateBox(card: PriceCard, opts: {
    k: string;
    value: number;
    text: string | null | undefined;
    onValue: (n: number) => void;
    onText: (s: string | null) => void;
    ariaLabel: string;
    wide?: boolean;
  }) {
    const textMode = opts.text != null;
    return (
      <span className={`flex items-center gap-1 ${opts.wide ? "flex-1" : ""}`}>
        <span
          className={`flex items-center gap-1 rounded-[7px] border border-hairline-control bg-surface-input px-2 py-[5px] transition duration-150 ease-ds ${
            opts.wide ? "flex-1" : textMode ? "w-[126px]" : "w-[92px]"
          } focus-within:border-hairline-selected`}
        >
          {!textMode && card.prefix && <span className="font-mono text-[11px] text-muted">{card.prefix.trim()}</span>}
          {textMode ? (
            <input
              value={opts.text ?? ""}
              onChange={(e) => opts.onText(e.target.value)}
              placeholder="Included"
              aria-label={`${opts.ariaLabel}, as text`}
              className="w-full bg-transparent font-mono text-xs font-medium text-title outline-none placeholder:text-muted"
            />
          ) : (
            <input
              value={display(opts.k, opts.value)}
              onChange={(e) => edit(opts.k, e.target.value, opts.onValue)}
              onBlur={() => settle(opts.k)}
              inputMode="decimal"
              aria-label={opts.ariaLabel}
              className={`w-full bg-transparent font-mono text-xs font-medium outline-none ${readOnly ? "text-subtitle" : "text-title"}`}
            />
          )}
          {!textMode && card.suffix && <span className="font-mono text-[11px] text-muted">{card.suffix.trim()}</span>}
        </span>
        <button
          onClick={() => {
            settle(opts.k);
            opts.onText(textMode ? null : "");
          }}
          title={textMode ? "Back to a numeric rate" : "Write the rate as text"}
          aria-label={textMode ? `${opts.ariaLabel}: switch to number` : `${opts.ariaLabel}: switch to text`}
          className={`rounded-[5px] border px-1 py-[3px] font-mono text-[9px] font-medium transition duration-150 ease-ds ${
            textMode
              ? "border-hairline-selected text-mint"
              : "border-hairline-control text-[#8b948f] hover:text-title"
          }`}
        >
          Aa
        </button>
      </span>
    );
  }

  function renderCard(card: PriceCard) {
    const deckCard = deck.cards.find((c) => c.key === card.key);
    const edited = pricing.mode === "custom" && !cardEqualsDeck(card, deckCard);
    return (
      <div key={card.key} className="mb-[18px]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <input
            value={card.title}
            onChange={(e) => patchCard(card.key, { ...card, title: e.target.value })}
            aria-label="Product name"
            className="min-w-0 flex-1 rounded-[5px] border border-transparent bg-transparent px-1 py-[2px] font-mono text-[10px] font-medium uppercase tracking-[.1em] text-mint-muted outline-none transition duration-150 ease-ds hover:border-hairline-control focus:border-hairline-selected focus:bg-surface-input focus:text-title"
          />
          <span className="flex shrink-0 gap-[2px] rounded-[7px] border border-hairline-card bg-surface-input p-[2px]">
            {(["tiered", "flat"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(card, t)}
                className={`rounded-[5px] px-2 py-[3px] text-[9.5px] transition duration-150 ease-ds ${
                  card.type === t ? "bg-mint font-semibold text-mint-on" : "font-medium text-[#8b948f] hover:text-title"
                }`}
              >
                {t === "tiered" ? "Tiered" : "Flat"}
              </button>
            ))}
          </span>
          <button
            onClick={() => removeCard(card.key)}
            title="Remove this product from the offer"
            aria-label={`Remove ${card.title}`}
            className="shrink-0 rounded-[5px] px-1 text-[13px] leading-none text-[#5a655f] transition duration-150 ease-ds hover:text-[#d99a9a]"
          >
            ×
          </button>
        </div>

        {card.type === "tiered" ? (
          <div className="flex flex-col gap-1.5">
            {card.tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={tier.label}
                  onChange={(e) => patchTier(card, i, { label: e.target.value })}
                  aria-label={`${card.title}, band ${i + 1} label`}
                  className={`min-w-0 flex-1 rounded-[7px] border border-transparent bg-transparent px-1.5 py-[5px] text-[11.5px] outline-none transition duration-150 ease-ds hover:border-hairline-control focus:border-hairline-selected focus:bg-surface-input ${
                    readOnly ? "text-[#8b948f]" : "text-node-text"
                  }`}
                />
                {rateBox(card, {
                  k: `${card.key}-${i}`,
                  value: tier.value,
                  text: tier.text,
                  onValue: (n) => patchTier(card, i, { value: n }),
                  onText: (s) => patchTier(card, i, { text: s }),
                  ariaLabel: `${card.title}, ${tier.label}`,
                })}
                <button
                  onClick={() => deleteTier(card, i)}
                  disabled={card.tiers.length <= 1}
                  title="Delete this tier"
                  aria-label={`Delete ${card.title} band ${i + 1}`}
                  className="rounded-[5px] px-1 text-[13px] leading-none text-[#5a655f] transition duration-150 ease-ds hover:text-title disabled:cursor-default disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => addTier(card)}
              className="self-start rounded-[7px] border border-dashed border-hairline-control px-2 py-[4px] text-[10.5px] font-medium text-[#8b948f] transition duration-150 ease-ds hover:border-hairline-selected hover:text-title"
            >
              + Add tier
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center gap-1">
              {rateBox(card, {
                k: `${card.key}-flat`,
                value: card.flat ?? 0,
                text: card.flatText,
                onValue: (n) => patchCard(card.key, { ...card, flat: n }),
                onText: (s) => patchCard(card.key, { ...card, flatText: s }),
                ariaLabel: `${card.title}, flat`,
                wide: true,
              })}
            </div>
            <p className="text-[10.5px] leading-normal text-muted">
              One flat rate across all volumes. Switch to Tiered for volume bands.
            </p>
          </div>
        )}

        {edited && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-mint">
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-mint" />
            <span>
              Edited from the deck ·{" "}
              <button onClick={() => resetCard(card)} className="underline transition hover:text-mint-hover">
                reset
              </button>
            </span>
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
        <div className="mb-3 grid grid-cols-2 gap-[3px] rounded-[10px] border border-hairline-card bg-surface-input p-[3px]">
          {(
            [
              ["deck", "From deck"],
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

        {pricing.cards.map(renderCard)}

        {proposalType === "brazil-market" && (
          <div className="mb-[18px] rounded-lg border border-dashed border-hairline-control p-2.5">
            <div className="mb-1.5 font-mono text-[9.5px] font-medium tracking-[.12em] text-mint-muted">ADD A PRODUCT GROUP</div>
            <div className="flex flex-wrap gap-1.5">
              {removedDeckCards.map((dc) => (
                <button
                  key={dc.key}
                  onClick={() => restoreCard(dc.key)}
                  className="rounded-full border border-hairline-control px-2.5 py-1 text-[10.5px] font-medium text-[#8b948f] transition duration-150 ease-ds hover:border-mint/40 hover:text-title"
                >
                  ↺ {dc.title}
                </button>
              ))}
              {(["%", "R$", "$"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => addNewCard(u)}
                  className="rounded-full border border-hairline-minted bg-mint/5 px-2.5 py-1 text-[10.5px] font-medium text-mint transition duration-150 ease-ds hover:bg-mint/10"
                >
                  ＋ New ({u})
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-muted">
              Removed products drop their page from the PDF; new ones get their own rendered page. Click a product&apos;s name to rename it.
            </p>
          </div>
        )}

        {proposalType === "standard" && (
          <>
            <div className="mb-2 font-mono text-[10px] font-medium tracking-[.1em] text-[#3f4a45]">ON/OFF-RAMP · BPS</div>
            <div className="mb-[18px] rounded-lg border border-dashed border-hairline-control bg-[#0c110e] px-3 py-[9px] text-[11.5px] text-[#4a5651]">
              Not in the Standard proposal
            </div>
          </>
        )}

        <div className="border-t border-hairline-row pt-3.5">
          <p className="mb-2.5 text-[10.5px] leading-normal text-muted">
            These rates drive the client&apos;s <b className="font-semibold text-[#8b948f]">Pricing view</b> and the downloadable PDF
            {proposalType === "brazil-market" ? " (an edited product re-renders its own deck page)" : ""}.
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
