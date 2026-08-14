"use client";
import { GhostBtn, GlassPanel, PageHero, Reveal, SiteShell } from "../_ui";

// tracefinance.com/use-cases, one-for-one in the glass family.

const CASES = [
  {
    title: "International PSPs",
    copy: "Move your merchants' money in and out of LatAm. Offer PIX pay-in and pay-out with BRL settlement and compliance handled — through one API.",
  },
  {
    title: "Banks & non-bank financial institutions",
    copy: "Access local rails and multi-currency settlement under a regulated, audited framework — KYC, transaction monitoring and reporting built in.",
  },
  {
    title: "Global fintechs",
    copy: "Launch in Brazil without a local entity. Offer PIX payments and BRL accounts on our regulated infrastructure from day one.",
  },
];

const ALSO = ["Crypto exchanges", "International businesses", "Trading firms", "Web3 companies"];

export default function UseCasesPage() {
  return (
    <SiteShell active="use-cases">
      <PageHero
        eyebrow="Use cases"
        title="Built for the companies moving money into LatAm"
        sub="From exchanges processing millions in daily volume to fintechs launching in new markets."
        cta={<GhostBtn href="/site/contact">Talk to us</GhostBtn>}
      />
      <section className="relative z-10">
        <Reveal>
          <div className="mx-auto max-w-[1200px] px-5 pb-24 pt-4">
            <div className="grid gap-6 md:grid-cols-3">
              {CASES.map((c) => (
                <GlassPanel key={c.title} className="px-7 py-8" style={{ borderRadius: 22 }}>
                  <h3 className="font-display text-[20px] font-semibold leading-snug tracking-[-0.01em] text-title">{c.title}</h3>
                  <p className="mt-3.5 text-[13.5px] leading-relaxed text-subtitle">{c.copy}</p>
                </GlassPanel>
              ))}
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <span className="mr-2 font-jbmono text-[10.5px] font-medium uppercase tracking-[0.3em] text-[#6f8a7f]">Also serving</span>
              {ALSO.map((t) => (
                <span key={t} className="glass-card rounded-full px-4 py-1.5 text-[12.5px] text-subtitle">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </SiteShell>
  );
}
