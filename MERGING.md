# Merging Trace Flow into the Trace Router

This tool is built to fold into the Trace Router later (it mirrors the Router's
stack: Next.js App Router + TypeScript + Tailwind + Vercel).

## The module

Everything mergeable lives in **`src/flow-tool/`**. It imports only React,
Framer Motion, and its own documented Tailwind tokens — no app-specific coupling.

```
src/flow-tool/
  data/        schema.ts (THE CONTRACT) · flows/flow-01..10 + flow-09-1 · index.ts (registry)
  intake/      questions.ts · resolver.ts   (intake → dials → flow)
  components/  FlowExperience.tsx · HeadlineStage · MachineryStage · FlowSvg/* · layout.ts · tokens.ts
  proposal/    ProposalDocument.tsx · buildProposal.ts   (FlowConfig → print-to-PDF proposal)
  animation/   useTokenAlongPath.ts · sequence.ts
  assets/      (served from /public/assets — trace_logo, usdc, usdt)
```

## Public surface

- `<FlowExperience config={FlowConfig} />` — the scroll story.
- `<FlowExperience config={FlowConfig} presentation />` — full-bleed, no scroll.
- `FLOWS` / `getFlow(id)` — the flow registry.
- `resolve(answers): Resolution` — intake → `FlowConfig | no-match`.
- `<ProposalDocument config={FlowConfig} />` — the print-to-PDF client proposal.

The control panel (`src/components/ControlPanel.tsx`) and the future
Router-driven caller are just **producers of `FlowConfig`** — the engine doesn't
care where the config comes from.

## To merge

1. Copy `src/flow-tool/` into the Router and the three assets into its
   `public/assets/`.
2. Mount `<FlowExperience>` on a route.
3. Feed it a `FlowConfig` from the Router's existing client / bank / compliance
   data instead of the manual panel. **The intake resolver is the natural join
   point** — the Router already determines much of the dial coordinate
   (`DialCoordinate` in `data/schema.ts`), so it can call `matchFlows()` /
   `resolve()` directly and skip the questionnaire.
4. Keep `components/tokens.ts` as the theme source of truth for reconciliation.

## Computed fields

`settlement-form` and `trace-role` are **computed** from the dials (spec §2.1);
`computeTraceRole()` in `data/schema.ts` reproduces all eleven classifications
and can be used to validate any new flow before it's persisted.

## TODO(v2) seams

- **"Generate Proposal"** export — *done*: a print-to-PDF proposal document
  (`src/flow-tool/proposal/`, opened from the control panel). It's structural
  today; commercials plug in via the optional `FlowConfig.pricing`
  (`ProposalPricing` in `data/schema.ts`) — supply a pricing template and the
  document renders the breakdown with no further changes.
- Corridors beyond Brazil (more flows + dials; the lane model parameterizes by country).
- Wiring intake to the Router's routing / compliance catalog.
