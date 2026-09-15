"use client";
import { useEffect, useMemo, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { SilkBackdrop } from "@/flow-tool/components/Glass";
import { defaultConfig, getFlow } from "@/flow-tool/data";
import type { FlowConfig } from "@/flow-tool/data/schema";

// Internal QA surface (behind the rep gate like every /build path): renders a
// library flow statically, or the exact deck PNGs the PDF / PPTX exports
// embed, so static exports can be inspected in a headless browser without a
// share link or a production round-trip.
//   /build/qa?flow=brlt-f01                the depth stage, static
//   /build/qa?flow=brlt-f01&mode=deck      the export slides (flow + notes page)
//   /build/qa?flow=brlt-f01&mode=live      the full experience (dive)
//   /build/qa?flow=brlt-f01&mode=panels    the client link's desktop panel shell
export default function BuildQaPage() {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  useEffect(() => setParams(new URLSearchParams(window.location.search)), []);
  const flowId = params?.get("flow") ?? "brlt-f01";
  const mode = params?.get("mode") ?? "static";
  const config = useMemo<FlowConfig>(() => defaultConfig(flowId, params?.get("client") ?? "Acme Holdings"), [flowId, params]);
  const [slides, setSlides] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!params || mode !== "deck") return;
    const flow = getFlow(flowId);
    if (!flow) return;
    import("@/flow-tool/lib/pptx")
      .then((m) => m.renderProposalFlowPngs(config, [{ flowId, name: flow.title }]))
      .then(setSlides)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [params, mode, flowId, config]);

  if (!params) return null;
  if (!getFlow(flowId)) return <div className="p-8 text-title">Unknown flow: {flowId}</div>;
  if (mode === "deck") {
    return (
      <main className="min-h-screen bg-black p-6" data-qa-ready={slides ? "1" : undefined}>
        {err && <p className="text-[#f0a597]">{err}</p>}
        {!slides && !err && <p className="text-muted">Rendering export slides…</p>}
        {slides?.map((src, i) => (
          <figure key={i} className="mb-6" data-qa-slide={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`slide ${i + 1}`} style={{ width: 960, height: 540, display: "block" }} />
            <figcaption className="mt-1 font-mono text-[11px] text-muted">
              slide {i + 1} of {slides.length}
            </figcaption>
          </figure>
        ))}
      </main>
    );
  }
  return (
    <main className="relative min-h-screen" data-qa-ready="1">
      <SilkBackdrop />
      <div className="relative z-10">
        {mode === "live" ? (
          <FlowExperience config={config} editable skin="glass" />
        ) : mode === "panels" ? (
          <div className="pt-10">
            <FlowExperience config={config} presentation skin="glass" architecture="panels" />
          </div>
        ) : (
          <FlowExperience config={config} only="depth" editable skin="glass" />
        )}
      </div>
    </main>
  );
}
