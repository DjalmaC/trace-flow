"use client";
import { useEffect, useRef, useState } from "react";
import { GlassPanel, SilkBackdrop } from "@/flow-tool/components/Glass";

// ─────────────────────────────────────────────────────────────────────────────
// Shared chrome + atoms for the /site recreation of tracefinance.com (BRLT
// glass family, design-ref/STYLE.md): the announcement banner, nav, footer,
// buttons, chapter rules, reveals. Every subpage composes these so the whole
// site reads as one piece.
// ─────────────────────────────────────────────────────────────────────────────

export const EASE = "cubic-bezier(.4,0,.2,1)";
export const MINT = "#00f2b1";
export const CYAN = "#2be8d6";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 font-jbmono text-[11px] font-medium uppercase tracking-[0.34em] text-[#6f8a7f]">
      <span aria-hidden className="h-px w-6 bg-mint/70" />
      {children}
    </p>
  );
}

export function ArrowIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function PrimaryBtn({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-[12px] bg-mint px-5 py-3 text-[14px] font-semibold text-mint-on transition duration-200 hover:bg-mint-hover"
      style={{ boxShadow: "0 12px 32px rgba(0,242,177,.22)" }}
    >
      {children}
      <ArrowIcon />
    </a>
  );
}

export function GhostBtn({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-[12px] border border-white/[.16] px-5 py-3 text-[14px] font-semibold text-title transition duration-200 hover:border-white/30 hover:bg-white/[.05]"
      style={{
        background: "linear-gradient(160deg, rgba(10,15,19,.42), rgba(10,15,19,.28) 45%, rgba(10,15,19,.38))",
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
      }}
    >
      {children}
    </a>
  );
}

export function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={MINT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Rises in on first viewport entry (reduced-motion: shown immediately). */
export function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }),
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(28px)", transition: `opacity .75s ${EASE}, transform .75s ${EASE}` }}>
      {children}
    </div>
  );
}

/** A chapter: numbered rule on top, optional full-bleed darker band. */
export function Scene({ id, n, label, band = false, children }: { id: string; n: string; label: string; band?: boolean; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={`relative z-10 scroll-mt-28 ${band ? "border-y border-white/[.08]" : ""}`}
      style={band ? { background: "linear-gradient(rgba(3,6,5,.6), rgba(3,6,5,.42))" } : undefined}
    >
      <div className="mx-auto max-w-[1200px] px-5 pt-14">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2.5 rounded-full border border-white/12 bg-[#0a0f0d]/70 px-3.5 py-1.5 font-jbmono text-[10px] font-medium uppercase tracking-[0.3em]">
            <span className="text-mint">{n}</span>
            <span className="text-[#6f8a7f]">{label}</span>
          </span>
          <span aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(255,255,255,.16), transparent)" }} />
        </div>
      </div>
      <Reveal>{children}</Reveal>
    </section>
  );
}

// ── the shared banner + nav (one sticky unit) and footer ─────────────────────

export type NavKey = "product" | "use-cases" | "developers" | "contact" | null;

export function SiteHeader({ active = null }: { active?: NavKey }) {
  const [banner, setBanner] = useState(true);
  const item = (key: Exclude<NavKey, null>, label: string) => (
    <a href={`/site/${key}`} className={active === key ? "font-semibold text-title" : "transition hover:text-title"}>
      {label}
    </a>
  );
  return (
    <div className="sticky top-0 z-30">
      {banner && (
        <div className="relative border-b border-white/10 bg-[#0a120e]/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-3 px-5 py-2.5 text-[12.5px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            <span className="text-subtitle">
              <strong className="font-semibold text-mint">New</strong> — Trace raises a $32M Series A led by CoinFund.
            </span>
            <a href="/site/series-a" className="font-semibold text-mint hover:text-mint-hover">
              Read the announcement →
            </a>
            <button onClick={() => setBanner(false)} aria-label="Dismiss" className="absolute right-4 text-muted transition hover:text-title">
              ×
            </button>
          </div>
        </div>
      )}
      <header className="border-b border-white/10 bg-[#07090b]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3.5">
          <a href="/site" className="flex items-center">
            {/* the official lockup (mark + wordmark in the brand font) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/site-trace-logo.svg" alt="Trace" className="h-[24px] w-auto" />
          </a>
          <nav className="hidden items-center gap-7 text-[13.5px] text-subtitle md:flex">
            {item("product", "Product")}
            {item("use-cases", "Use cases")}
            {item("developers", "Developers")}
            {item("contact", "Contact")}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden items-center overflow-hidden rounded-[9px] border border-white/12 font-jbmono text-[11px] md:flex">
              <button className="bg-white/10 px-2.5 py-1.5 font-semibold text-title">EN</button>
              <button className="px-2.5 py-1.5 text-muted transition hover:text-subtitle">PT</button>
            </div>
            <PrimaryBtn href="/site/contact">Request a demo</PrimaryBtn>
          </div>
        </div>
      </header>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#07090b]/60 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/site-trace-logo.svg" alt="Trace" className="h-[20px] w-auto" />
          <p className="mt-3 max-w-[260px] text-[12.5px] leading-relaxed text-subtitle">
            Payments and stablecoin infrastructure for Brazil and Latin America.
          </p>
        </div>
        {[
          {
            h: "Product",
            links: [
              ["Multi-currency accounts", "/site/product"],
              ["Stablecoin on/off-ramp", "/site/product"],
              ["Cross-border payments", "/site/product"],
              ["Use cases", "/site/use-cases"],
            ],
          },
          {
            h: "Developers",
            links: [
              ["Documentation", "https://tracefinance.mintlify.app/"],
              ["API reference", "https://tracefinance.mintlify.app/api-reference"],
              ["API status", "https://status.tracefinance.com/"],
            ],
          },
          {
            h: "Company",
            links: [
              ["Contact", "/site/contact"],
              ["Terms of service", "/site/terms-of-service"],
              ["Privacy policy", "/site/privacy-policy"],
              ["Ethics channel", "https://tracefinance.becompliance.com/canal-etica/canal-denuncias"],
              ["Code of ethics and conduct", "/site/code-of-conduct"],
            ],
          },
        ].map((col) => (
          <div key={col.h}>
            <h4 className="font-jbmono text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6f8a7f]">{col.h}</h4>
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-subtitle">
              {col.links.map(([t, href]) => (
                <li key={t}>
                  <a href={href} className="transition hover:text-title">{t}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[.07]">
        <div className="mx-auto max-w-[1200px] px-5 py-6 text-[11.5px] leading-relaxed text-muted">
          © 2026 Trace Finance. All rights reserved. Trace Finance acts as a banking correspondent in partnership with
          financial institutions duly authorized by the Central Bank of Brazil, providing intermediation between clients
          and authorized institutions for foreign exchange and PIX operations.
        </div>
      </div>
    </footer>
  );
}

/** Page shell: silk + brand strip + banner/nav on top, footer below. */
export function SiteShell({ active = null, children }: { active?: NavKey; children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen text-title" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      <SilkBackdrop />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px]" style={{ background: `linear-gradient(90deg,${CYAN},${MINT})` }} />
      <SiteHeader active={active} />
      {children}
      <SiteFooter />
    </main>
  );
}

/** A page-title hero for subpages: eyebrow, display heading, support line. */
export function PageHero({ eyebrow, title, sub, cta }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; cta?: React.ReactNode }) {
  return (
    <section className="relative z-10">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-8 px-5 pb-10 pt-16 md:pt-20">
        <div className="tf-rise max-w-[640px]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 font-display text-[38px] font-semibold leading-[1.08] tracking-[-0.02em] text-title md:text-[48px]">{title}</h1>
          {sub && <p className="mt-5 max-w-[560px] text-[15px] leading-relaxed text-subtitle">{sub}</p>}
        </div>
        {cta}
      </div>
    </section>
  );
}

export { GlassPanel };
