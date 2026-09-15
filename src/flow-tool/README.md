# `flow-tool` — the mergeable engine

A self-contained, data-driven engine that renders Trace Finance's cross-border
payment flows as an animated, two-stage scroll story. New flows are **data**, not
new components.

## How it fits together

```
FlowConfig ─▶ getFlow(flowId) ─▶ Flow (data)
                                   │
              computeLayout(Flow, FlowConfig) ─▶ FlowLayout (pure geometry)
                                   │
   HeadlineStage + MachineryStage  ─▶ one SVG  ─▶ FlowExperience (scroll + present)
```

- **`data/schema.ts`** — the contract: `Flow`, `FlowConfig`, `DialCoordinate`,
  and the computed-field rules (`settlementForm`, `computeTraceRole`).
- **`data/flows/*`** — the eleven verified Brazil flows (#1–#10 + #9.1). Each is
  nodes (with `lane` + `kind`), ordered `legs` (with `convertsTo` at the
  crossing), a `headline`, and `sameActor` projector links.
- **`intake/`** — `questions.ts` (the dial questionnaire) and `resolver.ts`
  (Stage A assemble coordinate → Stage B match; matcher-only, no-match ⇒ review).
- **`components/layout.ts`** — turns a `Flow` into positioned geometry. All
  flows are linear chains, so the machinery is a horizontal rail split by the
  Brazil | Abroad divide, with wider gaps on conversion legs for the swap capsule.
- **`components/FlowSvg/*`** — dumb SVG primitives (nodes, currency tokens, swap
  capsules, the Trace mark, the deck background), styled from `tokens.ts`.
- **`animation/`** — `useTokenAlongPath` samples a point along an SVG path
  (`getPointAtLength`); `sequence.ts` is the looping clock + per-leg windows that
  flow value leg-by-leg. Honors `prefers-reduced-motion`.

## Adding a flow

Drop a `Flow` object into `data/flows/`, register it in `data/index.ts`, and the
engine renders and animates it — no rendering code changes. Validate its
`traceRole` against `computeTraceRole()`.

The visual target is `flow_01_dark.svg` from the render workstream; the palette
and node/pill/capsule styling are ported exactly in `tokens.ts`.

## BRLT designs (F01 to F04 and the M01 mechanism)

`data/flows/brlt-f01.ts` to `brlt-f04.ts` hold the final (Sep 2026) BRLT
designs: Mastercard as orchestrator inside a "proposed orchestration scope"
boundary in F01 and F02, the card flows starting with the issuer already
holding BRLT, and F04's issuer ⇄ Trace/LP exchange. `brlt-m01.ts` is the
supplementary treasury mechanism from the earlier design package. They are
ordinary corridor flows, registered as `BRLT_FLOWS`, manual-pick only; all
are proposed designs. `tests/flow-tool/fixtures/*.json` pin their topology.

What the corridor engine gained for them, usable by any flow:

- `Leg.label` — the exact arrow caption, drawn beside the leg on every surface
  and export (above the rail gap, above a tributary, under a return loop).
- `Leg.kind: "instruction"` — a dashed message arrow drawn as straight lanes
  that fork off a box and rejoin the rail (no tube, token or hub, never on the
  relay). `FlowNode.authorizer` marks the authorization layer: it carries the
  proposal's card-network logo (`FlowConfig.authLogoUrl`), the hero hub swaps
  to that mark after the conversion, and an "authorized" chip appears where
  the funds land.
- `Flow.scope` — a proposed coordination boundary (dashed enclosure + chip +
  caption) around named boxes; never a party or a transfer.
- Two-way exchange pairs (A → B and B → A) stack the partner under the rail
  box and draw two vertical arrows.
- Return links (a leg that closes a cycle, as in M01) are detected in
  `layout.ts`, excluded from depth and trunk, and routed as loops beneath the
  rows (`LegLayout.back`).
- `Leg.id` and `Flow.specId` feed `data/graph-export.ts`, the design-contract
  export; `scripts/export-brlt-graphs.ts <dir>` writes F01..M01.json for the
  package verifier (`verify.py --candidate-dir`).
- `Flow.steps` ("How it works") renders as a numbered list under the machinery
  and in the flow slide's band; `Flow.notes` is the default Notes-drawer text
  and prints on its own Notes page in the PDF and PPTX. Notes never sit under
  the diagram.
- `Flow.proposed` / `Flow.mechanism` drive the picker chip.

QA: `/build/qa?flow=brlt-f01[&mode=deck|live|panels]` (rep-gated). Tests:
`tests/flow-tool/unit/brlt.test.ts` compares each flow's export with the
package fixtures in `tests/flow-tool/fixtures/`.
