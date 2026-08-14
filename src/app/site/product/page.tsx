"use client";
import { GhostBtn, GlassPanel, PageHero, Reveal, SiteShell } from "../_ui";

// tracefinance.com/product, one-for-one in the glass family: the three
// primitives as numbered glass cards with icon, copy and feature bullets.

function CardIcon({ kind }: { kind: "accounts" | "ramp" | "payments" }) {
  const stroke = "#00f2b1";
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-mint/25 bg-[#0c1410]/80">
      {kind === "accounts" ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20" />
        </svg>
      ) : kind === "ramp" ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h13M14 4l3 3-3 3M20 17H7M10 14l-3 3 3 3" />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20" />
        </svg>
      )}
    </span>
  );
}

const CARDS: { n: string; icon: "accounts" | "ramp" | "payments"; title: string; copy: string; bullets: string[] }[] = [
  {
    n: "01",
    icon: "accounts",
    title: "Multi-currency accounts",
    copy: "Named and virtual accounts in BRL, USD and EUR, opened through the API. Real-time balances, built-in FX.",
    bullets: ["Local accounts in LatAm, the US and Europe", "Real-time balance tracking", "FX dashboard and conversion API"],
  },
  {
    n: "02",
    icon: "ramp",
    title: "Stablecoin on/off-ramp",
    copy: "BRL to USDC and back, in under a minute, powered by PIX. Deep liquidity at institutional volumes.",
    bullets: ["Sub-minute settlement, 24/7", "Multi-source routing for best execution", "Rate lock on every order"],
  },
  {
    n: "03",
    icon: "payments",
    title: "Cross-border payments",
    copy: "Pay suppliers and teams on local rails — PIX, SPEI, ACH and SEPA. Run multi-currency treasury and reconcile every flow from one place.",
    bullets: ["15+ countries, local payment methods", "Third-party payments with full KYC", "24/7 price lock on cross-border orders"],
  },
];

export default function ProductPage() {
  return (
    <SiteShell active="product">
      <PageHero
        eyebrow="Product"
        title="Everything you need to operate in LatAm"
        sub="Accounts, conversion and payments — three primitives that compose into complete payment infrastructure."
        cta={<GhostBtn href="/site/contact">Get in touch</GhostBtn>}
      />
      <section className="relative z-10">
        <Reveal>
          <div className="mx-auto grid max-w-[1200px] gap-6 px-5 pb-24 pt-4 md:grid-cols-3">
            {CARDS.map((c) => (
              <GlassPanel key={c.n} className="px-7 py-8" style={{ borderRadius: 22 }}>
                <div className="flex items-start justify-between">
                  <CardIcon kind={c.icon} />
                  <span className="font-jbmono text-[12px] font-bold text-mint">{c.n}</span>
                </div>
                <h3 className="mt-6 font-display text-[21px] font-semibold tracking-[-0.01em] text-title">{c.title}</h3>
                <p className="mt-3 text-[13.5px] leading-relaxed text-subtitle">{c.copy}</p>
                <ul className="mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-5 text-[13px] text-subtitle">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full bg-mint" />
                      {b}
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            ))}
          </div>
        </Reveal>
      </section>
    </SiteShell>
  );
}
