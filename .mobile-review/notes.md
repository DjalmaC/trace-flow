# Mobile review notes

## Starting the server

From the worktree root (`.env.local` must be present, it already is):

```
npx next dev -p 3100
```

Production build check: `npx next build`.

## URLs and what they render

All /f/ and slug pages hit the live share API (Supabase via `.env.local`).
Open them with the rep key in localStorage to bypass gates and analytics:
`localStorage.setItem("tf:rep-key", <TRACE_REP_KEY from .env.local>)`.

- `http://localhost:3100/` : rep sign-in (internal landing).
- `http://localhost:3100/f/z4mf3eeyn` : ARQ sandbox proposal. Two flow
  variants (Payout for Latin tourists, Liquidity from Arq MX), pricing with
  5 cards, salesperson closing, client logo on a light plate.
- `http://localhost:3100/f/gg9vi8nbc` : Nuvera proposal. Two variants; the
  second (Treasury netting, flow-13) renders the netting archetype stage.
- `http://localhost:3100/meta-z99mee` : slug-alias route (/[slug]), three
  variants, direction locked to Pay-in, no pricing. Note: this row has an
  empty client name in the data, so the hero reads "Built for" alone; that
  is a data artifact of this test row, not a rendering rule.
- `http://localhost:3100/build` and `/new` : internal tools, out of scope
  for redesign; verify they still work.

## Screenshots in this folder

Named `<page>-<viewport-width>.png`. Viewports: 390x844, 430x932, 360x800
(portrait, mobile UA + touch), and 1440x900 desktop for regression checks.

- `arq-hero-*` : ARQ viewport-sized capture at the top of the page.
- `arq-full-*` / `arq-variant2-*` / `arq-pricing-*` : full-page captures of
  the ARQ flow view, its second variant, and the Pricing tab.
- `nuvera-full-*` / `nuvera-netting-*` : Nuvera default flow and the
  netting-archetype variant.
- `meta-slug-*` : the slug-alias page.
- `landing-*` : the rep sign-in at `/`.

Full-page captures paint fixed/sticky chrome (the top bar and the bottom
action bar) at their scroll positions, so mid-page bars in the tall PNGs are
a capture artifact; the `arq-hero-*` viewport shots show true placement.

The pricing tier labels ("USD 1M – 5M") come from stored proposal data.
