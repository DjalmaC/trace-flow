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

export function SharedFlowView({ code }: { code: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [direction, setDirection] = useState<Direction>("collection");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await loadSharedFlow(code);
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

  // print → PDF: render the static stacked layout, print, then restore
  useEffect(() => {
    if (!printing) return;
    const id = requestAnimationFrame(() => {
      window.print();
      setPrinting(false);
    });
    return () => cancelAnimationFrame(id);
  }, [printing]);

  if (state.status !== "ready") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#07090b] px-6 text-center">
        <Brandmark />
        <p className="text-sm text-subtitle">
          {state.status === "loading" && "Loading the flow…"}
          {state.status === "notfound" && "This link is invalid or has expired."}
          {state.status === "unconfigured" && "Sharing isn’t configured yet."}
          {state.status === "error" && state.msg}
        </p>
      </main>
    );
  }

  const { config } = state;
  const liveConfig = { ...config, direction };

  return (
    <main className="relative bg-[#07090b]">
      {/* client header */}
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

      <FlowExperience config={liveConfig} presentation onDirectionChange={setDirection} forceStatic={printing} />
    </main>
  );
}

function Brandmark() {
  return (
    <div className="flex items-center gap-2 opacity-80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ASSETS.traceLogo} alt="" style={{ height: 22, width: 22 * TRACE_LOGO_AR }} />
      <span className="text-[15px] font-semibold" style={{ color: C.title }}>
        Trace Finance
      </span>
    </div>
  );
}
