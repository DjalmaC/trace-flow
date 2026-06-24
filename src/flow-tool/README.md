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
