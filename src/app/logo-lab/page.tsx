"use client";
import { useEffect, useState } from "react";
import { normalizeLogo, type MarkColor } from "@/flow-tool/lib/logo";
import { loadRepKey, saveRepKey } from "@/flow-tool/lib/rep-session";

// ─────────────────────────────────────────────────────────────────────────────
// Logo lab — a rep utility (and the proposal agent's workbench): run any logo
// through the product's real normalization pipeline (background keying, mark
// recolor, plate decision) and see every treatment on the dark deck before it
// goes anywhere near a client. Results are exposed on window.__logoLab so the
// /proposal-from-call skill can drive this page headlessly with the exact same
// code path a rep uses.
// ─────────────────────────────────────────────────────────────────────────────

type Treatment = "auto" | "white" | "mint" | "card";
const TREATMENTS: Treatment[] = ["auto", "white", "mint", "card"];

interface LabResult {
  treatment: Treatment;
  url: string;
  plate: "light" | "none";
  recolored: boolean;
  cut: boolean;
  needsModel: boolean;
}

declare global {
  interface Window {
    __logoLab?: { status: "idle" | "working" | "done" | "error"; results: LabResult[]; error?: string };
  }
}

export default function LogoLab() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [keyDraft, setKeyDraft] = useState("");
  const [source, setSource] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string>("");
  const [results, setResults] = useState<LabResult[]>([]);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");

  useEffect(() => setHasKey(!!loadRepKey()), []);
  useEffect(() => {
    window.__logoLab = { status, results };
  }, [status, results]);

  async function run(src: string) {
    setStatus("working");
    setResults([]);
    try {
      const out: LabResult[] = [];
      for (const t of TREATMENTS) {
        const mark: MarkColor = t === "card" ? "keep" : t;
        const r = await normalizeLogo(src, { mark });
        out.push({
          treatment: t,
          url: r.url,
          plate: t === "card" ? "light" : r.plate,
          recolored: r.recolored,
          cut: r.cut,
          needsModel: r.needsModel,
        });
      }
      setResults(out);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      setSource(raw);
      setSourceName(file.name);
      void run(raw);
    };
    reader.readAsDataURL(file);
  }

  if (hasKey === null) return null;
  if (!hasKey) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07090b] px-6 text-title">
        <div className="w-full max-w-sm rounded-2xl border border-hairline-card bg-surface-card2 p-6">
          <h1 className="mb-1 text-[16px] font-semibold">Logo lab</h1>
          <p className="mb-4 text-[12.5px] text-muted">Internal tool. Enter your rep password to continue.</p>
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Rep password"
            data-testid="lab-key"
            className="mb-3 w-full rounded-lg border border-hairline-control bg-surface-input px-3 py-2.5 text-sm outline-none focus:border-hairline-selected"
          />
          <button
            onClick={() => {
              if (!keyDraft.trim()) return;
              saveRepKey(keyDraft.trim());
              setHasKey(true);
            }}
            data-testid="lab-key-go"
            className="w-full rounded-lg bg-mint py-2.5 text-[13px] font-semibold text-mint-on transition hover:bg-mint-hover"
          >
            Open the lab
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090b] px-6 py-10 text-title">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[.3em] text-mint-muted">Internal · Logo lab</div>
        <h1 className="font-display text-[22px] font-semibold">How will this logo sit on the deck?</h1>
        <p className="mb-6 mt-1 max-w-[64ch] text-[12.5px] leading-normal text-muted">
          Upload a client logo and it runs through the same pipeline the proposal generator uses: background keyed out,
          the mark recolored when it will not read on the dark canvas, or kept on a white card. Pick the treatment that
          looks right and use the same choice in the generator.
        </p>

        <label className="mb-8 flex w-fit cursor-pointer items-center gap-3 rounded-xl border border-hairline-control bg-surface-card2 px-4 py-3 transition hover:border-mint/40">
          <span className="rounded-lg bg-mint px-3 py-1.5 text-[12px] font-semibold text-mint-on">Choose logo…</span>
          <span className="text-[12px] text-muted">{sourceName || "PNG, JPG or SVG"}</span>
          <input type="file" accept="image/*" onChange={onFile} data-testid="logo-file" className="hidden" />
        </label>

        {status === "working" && <div className="text-[13px] text-muted">Treating…</div>}
        {status === "error" && <div className="text-[13px] text-[#d99a9a]">Could not process this image.</div>}

        {status === "done" && (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((r) => (
              <div key={r.treatment} data-testid={`result-${r.treatment}`} className="rounded-2xl border border-hairline-card bg-surface-card2 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10.5px] font-medium uppercase tracking-[.14em] text-mint-muted">{r.treatment}</span>
                  <span className="text-[10.5px] text-muted">
                    {r.cut ? "bg keyed" : "bg kept"}
                    {r.recolored ? " · recolored" : ""}
                    {r.needsModel ? " · busy bg" : ""}
                    {` · plate: ${r.plate}`}
                  </span>
                </div>
                <div
                  className="flex h-24 items-center justify-center rounded-xl"
                  style={{ background: "radial-gradient(70% 70% at 50% 50%, #15392d 0%, #0b1714 75%)" }}
                >
                  {r.plate === "light" ? (
                    <span className="flex items-center rounded-md bg-white px-2.5 py-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.url} alt="" className="h-9 w-auto max-w-[180px] object-contain" />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.url} alt="" className="h-10 w-auto max-w-[200px] object-contain" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {source && status === "done" && (
          <p className="mt-6 text-[11px] text-[#5c6b65]">
            The generator&apos;s Auto treatment makes this same decision on upload; White / Mint force a recolor; Card keeps
            brand colours on a white chip.
          </p>
        )}
      </div>
    </main>
  );
}
