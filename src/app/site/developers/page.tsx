"use client";
import { useState } from "react";
import { Eyebrow, GhostBtn, GlassPanel, PrimaryBtn, Reveal, Scene, SiteShell } from "../_ui";

// tracefinance.com/developers, one-for-one in the glass family: hero with the
// status pill, the tabbed terminal, the four-resource API surface, the
// three-step quickstart, and the closing CTA.

const TABS = ["beneficiary", "quote", "withdrawal", "track"] as const;

const TAB_CODE: Record<(typeof TABS)[number], React.ReactNode> = {
  beneficiary: (
    <>
      <span className="text-muted"># Register a beneficiary + PIX payment instruction</span>{"\n"}
      <span className="text-title">POST</span> <span className="text-cyan2">/api/beneficiaries</span>{"\n"}
      {"curl -X POST https://api.sandbox.tracefinance.com/api/beneficiaries \\\n"}
      {"  -H "}<span className="text-mint">&apos;Authorization: Bearer &lt;token&gt;&apos;</span>{" \\\n"}
      {"  -H "}<span className="text-mint">&apos;X-Idempotency-Key: &lt;unique-key&gt;&apos;</span>{" \\\n"}
      {"  -d '{\n"}
      {"    \"entity\": { \"type\": "}<span className="text-mint">&quot;INDIVIDUAL&quot;</span>{", \"firstName\": "}<span className="text-mint">&quot;John&quot;</span>{", \"lastName\": "}<span className="text-mint">&quot;Doe&quot;</span>{",\n"}
      {"                \"taxId\": { \"value\": "}<span className="text-mint">&quot;12345678901&quot;</span>{", \"type\": "}<span className="text-mint">&quot;CPF&quot;</span>{" } },\n"}
      {"    \"relationshipType\": "}<span className="text-mint">&quot;THIRD_PARTY&quot;</span>{",\n"}
      {"    \"paymentInstruction\": { \"rail\": "}<span className="text-mint">&quot;PIX_KEY&quot;</span>{", \"asset\": "}<span className="text-mint">&quot;BRL&quot;</span>{",\n"}
      {"                            \"dictKeyType\": "}<span className="text-mint">&quot;CPF&quot;</span>{", \"dictKey\": "}<span className="text-mint">&quot;12345678901&quot;</span>{" } }'\n"}
      <span className="text-muted"># instruction starts PENDING_REVIEW, then the</span>{"\n"}
      <span className="text-muted"># …PAYMENT_INSTRUCTION_APPROVED webhook fires</span>
    </>
  ),
  quote: (
    <>
      <span className="text-muted"># Lock an FX rate for a short window</span>{"\n"}
      <span className="text-title">POST</span> <span className="text-cyan2">/api/quotes</span>{"\n"}
      {"{ \"sourceAsset\": "}<span className="text-mint">&quot;BRL&quot;</span>{", \"targetAsset\": "}<span className="text-mint">&quot;USDC&quot;</span>{",\n"}
      {"  \"sourceAmount\": "}<span className="text-mint">&quot;250000.00&quot;</span>{" }\n"}
      <span className="text-muted"># =&gt; {"{"} &quot;effectiveRate&quot;: &quot;5.0863&quot;, &quot;expiresAt&quot;: … {"}"}</span>
    </>
  ),
  withdrawal: (
    <>
      <span className="text-muted"># Send funds to an approved beneficiary</span>{"\n"}
      <span className="text-title">POST</span> <span className="text-cyan2">/api/operations/withdrawal</span>{"\n"}
      {"{ \"quoteId\": "}<span className="text-mint">&quot;&lt;quote-id&gt;&quot;</span>{",\n"}
      {"  \"beneficiary\": { \"mode\": "}<span className="text-mint">&quot;REFERENCE&quot;</span>{", \"id\": "}<span className="text-mint">&quot;&lt;beneficiary-id&gt;&quot;</span>{" } }\n"}
      <span className="text-muted"># =&gt; 201 · REQUESTED — OPERATION_COMPLETED webhook follows</span>
    </>
  ),
  track: (
    <>
      <span className="text-muted"># Track an operation to its terminal state</span>{"\n"}
      <span className="text-title">GET</span> <span className="text-cyan2">/api/operations/{"{operationId}"}</span>{"\n"}
      <span className="text-muted"># =&gt; PROCESSING, ON_HOLD, COMPLETED, FAILED with reason</span>
    </>
  ),
};

const RESOURCES: [string, string, string][] = [
  ["POST", "/api/beneficiaries", "Register a beneficiary and its payment instructions — PIX, bank account or crypto wallet"],
  ["POST", "/api/quotes", "Lock an FX rate (or 1:1 spot) for a short window, bound to one account"],
  ["POST", "/api/operations/withdrawal", "Send funds to an approved beneficiary — returns 201 with status REQUESTED"],
  ["GET", "/api/operations/{operationId}", "Operation status — PROCESSING, ON_HOLD, COMPLETED, FAILED with reason"],
];

export default function DevelopersPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("beneficiary");
  return (
    <SiteShell active="developers">
      {/* ── hero + terminal ── */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pb-16 pt-16 md:grid-cols-[1fr_1.15fr] md:pt-20">
          <div className="tf-rise">
            <Eyebrow>Developers</Eyebrow>
            <h1 className="mt-5 font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.02em] text-title md:text-[52px]">
              Ship LatAm payments <em className="not-italic text-mint">this sprint.</em>
            </h1>
            <p className="mt-5 max-w-[480px] text-[15px] leading-relaxed text-subtitle">
              REST APIs for accounts, quotes and payments. Sandbox keys in minutes, idempotent by default, webhooks for
              every state change.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <PrimaryBtn href="https://tracefinance.mintlify.app/">Read the docs</PrimaryBtn>
              <GhostBtn href="https://tracefinance.mintlify.app/api-reference">API reference</GhostBtn>
            </div>
            <a href="https://status.tracefinance.com/" className="mt-6 inline-flex items-center gap-2 rounded-full border border-mint/30 bg-[#0c1410]/70 px-3.5 py-1.5 font-jbmono text-[10.5px] text-mint">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> All systems operational
            </a>
          </div>

          <GlassPanel className="tf-rise overflow-hidden" style={{ borderRadius: 18, animationDelay: ".12s" }}>
            <div className="flex items-center gap-1 border-b border-white/10 px-3 py-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3 py-1.5 font-jbmono text-[11px] transition ${tab === t ? "bg-white/10 font-semibold text-mint" : "text-muted hover:text-subtitle"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <pre className="min-h-[300px] overflow-x-auto px-5 py-4 font-jbmono text-[11.5px] leading-[1.8] text-subtitle">
              {TAB_CODE[tab]}
            </pre>
          </GlassPanel>
        </div>
      </section>

      {/* ── api surface ── */}
      <Scene id="api-surface" n="01" label="API surface" band>
        <div className="mx-auto max-w-[1200px] px-5 pb-14 pt-9">
          <h2 className="font-display text-[30px] font-semibold tracking-[-0.015em] text-title md:text-[38px]">
            Four resources. No surprises.
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-white/10">
            {RESOURCES.map(([m, path, desc], i) => (
              <div key={path} className={`grid gap-2 px-6 py-4.5 md:grid-cols-[70px_300px_1fr] md:items-center ${i ? "border-t border-white/[.07]" : ""} bg-[#0a0f0d]/50 py-4`}>
                <span className={`font-jbmono text-[11.5px] font-bold ${m === "GET" ? "text-cyan2" : "text-mint"}`}>{m}</span>
                <span className="font-jbmono text-[12.5px] text-title">{path}</span>
                <span className="text-[13px] text-subtitle">{desc}</span>
              </div>
            ))}
          </div>
          <a href="https://tracefinance.mintlify.app/journeys/withdrawal" className="mt-6 inline-block text-[13.5px] font-semibold text-mint hover:text-mint-hover">
            Follow the full withdrawal journey in the docs →
          </a>
        </div>
      </Scene>

      {/* ── quickstart ── */}
      <Scene id="quickstart" n="02" label="Quickstart">
        <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-9">
          <h2 className="font-display text-[30px] font-semibold tracking-[-0.015em] text-title md:text-[38px]">Live in three steps</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                n: "1",
                t: "Get sandbox keys",
                d: (
                  <>Sign up and generate keys from the dashboard. The sandbox mirrors production at <code className="font-jbmono text-[11.5px] text-cyan2">api.sandbox.tracefinance.com</code> — same endpoints, simulated settlement.</>
                ),
              },
              {
                n: "2",
                t: "Lock a quote, send a withdrawal",
                d: (
                  <>One <code className="font-jbmono text-[11.5px] text-cyan2">POST /api/quotes</code> locks the rate; <code className="font-jbmono text-[11.5px] text-cyan2">POST /api/operations/withdrawal</code> sends it. Pass <code className="font-jbmono text-[11.5px] text-cyan2">X-Idempotency-Key</code> to make retries safe.</>
                ),
              },
              {
                n: "3",
                t: "Listen for webhooks",
                d: (
                  <>Subscribe to <code className="font-jbmono text-[11.5px] text-cyan2">OPERATION_COMPLETED</code> and <code className="font-jbmono text-[11.5px] text-cyan2">OPERATION_FAILED</code> for terminal states; <code className="font-jbmono text-[11.5px] text-cyan2">currentState.reason</code> carries the cause on failure.</>
                ),
              },
            ].map((s) => (
              <div key={s.n} className="glass-card rounded-2xl px-6 py-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-mint/40 font-jbmono text-[13px] font-bold text-mint">{s.n}</span>
                <h3 className="mt-4 text-[16px] font-semibold text-title">{s.t}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-subtitle">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </Scene>

      {/* ── closing ── */}
      <section className="relative z-10">
        <Reveal>
          <div className="mx-auto max-w-[720px] px-5 pb-24 pt-10 text-center">
            <h2 className="font-display text-[32px] font-semibold tracking-[-0.02em] text-title md:text-[42px]">Start building today</h2>
            <p className="mx-auto mt-4 max-w-[480px] text-[14.5px] leading-relaxed text-subtitle">
              Full documentation, sandbox environment and a team of engineers on the other side of the integration.
            </p>
            <div className="mt-8 flex justify-center gap-3.5">
              <PrimaryBtn href="https://tracefinance.mintlify.app/">Read the documentation</PrimaryBtn>
              <GhostBtn href="/site/contact">Talk to an engineer</GhostBtn>
            </div>
          </div>
        </Reveal>
      </section>
    </SiteShell>
  );
}
