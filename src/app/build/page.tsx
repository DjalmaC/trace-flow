"use client";
import { useEffect, useRef, useState } from "react";
import { FlowExperience } from "@/flow-tool/components/FlowExperience";
import { SilkBackdrop } from "@/flow-tool/components/Glass";
import { ControlPanel } from "@/components/ControlPanel";
import { NotesDrawer } from "@/components/NotesDrawer";
import { defaultConfig, getFlow } from "@/flow-tool/data";
import { registerCustomFlows } from "@/flow-tool/data/custom-flows";
import { deckPricing, normalizePricing, type Flow, type FlowConfig, type ProposalPricing, type ProposalSetup } from "@/flow-tool/data/schema";
import { loadSetup } from "@/flow-tool/lib/setup";

/** Stash written by the dashboard's Edit action: the stored proposal's config
 *  plus its share code, so the rail can update the SAME link in place. */
interface EditStash {
  code: string;
  config: FlowConfig & {
    variants?: { flowId: string; name: string }[];
    customFlows?: Flow[];
    pricing?: unknown;
    proposalType?: "standard" | "brazil-market";
    date?: string;
    traceRepId?: string;
    sandbox?: boolean;
  };
}
const EDIT_STASH_KEY = "tf:edit-proposal";

export default function BuildPage() {
  const [config, setConfig] = useState<FlowConfig>(() => defaultConfig("flow-1", "Your Client"));
  const [present, setPresent] = useState(false);
  const [only, setOnly] = useState<"surface" | "depth" | undefined>(undefined);
  const [setup, setSetup] = useState<ProposalSetup | null>(null);
  // Flows the salesperson has added to the proposal deck (in order).
  const [proposalFlows, setProposalFlows] = useState<{ flowId: string; name: string }[]>([]);
  // Proposal pricing (2b): lives beside proposalFlows and rides into the share
  // config, so the client's Pricing view and the PDF show the rep's rates.
  const [pricing, setPricing] = useState<ProposalPricing>(() => deckPricing());
  // Whether pricing ships into the client link (off → flow-only link).
  const [includePricing, setIncludePricing] = useState(true);
  // Sandbox mode: links generated while on are tagged and kept off the pipeline.
  const [sandbox, setSandbox] = useState(false);
  // Editing an existing proposal (dashboard → Edit): its share code.
  const [editingCode, setEditingCode] = useState<string | null>(null);
  // Double-click rename overlay for the flow boxes / lane names / hero
  // subtitle on the canvas.
  const [rename, setRename] = useState<{ key: string; lane?: "brazil" | "abroad"; hero?: boolean; platformCaption?: boolean; comment?: boolean; node?: boolean; entity?: string; entityOn?: boolean; branded?: boolean; original: string; value: string; left: number; top: number; width: number } | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  // Edit mode ("Arrange boxes"): drag a box onto another to swap places, or
  // into a rail gap to move it. Stored as config.nodeOrder, so the client
  // link, mobile and the PDF all inherit the new order.
  const [editMode, setEditMode] = useState(false);
  // Rail open state (reported by ControlPanel): while open, the canvas sits
  // fully to its right so the floating glass rail reads straight onto the silk.
  const [railOpen, setRailOpen] = useState(true);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);

  // The deck's rate cards are proposal-type-specific (Standard prices two
  // components; Brazil-market prices five products), so switching type re-seeds
  // the pricing from that deck.
  const proposalType = setup?.proposalType ?? "standard";
  const hydratedRef = useRef(false);
  useEffect(() => {
    // skip the reseed when hydrating a stored proposal (its pricing wins)
    if (hydratedRef.current) {
      hydratedRef.current = false;
      return;
    }
    setPricing(deckPricing(proposalType));
  }, [proposalType]);

  // Deep links for screen-share: ?flow=flow-7 preloads a flow, ?present=1 opens
  // straight into presentation mode.
  useEffect(() => {
    // Editing an existing proposal takes precedence over the intro-page setup.
    const editParam = new URLSearchParams(window.location.search).get("edit");
    if (editParam) {
      try {
        const stash = JSON.parse(sessionStorage.getItem(EDIT_STASH_KEY) ?? "null") as EditStash | null;
        if (stash && stash.code === editParam) {
          const c = stash.config;
          registerCustomFlows(c.customFlows);
          hydratedRef.current = true;
          setEditingCode(stash.code);
          // Older links can carry a dangling flowId (an abandoned draft that
          // never shipped) — open the builder on the first flow that resolves.
          const flowIdR =
            (getFlow(c.flowId) ? c.flowId : undefined) ??
            c.variants?.find((v) => !!getFlow(v.flowId))?.flowId ??
            c.flowId;
          setConfig({
            ...defaultConfig(flowIdR, c.clientName),
            ...c,
            flowId: flowIdR,
            variants: undefined,
            customFlows: undefined,
            pricing: undefined,
          } as FlowConfig);
          setProposalFlows(c.variants ?? [{ flowId: flowIdR, name: getFlow(flowIdR)?.title ?? "Flow" }]);
          setPricing(normalizePricing(c.pricing, c.proposalType ?? "standard"));
          setIncludePricing(!!c.pricing); // a link saved without pricing stays flow-only
          setSandbox(!!c.sandbox);
          setSetup({
            proposalType: c.proposalType ?? "standard",
            date: c.date ?? "",
            traceRepId: c.traceRepId,
            company: c.clientName,
            companyRep: c.clientRep,
            companyLogoUrl: c.clientLogoUrl,
            companyLogoPlate: c.clientLogoPlate,
          });
          return; // skip the /new setup hydration below
        }
      } catch {
        /* fall through to normal hydration */
      }
    }
    // Hydrate the salesperson-private setup from the intro page (/new).
    const s = loadSetup();
    if (s) {
      setSetup(s);
      setConfig((c) => ({
        ...c,
        clientName: s.company || c.clientName,
        clientRep: s.companyRep ?? c.clientRep,
        clientLogoUrl: s.companyLogoUrl ?? c.clientLogoUrl,
        clientLogoPlate: s.companyLogoPlate ?? c.clientLogoPlate,
        brandColor: s.brandColor ?? c.brandColor,
      }));
    }
    const params = new URLSearchParams(window.location.search);
    const flowId = params.get("flow");
    if (flowId) setConfig((c) => ({ ...c, flowId }));
    if (params.get("present") === "1") setPresent(true);
    const stage = params.get("stage");
    if (stage === "surface" || stage === "depth") setOnly(stage);
    const coin = params.get("coin");
    if (coin === "USDC" || coin === "USDT" || coin === "both") setConfig((c) => ({ ...c, stablecoin: coin }));
    const d = params.get("dir");
    if (d === "collection" || d === "disbursement") setConfig((c) => ({ ...c, direction: d }));
    const dv = params.get("delivered");
    if (dv === "USD/EUR" || dv === "USD" || dv === "EUR") setConfig((c) => ({ ...c, delivered: dv }));
    // QA hook: ?y=0.4 jumps to that fraction of the dive scroll (for previews).
    const y = params.get("y");
    if (y) {
      const f = Math.max(0, Math.min(1, parseFloat(y)));
      setTimeout(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, f * max);
      }, 450);
    }
  }, []);

  if (only) {
    return (
      <main className="relative">
        <FlowExperience config={config} only={only} />
      </main>
    );
  }

  const setDirection = (direction: typeof config.direction) => setConfig((c) => ({ ...c, direction }));

  // ── double-click a flow box, a lane name, or the hero subtitle to edit it
  // (this proposal only) ──
  function onCanvasDoubleClick(e: React.MouseEvent) {
    const capEl = (e.target as Element).closest?.("[data-platform-caption]");
    if (capEl) {
      const original =
        config.platform?.provider === "trace"
          ? "Powered by Trace Finance. We operate the rails beneath the flow."
          : `Native to the ${config.clientName} platform. Trace operates the rails underneath.`;
      const r = capEl.getBoundingClientRect();
      const width = Math.min(640, Math.max(r.width + 90, 400));
      setRename({
        key: "platform-caption",
        hero: false,
        platformCaption: true,
        original,
        value: config.platform?.caption ?? original,
        left: r.left + r.width / 2 - width / 2,
        top: r.top + r.height / 2 - 17,
        width,
      });
      return;
    }
    const commentEl = (e.target as Element).closest?.("[data-flow-comment]");
    if (commentEl) {
      const key = config.flowId;
      const r = commentEl.getBoundingClientRect();
      const width = Math.min(680, Math.max(r.width, 420));
      setRename({
        key,
        comment: true,
        original: "",
        value: config.comments?.[key] ?? "",
        left: r.left + r.width / 2 - width / 2,
        top: r.top + r.height / 2 - 34,
        width,
      });
      return;
    }
    const heroEl = (e.target as Element).closest?.("[data-hero-support]");
    if (heroEl) {
      const flow = getFlow(config.flowId);
      const original =
        (flow?.heroSupport ? flow.heroSupport[config.direction] : undefined) ??
        (config.direction === "collection"
          ? "Collect in Brazil, settle to their merchant abroad, in one move."
          : "Fund from abroad, pay out into Brazil, in one move.");
      const key = `${config.flowId}:${config.direction}`;
      const r = heroEl.getBoundingClientRect();
      const width = Math.min(640, Math.max(r.width + 90, 380));
      setRename({
        key,
        hero: true,
        original,
        value: config.heroSupport?.[key] ?? original,
        left: r.left + r.width / 2 - width / 2,
        top: r.top + r.height / 2 - 17,
        width,
      });
      return;
    }
    const laneEl = (e.target as Element).closest?.("[data-flow-lane]");
    if (laneEl) {
      const lane = laneEl.getAttribute("data-flow-lane") as "brazil" | "abroad";
      const original = lane === "brazil" ? "Brazil" : "Abroad";
      const r = laneEl.getBoundingClientRect();
      setRename({
        key: lane,
        lane,
        original,
        value: config.laneLabels?.[config.flowId]?.[lane] ?? original,
        left: r.left + r.width / 2 - 90,
        top: r.top + r.height / 2 - 17,
        width: 180,
      });
      return;
    }
    // The two "desired transaction" boxes are the same actors as their
    // machinery counterparts — edit them with the same card, keyed on the same
    // node ids so a rename / entity / logo stays consistent across both stages.
    const heroNodeEl = (e.target as Element).closest?.("[data-hero-node]");
    if (heroNodeEl) {
      const hid = heroNodeEl.getAttribute("data-hero-node")!;
      // Hero edits write a hero-namespaced key so the "desired transaction" can
      // diverge from the machinery below (e.g. Client -> Client on top, client
      // -> merchant beneath). Initial values fall back to the machinery edit,
      // then the flow's own label.
      const hkey = `${config.flowId}:__hero__:${hid}`;
      const mkey = `${config.flowId}:${hid}`;
      const flowLabel = getFlow(config.flowId)?.nodes.find((n) => n.id === hid)?.label ?? "";
      const hentity = config.nodeEntities?.[hkey] ?? config.nodeEntities?.[mkey];
      const r = heroNodeEl.getBoundingClientRect();
      const w = Math.max(Math.min(r.width, 240), 190);
      setRename({
        key: hkey,
        node: true,
        entity: hentity ?? "",
        entityOn: !!hentity,
        branded: !!(config.nodeBranded?.[hkey] ?? config.nodeBranded?.[mkey]),
        original: flowLabel,
        value: config.nodeLabels?.[hkey] ?? config.nodeLabels?.[mkey] ?? flowLabel,
        left: r.left + r.width / 2 - w / 2,
        top: r.top + r.height / 2 - 17,
        width: w,
      });
      return;
    }
    const el = (e.target as Element).closest?.("[data-flow-node]");
    const id = el?.getAttribute("data-flow-node");
    if (!el || !id) return;
    const key = `${config.flowId}:${id}`;
    const original = getFlow(config.flowId)?.nodes.find((n) => n.id === id)?.label ?? "";
    const r = el.getBoundingClientRect();
    const entity = config.nodeEntities?.[key];
    setRename({
      key,
      node: true,
      entity: entity ?? "",
      entityOn: !!entity,
      branded: !!config.nodeBranded?.[key],
      original,
      value: config.nodeLabels?.[key] ?? original,
      left: r.left,
      top: r.top + r.height / 2 - 17,
      width: Math.max(r.width, 190),
    });
  }
  function commitRename() {
    if (!rename) return;
    const v = rename.value.trim();
    if (rename.platformCaption) {
      setConfig((c) => ({
        ...c,
        platform: c.platform ? { ...c.platform, caption: !v || v === rename.original ? undefined : v } : c.platform,
      }));
      setRename(null);
      return;
    }
    if (rename.hero) {
      setConfig((c) => {
        const m = { ...(c.heroSupport ?? {}) };
        if (!v || v === rename.original) delete m[rename.key]; // empty = back to the flow's own copy
        else m[rename.key] = v;
        return { ...c, heroSupport: Object.keys(m).length ? m : undefined };
      });
      setRename(null);
      return;
    }
    if (rename.comment) {
      setConfig((c) => {
        const m = { ...(c.comments ?? {}) };
        if (!v) delete m[rename.key]; // empty = no note
        else m[rename.key] = v;
        return { ...c, comments: Object.keys(m).length ? m : undefined };
      });
      setRename(null);
      return;
    }
    if (rename.lane) {
      const lane = rename.lane;
      setConfig((c) => {
        const all = { ...(c.laneLabels ?? {}) };
        const cur = { ...(all[c.flowId] ?? {}) };
        if (!v || v === rename.original) delete cur[lane]; // empty = back to Brazil/Abroad
        else cur[lane] = v;
        if (Object.keys(cur).length) all[c.flowId] = cur;
        else delete all[c.flowId];
        return { ...c, laneLabels: Object.keys(all).length ? all : undefined };
      });
      setRename(null);
      return;
    }
    const entityVal = rename.entityOn ? (rename.entity ?? "").trim() : "";
    setConfig((c) => {
      const labels = { ...(c.nodeLabels ?? {}) };
      if (!v || v === rename.original) delete labels[rename.key]; // empty = back to the flow's own name
      else labels[rename.key] = v;
      // Entity annotation "(Brazilian VASP)" under the box — opt-in per box.
      const ents = { ...(c.nodeEntities ?? {}) };
      if (entityVal) ents[rename.key] = entityVal;
      else delete ents[rename.key];
      // Branding: carry the client logo on this box (a second client entity).
      const branded = { ...(c.nodeBranded ?? {}) };
      if (rename.branded) branded[rename.key] = true;
      else delete branded[rename.key];
      return {
        ...c,
        nodeLabels: Object.keys(labels).length ? labels : undefined,
        nodeEntities: Object.keys(ents).length ? ents : undefined,
        nodeBranded: Object.keys(branded).length ? branded : undefined,
      };
    });
    setRename(null);
  }
  // ── edit mode: box reordering ──
  // The label a box currently shows (rename override, else the flow's own).
  const displayedLabel = (id: string) =>
    config.nodeLabels?.[`${config.flowId}:${id}`] ?? getFlow(config.flowId)?.nodes.find((n) => n.id === id)?.label ?? id;

  // Current content order across the flow's slots (identity unless reordered).
  function currentOrder(): string[] | null {
    const flow = getFlow(config.flowId);
    if (!flow) return null;
    const ids = flow.nodes.map((n) => n.id);
    const o = config.nodeOrder?.[config.flowId];
    const valid = o && o.length === ids.length && new Set(o).size === o.length && o.every((x) => ids.includes(x));
    return valid ? [...o] : ids;
  }
  function commitOrder(next: string[]) {
    const flow = getFlow(config.flowId);
    if (!flow) return;
    const identity = next.every((id, i) => id === flow.nodes[i].id);
    setConfig((c) => {
      const m = { ...(c.nodeOrder ?? {}) };
      if (identity) delete m[flow.id];
      else m[flow.id] = next;
      return { ...c, nodeOrder: Object.keys(m).length ? m : undefined };
    });
  }

  function onCanvasPointerDown(e: React.PointerEvent) {
    if (!editMode || e.button !== 0 || rename) return;
    const start = (e.target as Element).closest?.("[data-flow-node]") as SVGGElement | null;
    if (!start || start.closest("[data-headline]")) return;
    const svg = start.closest("svg");
    if (!svg) return;
    const id = start.getAttribute("data-flow-node")!;
    // Every box in this stage, and the rail row (the largest same-height group)
    // whose gaps are the insertion points for a move. Rects are frozen at grab
    // time — the canvas doesn't scroll mid-drag.
    const boxes = Array.from(svg.querySelectorAll<SVGGElement>("g[data-flow-node]"))
      .filter((b) => !b.closest("[data-headline]"))
      .map((b) => ({ id: b.getAttribute("data-flow-node")!, el: b, r: b.getBoundingClientRect() }));
    if (boxes.length < 2) return;
    const rows = new Map<number, typeof boxes>();
    for (const b of boxes) {
      const k = Math.round((b.r.top + b.r.height / 2) / 14);
      rows.set(k, [...(rows.get(k) ?? []), b]);
    }
    const row = [...rows.values()].sort((a, b) => b.length - a.length)[0].slice().sort((a, b) => a.r.left - b.r.left);
    const gaps: { x: number; y: number; h: number; index: number }[] = [];
    for (let i = 0; i <= row.length; i++) {
      const left = i > 0 ? row[i - 1].r : null;
      const right = i < row.length ? row[i].r : null;
      gaps.push({
        x: left && right ? (left.right + right.left) / 2 : left ? left.right + 20 : right!.left - 20,
        y: (left ?? right!).top,
        h: (left ?? right!).height,
        index: i,
      });
    }
    const d = { active: false, hover: null as SVGGElement | null, gapIndex: null as number | null };
    e.preventDefault();

    const clearHover = () => {
      if (d.hover) d.hover.style.filter = "";
      d.hover = null;
    };
    const startX = e.clientX;
    const startY = e.clientY;
    const move = (ev: PointerEvent) => {
      // a real drag starts after a small threshold, so double-click still renames
      if (!d.active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        d.active = true;
        start.style.opacity = "0.4";
        setDragLabel(displayedLabel(id));
      }
      if (ghostRef.current) {
        ghostRef.current.style.left = `${ev.clientX + 14}px`;
        ghostRef.current.style.top = `${ev.clientY + 12}px`;
      }
      const hit = (document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-flow-node]") ?? null) as SVGGElement | null;
      const target = hit && !hit.closest("[data-headline]") && hit.getAttribute("data-flow-node") !== id ? hit : null;
      if (target !== d.hover) {
        clearHover();
        if (target) {
          d.hover = target;
          target.style.filter = "drop-shadow(0 0 9px rgba(0,242,177,0.95))";
        }
      }
      d.gapIndex = null;
      if (!target && row.some((b) => b.id === id)) {
        const near = gaps.find(
          (g) => Math.abs(ev.clientX - g.x) < 34 && ev.clientY > g.y - 90 && ev.clientY < g.y + g.h + 90,
        );
        if (near) d.gapIndex = near.index;
      }
      if (caretRef.current) {
        const g = d.gapIndex != null ? gaps[d.gapIndex] : null;
        caretRef.current.style.display = g ? "block" : "none";
        if (g) {
          caretRef.current.style.left = `${g.x - 1.5}px`;
          caretRef.current.style.top = `${g.y - 6}px`;
          caretRef.current.style.height = `${g.h + 12}px`;
        }
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      start.style.opacity = "";
      const hoverId = d.hover?.getAttribute("data-flow-node") ?? null;
      clearHover();
      setDragLabel(null);
      if (!d.active) return;
      const order = currentOrder();
      if (!order) return;
      if (hoverId) {
        // dropped ON a box → the two swap places
        const ai = order.indexOf(id);
        const bi = order.indexOf(hoverId);
        if (ai < 0 || bi < 0) return;
        [order[ai], order[bi]] = [order[bi], order[ai]];
        commitOrder(order);
      } else if (d.gapIndex != null) {
        // dropped in a rail gap → move there, everything between shifts over
        const rowIds = row.map((b) => b.id);
        const di = rowIds.indexOf(id);
        if (di < 0) return;
        const slotIdx = rowIds.map((cid) => order.indexOf(cid));
        if (slotIdx.some((i) => i < 0)) return;
        let at = d.gapIndex;
        if (at > di) at -= 1;
        const seq = rowIds.filter((c) => c !== id);
        seq.splice(at, 0, id);
        const next = [...order];
        slotIdx.forEach((si, j) => {
          next[si] = seq[j];
        });
        commitOrder(next);
      }
    };
    const cancel = () => {
      clearHover();
      d.gapIndex = null;
      up();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  const editControls = (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
      {editMode && (
        <span className="rounded-lg bg-[#0c110f]/85 px-2.5 py-1.5 text-xs text-subtitle backdrop-blur">
          Drag a box onto another to swap · into a gap to move · double-click any text to edit
        </span>
      )}
      {editMode && config.nodeOrder?.[config.flowId] && (
        <button
          onClick={() => commitOrder(getFlow(config.flowId)?.nodes.map((n) => n.id) ?? [])}
          className="rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
        >
          Reset order
        </button>
      )}
      <button
        onClick={() => setEditMode((v) => !v)}
        className={`rounded-lg border px-3 py-1.5 text-sm backdrop-blur transition ${
          editMode ? "border-mint bg-[#0c110f] text-title" : "border-node-stroke bg-[#0c110f]/90 text-subtitle hover:text-title"
        }`}
      >
        {editMode ? "Done arranging" : "Arrange boxes"}
      </button>
    </div>
  );
  const dragChrome = (
    <>
      {editMode && <style>{`g[data-flow-node]{cursor:grab} g[data-flow-node]:active{cursor:grabbing} [data-flow-lane]{cursor:text}`}</style>}
      {dragLabel && (
        <>
          <div
            ref={ghostRef}
            className="pointer-events-none fixed z-[90] rounded-lg border border-mint bg-[#0c110f]/95 px-3 py-1.5 text-[13px] font-semibold text-title shadow-xl"
            style={{ left: -999, top: -999 }}
          >
            {dragLabel}
          </div>
          <div
            ref={caretRef}
            className="pointer-events-none fixed z-[85] w-[3px] rounded bg-mint"
            style={{ left: -999, top: -999, height: 64, display: "none" }}
          />
        </>
      )}
    </>
  );

  const inputCls =
    "w-full rounded-md border border-mint bg-[#0c110f] px-2.5 py-1.5 text-center text-[13px] font-semibold text-title shadow-xl outline-none";
  const renameOverlay =
    rename &&
    (rename.comment ? (
      // Per-flow note: a small multi-line field. Enter commits, Shift+Enter
      // adds a line, Escape cancels.
      <div className="fixed z-[80] flex flex-col gap-1" style={{ left: rename.left, top: rename.top, width: rename.width }}>
        <textarea
          autoFocus
          rows={4}
          value={rename.value}
          onChange={(e) => setRename({ ...rename, value: e.target.value })}
          onFocus={(e) => e.target.select()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            // Enter adds a line (so you can build bullets); Escape cancels;
            // click away to save.
            if (e.key === "Escape") setRename(null);
            e.stopPropagation();
          }}
          placeholder="One line per point. Start a line with '- ' for a bullet. Click away to save."
          aria-label="Flow note"
          className="w-full resize-none rounded-lg border border-mint bg-[#0c110f] px-3 py-2 text-left text-[13px] leading-relaxed text-title shadow-xl outline-none placeholder:text-muted"
        />
        {(() => {
          const n = rename.value.split(/\r?\n/).filter((l) => l.trim()).length;
          return (
            <span className={`self-end rounded px-1.5 py-0.5 text-[10px] ${n > 6 ? "text-amber-300/80" : "text-muted"}`}>
              {n} line{n === 1 ? "" : "s"} · reads best under ~6
            </span>
          );
        })()}
      </div>
    ) : rename.node ? (
      // Node box: name + an opt-in "Specify entity" line that renders under the
      // box as "(Brazilian VASP)". Commits when focus leaves the whole card.
      <div
        className="fixed z-[80] flex flex-col gap-1.5 rounded-lg border border-mint bg-[#0c110f] p-2 shadow-xl"
        style={{ left: rename.left, top: rename.top - 4, width: Math.max(rename.width, 200) }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitRename();
        }}
      >
        <input
          ref={renameRef}
          autoFocus
          value={rename.value}
          onChange={(e) => setRename({ ...rename, value: e.target.value })}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            else if (e.key === "Escape") setRename(null);
          }}
          aria-label="Rename flow box"
          className={inputCls}
        />
        <label
          className={`flex items-center gap-2 px-0.5 text-[11px] font-medium ${
            config.clientLogoUrl ? "cursor-pointer text-subtitle" : "cursor-not-allowed text-muted"
          }`}
        >
          <input
            type="checkbox"
            disabled={!config.clientLogoUrl}
            checked={!!rename.branded}
            onChange={(e) => setRename({ ...rename, branded: e.target.checked })}
            className="h-3 w-3 accent-mint"
          />
          Show client logo{!config.clientLogoUrl && " · upload a logo first"}
        </label>
        <label className="flex cursor-pointer items-center gap-2 px-0.5 text-[11px] font-medium text-subtitle">
          <input
            type="checkbox"
            checked={!!rename.entityOn}
            onChange={(e) => setRename({ ...rename, entityOn: e.target.checked })}
            className="h-3 w-3 accent-mint"
          />
          Specify entity
        </label>
        {rename.entityOn && (
          <input
            autoFocus
            value={rename.entity ?? ""}
            onChange={(e) => setRename({ ...rename, entity: e.target.value })}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              else if (e.key === "Escape") setRename(null);
            }}
            placeholder="e.g. Brazilian VASP"
            aria-label="Entity under the box"
            className="w-full rounded-md border border-node-stroke bg-[#0c110f] px-2.5 py-1.5 text-center text-[12px] text-title outline-none placeholder:text-muted focus:border-mint"
          />
        )}
      </div>
    ) : (
      <input
        ref={renameRef}
        autoFocus
        value={rename.value}
        onChange={(e) => setRename({ ...rename, value: e.target.value })}
        onFocus={(e) => e.target.select()}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitRename();
          else if (e.key === "Escape") setRename(null);
        }}
        aria-label="Rename flow box"
        className={`fixed z-[80] ${inputCls}`}
        style={{ left: rename.left, top: rename.top, width: rename.width }}
      />
    ));

  if (present) {
    return (
      <main className="relative" onDoubleClick={onCanvasDoubleClick} onPointerDown={onCanvasPointerDown}>
        <SilkBackdrop />
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" style={{ background: "linear-gradient(90deg,#2be8d6,#00f2b1)" }} />
        <FlowExperience config={config} presentation skin="glass" onDirectionChange={setDirection} editable />
        {renameOverlay}
        {editControls}
        {dragChrome}
        <NotesDrawer
          notes={config.proposalNotes?.[config.flowId]}
          editable
          onChange={(v) =>
            setConfig((c) => {
              const m = { ...(c.proposalNotes ?? {}) };
              if (v) m[c.flowId] = v;
              else delete m[c.flowId];
              return { ...c, proposalNotes: Object.keys(m).length ? m : undefined };
            })
          }
        />
        <button
          onClick={() => setPresent(false)}
          className="fixed left-4 top-4 z-50 flex items-center gap-1.5 rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          Exit present
        </button>
      </main>
    );
  }

  return (
    <main className="relative" onDoubleClick={onCanvasDoubleClick} onPointerDown={onCanvasPointerDown}>
      <SilkBackdrop />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]" style={{ background: "linear-gradient(90deg,#2be8d6,#00f2b1)" }} />
      <ControlPanel
        onOpenChange={setRailOpen}
        config={config}
        onConfigChange={setConfig}
        onPresent={() => setPresent(true)}
        setup={setup}
        onSetupChange={setSetup}
        proposalFlows={proposalFlows}
        onProposalFlowsChange={setProposalFlows}
        pricing={pricing}
        onPricingChange={setPricing}
        includePricing={includePricing}
        onIncludePricingChange={setIncludePricing}
        sandbox={sandbox}
        onSandboxChange={setSandbox}
        editingCode={editingCode}
        onSaved={(code, savedConfig) => {
          // Lock onto this link so the next save updates it in place, and
          // refresh the edit stash + URL so reloading or re-editing keeps the
          // edits instead of reverting to the pre-edit state.
          setEditingCode(code);
          try {
            sessionStorage.setItem(EDIT_STASH_KEY, JSON.stringify({ code, config: savedConfig }));
            window.history.replaceState(null, "", `/build?edit=${code}`);
          } catch {
            /* ignore storage/history failures */
          }
        }}
      />
      {renameOverlay}
      {editControls}
      {dragChrome}
      <NotesDrawer
        notes={config.proposalNotes?.[config.flowId]}
        editable
        onChange={(v) =>
          setConfig((c) => {
            const m = { ...(c.proposalNotes ?? {}) };
            if (v) m[c.flowId] = v;
            else delete m[c.flowId];
            return { ...c, proposalNotes: Object.keys(m).length ? m : undefined };
          })
        }
      />
      {/* Sits UNDER the rail (z-40 < z-50): reachable when the rail is collapsed. */}
      <a
        href="/"
        className="fixed bottom-4 left-4 z-40 rounded-lg border border-node-stroke bg-[#0c110f]/90 px-3 py-1.5 text-sm text-subtitle backdrop-blur transition hover:text-title"
      >
        ← Proposals
      </a>
      <div className={`transition-[padding] duration-300 ease-ds ${railOpen ? "md:pl-[356px]" : ""}`}>
        <FlowExperience config={config} skin="glass" onDirectionChange={setDirection} editable />
      </div>
    </main>
  );
}
