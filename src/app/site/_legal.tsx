"use client";
import { Eyebrow, GlassPanel, Reveal, SiteShell } from "./_ui";
import { LEGAL_PAGES, type ProseBlock } from "./_content";

// Shared renderer for the three legal documents (terms, privacy, conduct):
// one-for-one text from the live site, set in the glass prose layout.
// Consecutive <li> blocks group into a bulleted list.

function Blocks({ body }: { body: ProseBlock[] }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (!list.length) return;
    out.push(
      <ul key={key} className="flex flex-col gap-2.5">
        {list.map((t, i) => (
          <li key={i} className="flex gap-3 text-[13.5px] leading-[1.75] text-subtitle">
            <span className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-mint" />
            <span className="min-w-0 whitespace-pre-line">{t}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  body.forEach((b, i) => {
    if (b.tag === "li") {
      list.push(b.text);
      return;
    }
    flush(`ul-${i}`);
    if (b.tag === "h2")
      out.push(
        <h2 key={i} className="mt-6 border-t border-white/10 pt-8 font-display text-[21px] font-semibold tracking-[-0.01em] text-title first:mt-0 first:border-0 first:pt-0">
          {b.text}
        </h2>,
      );
    else if (b.tag === "h3")
      out.push(
        <h3 key={i} className="mt-1 text-[15px] font-semibold text-title">
          {b.text}
        </h3>,
      );
    else if (b.tag === "h4")
      out.push(
        <h4 key={i} className="font-jbmono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f8a7f]">
          {b.text}
        </h4>,
      );
    else
      out.push(
        <p key={i} className="whitespace-pre-line text-[13.5px] leading-[1.8] text-subtitle">
          {b.text}
        </p>,
      );
  });
  flush("ul-end");
  return <div className="flex flex-col gap-4">{out}</div>;
}

export function LegalPage({ slug }: { slug: keyof typeof LEGAL_PAGES }) {
  const page = LEGAL_PAGES[slug];
  return (
    <SiteShell>
      <section className="relative z-10">
        <div className="mx-auto max-w-[820px] px-5 pb-24 pt-16 md:pt-20">
          <div className="tf-rise">
            <Eyebrow>Legal</Eyebrow>
            <h1 className="mt-5 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-title md:text-[42px]">
              {page.title}
            </h1>
            <p className="mt-4 font-jbmono text-[11px] uppercase tracking-[0.18em] text-[#6f8a7f]">{page.meta}</p>
          </div>
          <Reveal>
            <GlassPanel className="mt-10 px-7 py-9 md:px-10">
              <Blocks body={page.body} />
            </GlassPanel>
          </Reveal>
        </div>
      </section>
    </SiteShell>
  );
}
