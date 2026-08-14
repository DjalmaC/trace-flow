"use client";
import { useState } from "react";
import { Eyebrow, GlassPanel, SiteShell } from "../_ui";

// tracefinance.com/contact, one-for-one in the glass family: the split hero
// (copy + three-step process on the left, the demo-request form on the right).

const COMPANY_TYPES = [
  "Payment Service Provider",
  "Bank",
  "Non-Bank Financial Institution",
  "Global fintech",
  "Crypto exchange",
  "International business",
  "Trading firm",
  "Web3 company",
  "Other",
];
const VOLUMES = ["Under US$ 1M", "US$ 1M – 10M", "US$ 10M – 50M", "Over US$ 50M"];
const CORRIDORS = ["Brazil ⇄ US", "Brazil ⇄ Europe", "Brazil ⇄ APAC", "Mexico ⇄ US", "Multiple LatAm corridors", "Other / not sure yet"];

const inputCls =
  "w-full rounded-[11px] border border-white/12 bg-[#0a0f0d]/70 px-3.5 py-2.5 text-[13.5px] text-title outline-none transition placeholder:text-muted/70 focus:border-mint/50";
const labelCls = "mb-1.5 block text-[12px] font-medium text-subtitle";

function Select({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={`${inputCls} appearance-none`} defaultValue={options[0]}>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#0d1210] text-title">
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <SiteShell active="contact">
      <section className="relative z-10">
        <div className="mx-auto grid max-w-[1200px] items-start gap-12 px-5 pb-24 pt-16 md:grid-cols-[1fr_1.05fr] md:pt-20">
          {/* ── left: copy + process ── */}
          <div className="tf-rise">
            <Eyebrow>Contact</Eyebrow>
            <h1 className="mt-5 font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] text-title md:text-[50px]">
              Talk to the team that ships
            </h1>
            <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-subtitle">
              Tell us about your volumes and corridors. A payments specialist — not a sales sequence — replies within one
              business day.
            </p>
            <ul className="mt-9 flex flex-col gap-5">
              {[
                ["01", "Scoping call.", "We map your flows: currencies, rails, volumes, counterparties."],
                ["02", "Sandbox access.", "Your engineers get keys and a guided integration plan."],
                ["03", "Go live.", "Compliance onboarding runs in parallel — most clients launch in days."],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-4">
                  <span className="font-jbmono text-[12px] font-bold text-mint">{n}</span>
                  <p className="text-[13.5px] leading-relaxed text-subtitle">
                    <strong className="font-semibold text-title">{t}</strong> {d}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* ── right: the form ── */}
          <GlassPanel className="tf-rise px-7 py-8" style={{ borderRadius: 22, animationDelay: ".12s" }}>
            {sent ? (
              <div className="py-10 text-center">
                <h3 className="font-display text-[24px] font-semibold text-title">Request received</h3>
                <p className="mx-auto mt-3 max-w-[380px] text-[13.5px] leading-relaxed text-subtitle">
                  A payments specialist will reach out within one business day. Meanwhile, your engineers can explore the{" "}
                  <a href="/site/developers" className="font-semibold text-mint hover:text-mint-hover">API documentation</a>.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
                className="grid gap-4 sm:grid-cols-2"
              >
                <div>
                  <label className={labelCls}>Full name <span className="text-mint">*</span></label>
                  <input required placeholder="Ana Souza" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Work email <span className="text-mint">*</span></label>
                  <input required type="email" placeholder="ana@company.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Company <span className="text-mint">*</span></label>
                  <input required placeholder="Company name" className={inputCls} />
                </div>
                <Select label="Company type" options={COMPANY_TYPES} />
                <Select label="Expected monthly volume" options={VOLUMES} />
                <Select label="Main corridor" options={CORRIDORS} />
                <div className="sm:col-span-2">
                  <label className={labelCls}>What are you building?</label>
                  <textarea rows={4} placeholder="e.g. BRL on/off-ramp for our exchange users, payouts to Brazilian suppliers…" className={`${inputCls} resize-none`} />
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted sm:col-span-1">
                  By submitting you agree to our{" "}
                  <a href="/site/terms-of-service" className="underline decoration-white/30 hover:text-subtitle">terms of service</a> and{" "}
                  <a href="/site/privacy-policy" className="underline decoration-white/30 hover:text-subtitle">privacy policy</a>.
                </p>
                <div className="flex items-end justify-end">
                  <button type="submit" className="inline-flex items-center gap-2 rounded-[12px] bg-mint px-5 py-3 text-[14px] font-semibold text-mint-on transition hover:bg-mint-hover" style={{ boxShadow: "0 12px 32px rgba(0,242,177,.22)" }}>
                    Request a demo
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                </div>
              </form>
            )}
          </GlassPanel>
        </div>
      </section>
    </SiteShell>
  );
}
