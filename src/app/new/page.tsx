"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ProposalSetup, ProposalType, TraceRep } from "@/flow-tool/data/schema";
import { normalizeLogo } from "@/flow-tool/lib/logo";

// Logo treatment for the dark canvas: Auto (decide), White/Mint (force recolor
// of a one-colour mark), Card (keep brand colours on a white chip).
type Treatment = "auto" | "white" | "mint" | "card";
import { defaultProposalDate, saveSetup } from "@/flow-tool/lib/setup";
import { loadRep } from "@/flow-tool/lib/rep-session";

const PROPOSALS: { value: ProposalType; title: string; tag: string; blurb: string }[] = [
  {
    value: "standard",
    title: "Standard proposal",
    tag: "Cross-border · USDC ↔ BRL",
    blurb: "Payins & payouts into and out of Brazil. Tier-based Pix fee + FX spread at Bloomberg.",
  },
  {
    value: "brazil-market",
    title: "Brazil-market proposal",
    tag: "Brazilian-native companies",
    blurb: "The full local stack — non-resident account, PixInc, on/off-ramp and Pix pricing.",
  },
];

function defaultYearMonth(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function yearMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return defaultProposalDate();
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function NewProposalPage() {
  const router = useRouter();
  const [rep, setRep] = useState<TraceRep | null>(null);
  const [company, setCompany] = useState("");
  const [companyRep, setCompanyRep] = useState("");
  const [origLogo, setOrigLogo] = useState<string>();
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [logoPlate, setLogoPlate] = useState<"light" | "none">("none");
  const [treatment, setTreatment] = useState<Treatment>("auto");
  const [proposalType, setProposalType] = useState<ProposalType>("standard");
  const [ym, setYm] = useState(defaultYearMonth());

  // Identity comes from the login on "/". No rep → send them there to pick one.
  useEffect(() => {
    const r = loadRep();
    if (!r) router.replace("/");
    else setRep(r);
  }, [router]);

  // Re-run the normalizer on the original upload with the chosen treatment, so
  // switching White/Mint/Card is reversible and never compounds.
  async function applyTreatment(t: Treatment, base = origLogo) {
    if (!base) return;
    setTreatment(t);
    const r = await normalizeLogo(base, { mark: t === "card" ? "keep" : t });
    setLogoUrl(r.url);
    setLogoPlate(t === "card" ? "light" : r.plate);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result);
      setOrigLogo(raw);
      await applyTreatment("auto", raw); // cut bg + auto-decide on insert
    };
    reader.readAsDataURL(file);
  }

  function start() {
    const setup: ProposalSetup = {
      proposalType,
      date: yearMonthLabel(ym),
      traceRepId: rep?.id,
      company: company.trim(),
      companyRep: companyRep.trim() || undefined,
      companyLogoUrl: logoUrl,
      companyLogoPlate: logoPlate,
    };
    saveSetup(setup);
    router.push("/build");
  }

  const ready = company.trim().length > 0;

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden text-title"
      style={{ background: "radial-gradient(60% 55% at 50% 0%, #15392d55 0%, rgba(7,9,11,0) 70%), #07090b" }}
    >
      <div className="mx-auto w-full max-w-2xl px-5 py-14 md:py-20">
        <div className="mb-10 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/trace_logo.png" alt="" className="h-6 w-auto" />
            <span className="text-[15px] font-semibold">Trace Finance</span>
          </a>
          {rep && <span className="text-xs text-muted">as {rep.name}</span>}
        </div>

        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">New proposal</h1>
        <p className="mt-2 text-sm text-subtitle">
          Set this up before the call. You&apos;ll build the flow live with the client next.
        </p>

        <div className="mt-10 space-y-7">
          {/* Company */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Acme"
                className="w-full rounded-lg border border-node-stroke bg-node-fill px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-green-accent"
              />
            </Field>
            <Field label="Company representative" hint="Point of contact (optional)">
              <input
                value={companyRep}
                onChange={(e) => setCompanyRep(e.target.value)}
                placeholder="e.g. Victor Medeiros"
                className="w-full rounded-lg border border-node-stroke bg-node-fill px-3 py-2.5 text-sm outline-none placeholder:text-muted focus:border-green-accent"
              />
            </Field>
          </div>

          {/* Logo */}
          <Field label="Company logo">
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-node-stroke bg-node-fill px-3 py-2 text-xs font-medium text-subtitle transition hover:border-green-accent hover:text-title">
                {logoUrl ? "Replace logo" : "Upload logo"}
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
              </label>
              {logoUrl && (
                <span
                  className={`flex h-10 items-center rounded-md px-3 ${logoPlate === "light" ? "bg-white" : ""}`}
                  style={logoPlate === "light" ? undefined : { background: "radial-gradient(70% 70% at 50% 50%, #15392d 0%, #0b1714 75%)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="logo preview" className="h-7 w-auto max-w-[140px] object-contain" />
                </span>
              )}
            </div>
            {logoUrl && (
              <>
                <div className="mt-2 inline-flex gap-1 rounded-lg bg-node-fill p-1">
                  {([["auto", "Auto"], ["white", "White"], ["mint", "Mint"], ["card", "Card"]] as [Treatment, string][]).map(
                    ([t, label]) => (
                      <button
                        key={t}
                        onClick={() => applyTreatment(t)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                          treatment === t ? "bg-green-accent text-[#06120c]" : "text-subtitle hover:text-title"
                        }`}
                      >
                        {label}
                      </button>
                    ),
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted">
                  Background is removed automatically. <b className="text-subtitle">White</b>/<b className="text-subtitle">Mint</b> repaint a
                  one-colour mark so it reads on dark; <b className="text-subtitle">Card</b> keeps brand colours on a white chip.
                </p>
              </>
            )}
          </Field>

          {/* Proposal type */}
          <Field label="Proposal" hint="Locked in now so the client never sees you choose.">
            <div className="grid gap-3 sm:grid-cols-2">
              {PROPOSALS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setProposalType(p.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    proposalType === p.value
                      ? "border-green-accent bg-green-fill/40"
                      : "border-node-stroke bg-node-fill hover:border-leg"
                  }`}
                >
                  <div className="text-sm font-semibold text-title">{p.title}</div>
                  <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-green-accent">{p.tag}</div>
                  <div className="mt-2 text-xs leading-snug text-subtitle">{p.blurb}</div>
                </button>
              ))}
            </div>
          </Field>

          {/* Date — month + year, defaults to this month */}
          <Field label="Date" hint="Shown on the title slide.">
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className="rounded-lg border border-node-stroke bg-node-fill px-3 py-2.5 text-sm outline-none focus:border-green-accent [color-scheme:dark]"
            />
          </Field>
        </div>

        <button
          onClick={start}
          disabled={!ready}
          className="mt-10 w-full rounded-xl bg-green-accent px-4 py-3 text-sm font-semibold text-[#06120c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-8"
        >
          Build the flow live →
        </button>
        {!ready && <p className="mt-2 text-[11px] text-muted">Enter a company name to continue.</p>}
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</label>
        {hint && <span className="text-[11px] text-muted/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
