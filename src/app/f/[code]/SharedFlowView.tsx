"use client";
import { useEffect, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { ASSETS, C, TRACE_LOGO_AR } from "@/flow-tool/components/tokens";
import { loadSharedFlow } from "@/flow-tool/lib/share";
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
  const [printing, setPrinting] = useState(false);

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

  // print → PDF: render the static stacked layout, print, then restore
  useEffect(() => {
    if (!printing) return;
    const id = requestAnimationFrame(() => {
      window.print();
      setPrinting(false);
    });
    return () => cancelAnimationFrame(id);
  }, [printing]);

  const config = state.status === "ready" ? state.config : null;
  const repName = config?.clientRep?.split(",")[0]?.trim();

  return (
    <main className="relative bg-[#07090b]">
      {/* the flow (revealed as the intro overlay fades out) */}
      {config && (
        <>
          <header className="no-print absolute left-0 right-0 top-0 z-40 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              {config.clientLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.clientLogoUrl} alt={config.clientName} className="h-7 max-w-[120px] object-contain" />
              ) : null}
              <div className="leading-tight">
                <div className="text-sm font-semibold text-title">{config.clientName}</div>
                {config.clientRep && <div className="text-[11px] text-muted">Prepared for {config.clientRep}</div>}
              </div>
            </div>
            <button
              onClick={() => setPrinting(true)}
              className="rounded-lg border border-white/10 bg-[#0e1410]/70 px-3 py-1.5 text-[12.5px] font-medium text-[#bfe8d4] backdrop-blur transition hover:border-green-accent/40"
            >
              Download PDF ↓
            </button>
          </header>
          <FlowExperience config={{ ...config, direction }} presentation onDirectionChange={setDirection} forceStatic={printing} />
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
              {config!.clientLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config!.clientLogoUrl} alt={config!.clientName} className="h-16 max-w-[280px] object-contain" />
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

          {/* Trace lockup pinned at the bottom of the welcome screen */}
          {state.status === "ready" && (
            <div className="absolute bottom-8 opacity-70">
              <Brandmark />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function Brandmark() {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.traceLogo} alt="" style={{ height: 22, width: 22 * TRACE_LOGO_AR }} />
      <span className="text-[15px] font-semibold" style={{ color: C.title }}>
        Trace Finance
      </span>
    </div>
  );
}
