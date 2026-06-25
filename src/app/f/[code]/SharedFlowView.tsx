"use client";
import { useEffect, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { ASSETS, C, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { loadSharedFlow } from "@/flow-tool/lib/share";
import { downloadFlowPdf } from "@/flow-tool/lib/pdf";
import type { Direction, FlowConfig } from "@/flow-tool/data/schema";

type State =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "unconfigured" }
  | { status: "error"; msg: string }
  | { status: "ready"; config: FlowConfig };

// intro choreography after a private link opens:
//   loading → welcome (held) → fadeout → done (the flow underneath is revealed)
type Intro = "loading" | "welcome" | "fadeout" | "done";
const MIN_LOAD_MS = 1500;
const WELCOME_HOLD_MS = 2300;
const FADE_MS = 900;

export function SharedFlowView({ code }: { code: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [intro, setIntro] = useState<Intro>("loading");
  const [direction, setDirection] = useState<Direction>("collection");
  const [pdf, setPdf] = useState<"idle" | "working" | "error">("idle");

  const config = state.status === "ready" ? state.config : null;
  const repName = config?.clientRep?.split(",")[0]?.trim();

  async function onDownload() {
    if (!config) return;
    setPdf("working");
    try {
      await downloadFlowPdf({ ...config, direction });
      setPdf("idle");
    } catch {
      setPdf("error");
      setTimeout(() => setPdf("idle"), 2500);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // hold the loading screen a beat so it reads, even on a fast fetch
        const [config] = await Promise.all([
          loadSharedFlow(code),
          new Promise((r) => setTimeout(r, MIN_LOAD_MS)),
        ]);
        if (cancelled) return;
        if (!config) setState({ status: "notfound" });
        else {
          setDirection(config.direction);
          setState({ status: "ready", config });
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Could not load this flow.";
        if (msg.includes("not configured")) setState({ status: "unconfigured" });
        else setState({ status: "error", msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // once loaded, run the welcome → fadeout → done sequence
  useEffect(() => {
    if (state.status !== "ready") return;
    setIntro("welcome");
    const t1 = setTimeout(() => setIntro("fadeout"), WELCOME_HOLD_MS);
    const t2 = setTimeout(() => setIntro("done"), WELCOME_HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state.status]);

  return (
    <main className="relative bg-[#07090b]">
      {/* the flow (revealed as the intro overlay fades out) */}
      {config && (
        <>
          <header className="no-print absolute left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              {config.clientLogoUrl ? (
                config.clientLogoPlate === "light" ? (
                  <span className="flex items-center rounded-md bg-white px-1.5 py-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={config.clientLogoUrl} alt={config.clientName} className="h-6 max-w-[110px] object-contain" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config.clientLogoUrl} alt={config.clientName} className="h-7 max-w-[120px] object-contain" />
                )
              ) : null}
              <div className="leading-tight">
                <div className="text-sm font-semibold text-title">{config.clientName}</div>
                {config.clientRep && <div className="text-[11px] text-muted">Prepared for {config.clientRep}</div>}
              </div>
            </div>
          </header>
          <FlowExperience config={{ ...config, direction }} presentation onDirectionChange={setDirection} />
          {/* Download PDF — larger, bottom-left, clear of the Pay-in/Pay-out toggle */}
          <button
            onClick={onDownload}
            disabled={pdf === "working"}
            className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-xl border border-green-accent/40 bg-[#0e1410]/85 px-5 py-3 text-sm font-semibold text-[#bfe8d4] shadow-xl backdrop-blur transition hover:border-green-accent hover:bg-[#13201a] disabled:opacity-60"
          >
            {pdf === "working" ? "Preparing…" : pdf === "error" ? "Try again" : "Download PDF ↓"}
          </button>
        </>
      )}

      {/* intro overlay: opaque, covers the flow, then fades out */}
      {intro !== "done" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090b] px-6 text-center"
          style={{ transition: `opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1)`, opacity: intro === "fadeout" ? 0 : 1, pointerEvents: intro === "fadeout" ? "none" : "auto" }}
        >
          {state.status === "ready" ? (
            <div key="welcome" className="tf-rise flex flex-col items-center gap-5">
              <Brandmark size="lg" />
              {config!.clientLogoUrl ? (
                config!.clientLogoPlate === "light" ? (
                  <span className="flex items-center justify-center rounded-2xl bg-white px-6 py-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={config!.clientLogoUrl} alt={config!.clientName} className="h-14 max-w-[260px] object-contain" />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={config!.clientLogoUrl} alt={config!.clientName} className="h-16 max-w-[280px] object-contain" />
                )
              ) : (
                <div className="text-2xl font-semibold text-title">{config!.clientName}</div>
              )}
              <h1 className="text-3xl font-bold tracking-tight text-title md:text-4xl">
                Welcome{repName ? `, ${repName}` : ""}
              </h1>
              <p className="max-w-md text-sm text-subtitle">
                Here’s the cross-border payment flow we’ve prepared for {config!.clientName}.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Brandmark />
              <p className="text-sm text-subtitle">
                {state.status === "loading" && "Loading the flow…"}
                {state.status === "notfound" && "This link is invalid or has expired."}
                {state.status === "unconfigured" && "Sharing isn’t configured yet."}
                {state.status === "error" && state.msg}
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Brandmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const h = size === "lg" ? 32 : 22;
  return (
    <div className={`flex items-center ${size === "lg" ? "gap-3" : "gap-2"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.traceLogo} alt="" style={{ height: h, width: h * TRACE_LOGO_AR }} />
      <span className={`font-semibold ${size === "lg" ? "text-[24px]" : "text-[15px]"}`} style={{ color: C.title }}>
        Trace Finance
      </span>
    </div>
  );
}
