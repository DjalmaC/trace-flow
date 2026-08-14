"use client";
import { GhostBtn, GlassPanel, PrimaryBtn, Reveal, SiteShell } from "../_ui";
import { SERIES_A_BODY } from "../_content";

// tracefinance.com/series-a, one-for-one in the glass family: the $32M hero,
// the four stat tiles, the investor / founders-of logo rows, and the full
// press release (verbatim), with the About section closing it out.

const INVESTORS: [string, string][] = [
  ["circle.png", "Circle"],
  ["haun.webp", "Haun Ventures"],
  ["HOF.png", "HOF Capital"],
  ["jump.svg", "Jump Crypto"],
  ["mantis.png", "Mantis"],
  ["paxos.png", "Paxos"],
  ["stellar.png", "Stellar"],
  ["valor.png", "Valor Capital"],
];
const FOUNDERS_OF: [string, string][] = [
  ["BVNK.png", "BVNK"],
  ["circle.png", "Circle"],
  ["MESH.png", "Mesh"],
  ["sardine.png", "Sardine"],
  ["SOLANA.png", "Solana"],
];

const STATS: { big: React.ReactNode; sub: string }[] = [
  { big: <>$32<em className="not-italic text-mint">M</em></>, sub: "Series A, led by CoinFund" },
  { big: <>$10<em className="not-italic text-mint">B+</em></>, sub: "Cross-border volume processed" },
  { big: <em className="not-italic text-mint">#1</em>, sub: "Provider to the 4 largest global payments companies in LatAm" },
  { big: <>5<em className="not-italic text-mint">+</em></>, sub: "Regulated markets: US, Brazil, LatAm, APAC & beyond" },
];

/** The press-release body: quotes render as mint-ruled blockquotes with their
 *  attribution; the deck line (first paragraph) gets the italic treatment. */
function Body() {
  const blocks = SERIES_A_BODY.filter((b) => b.text !== "PRESS RELEASE");
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b, i) => {
        if (b.tag === "h2")
          return (
            <h2 key={i} className="mt-4 font-display text-[24px] font-semibold tracking-[-0.01em] text-title">
              {b.text}
            </h2>
          );
        const isQuote = b.text.startsWith("“");
        const isAttribution = /,\s(co-founder|partner)/.test(b.text) && b.text.length < 120;
        if (isQuote)
          return (
            <blockquote key={i} className="border-l-2 border-mint/70 pl-5 text-[15px] italic leading-relaxed text-title/90">
              {b.text}
            </blockquote>
          );
        if (isAttribution)
          return (
            <p key={i} className="pl-5 font-jbmono text-[11.5px] uppercase tracking-[0.16em] text-[#6f8a7f]">
              — {b.text}
            </p>
          );
        if (i === 0)
          return (
            <p key={i} className="border-l-2 border-mint/70 pl-5 text-[16px] italic leading-relaxed text-title/90">
              {b.text}
            </p>
          );
        return (
          <p key={i} className="text-[14.5px] leading-[1.8] text-subtitle">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

export default function SeriesAPage() {
  return (
    <SiteShell>
      {/* ── hero ── */}
      <section className="relative z-10 overflow-hidden">
        <div className="mx-auto max-w-[900px] px-5 pb-14 pt-16 text-center md:pt-20">
          <p className="tf-rise flex items-center justify-center gap-4 font-jbmono text-[10.5px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
            <span aria-hidden className="h-px w-8 bg-white/20" />
            Press release · New York · June 17, 2026
            <span aria-hidden className="h-px w-8 bg-white/20" />
          </p>
          <div
            className="tf-rise mt-6 font-display text-[120px] font-bold leading-none tracking-[-0.03em] md:text-[180px]"
            style={{
              backgroundImage: "linear-gradient(180deg, #bffbe4 0%, #00f2b1 55%, #0a8f6c 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 0 90px rgba(0,242,177,.18)",
            }}
          >
            $32M
          </div>
          <p className="tf-rise mt-3 font-jbmono text-[10.5px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
            Raised to scale global payments infrastructure
          </p>
          <h1 className="tf-rise mx-auto mt-8 max-w-[760px] font-display text-[30px] font-semibold leading-[1.18] tracking-[-0.015em] text-title md:text-[38px]">
            Trace Finance raises a <span className="text-mint">$32M Series A</span> led by CoinFund to scale global
            payments infrastructure across the U.S. and emerging markets.
          </h1>
          <p className="tf-rise mx-auto mt-5 max-w-[620px] text-[14.5px] leading-relaxed text-subtitle">
            With more than $10 billion in cross-border volume processed, Trace is expanding the infrastructure the
            world&apos;s largest technology and payments companies use to connect emerging markets to global FX settlement.
          </p>
          <div className="tf-rise mt-9 flex justify-center gap-3.5">
            <PrimaryBtn href="#announcement">Read the announcement</PrimaryBtn>
            <GhostBtn href="/site/contact">Talk to us</GhostBtn>
          </div>
        </div>
      </section>

      {/* ── stats ── */}
      <section className="relative z-10">
        <Reveal>
          <div className="mx-auto grid max-w-[1200px] gap-5 px-5 pb-6 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={i} className="glass-card rounded-2xl px-6 py-7 text-center">
                <div className="font-jbmono text-[30px] font-bold tracking-tight text-title">{s.big}</div>
                <div className="mt-2 text-[12.5px] leading-snug text-subtitle">{s.sub}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── backers ── */}
      <section className="relative z-10 mt-10 border-y border-white/[.08]" style={{ background: "linear-gradient(rgba(3,6,5,.6), rgba(3,6,5,.42))" }}>
        <Reveal>
          <div className="mx-auto max-w-[1100px] px-5 py-12 text-center">
            <p className="font-jbmono text-[10.5px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">Backed by</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/site-investors/coin-fund.png" alt="CoinFund" className="mx-auto mt-6 h-9 w-auto opacity-80 md:h-10" />
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {INVESTORS.map(([f, alt]) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={`/assets/site-investors/${f}`} alt={alt} className="h-6 w-auto max-w-[130px] object-contain opacity-60 md:h-7" />
              ))}
            </div>
            <p className="mt-12 font-jbmono text-[10.5px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">Backed by founders of</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {FOUNDERS_OF.map(([f, alt]) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={`/assets/site-founders/${f}`} alt={alt} className="h-6 w-auto max-w-[130px] object-contain opacity-60 md:h-7" />
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── the press release ── */}
      <section id="announcement" className="relative z-10 scroll-mt-28">
        <Reveal>
          <div className="mx-auto max-w-[820px] px-5 py-16">
            <p className="mb-8 flex items-center gap-3 font-jbmono text-[11px] font-medium uppercase tracking-[0.34em] text-mint">
              <span aria-hidden className="h-px w-6 bg-mint/70" />
              Press release
            </p>
            <GlassPanel className="px-8 py-10 md:px-12">
              <Body />
            </GlassPanel>
            <div className="mt-10 flex justify-center gap-3.5">
              <PrimaryBtn href="/site/contact">Talk to us</PrimaryBtn>
              <GhostBtn href="/site">Back to the site</GhostBtn>
            </div>
          </div>
        </Reveal>
      </section>
    </SiteShell>
  );
}
