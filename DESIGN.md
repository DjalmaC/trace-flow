# Trace Flow — Design System Reference

Self-contained spec of the trace-flow visual language, extracted verbatim from
the source. Attach this file to carry the design into other projects.

Sources of truth in the repo (this file mirrors them):
`src/flow-tool/components/tokens.ts` · `tailwind.config.ts` ·
`src/components/TailoredFlowEditor.tsx` (P) · `src/flow-tool/lib/pptx.tsx` (PP) ·
`src/flow-tool/components/MachineryStage.tsx` · `src/flow-tool/components/layout.ts`

---

## 1 · The dark deck (client-facing canvas)

The signature look: near-black page, a soft green radial glow, one bright rule
across the top, elevated flat surfaces with hairline borders. No fill
gradients on surfaces, no neon glow.

```
Page & atmosphere
  base / page        #08090b / #07090b   near-black deck background
  glow1 → glow2      #15392d → #0b1714   radial green glow behind the stage
  rule               #4cc28e             3px bright rule at the very top
  ambient glow       rgba(22,35,29,.55) → rgba(13,22,17,.18), vignette rgba(0,0,0,.45)
  deck glow recipe   radial-gradient(62% 62% at 50% 46%, glowA 0%, glowB 58%, transparent 100%)

Elevated material (nodes, planes)
  surface            #0f1411             flat elevated fill
  surfaceTube        #0a110d             recessed tube/conduit channel
  rim                rgba(255,255,255,.10)  1px top rim-light inside the top edge
  hairline           rgba(255,255,255,.10)  neutral border (operational nodes)
  borderGreen        rgba(70,211,154,.22)   restrained green border (client/foreground)
  borderGreenStrong  rgba(70,211,154,.35)   hub / emphasis rim
  node fill/stroke/text   #121815 / #2b3a34 / #c2c9c5
  green node fill/text    #11241b / #eaf6ef
  drop shadow        soft neutral (SVG filter #tf-shadow)

Accents & marks
  green accent       #46d39a             primary deck accent (Pay-in)
  trace cyan         #2be8d6             secondary accent (Pay-out tint pairs with it)
  trace green        #34dca0
  mint (DS brand)    #00f2b1             CTA / interactive accent
  usdc / usdt        #2775CA / #26A17B

Currency pills & capsules
  pill fill/stroke/text   #1a221e / #33433c / #d6ddd8
  moving token fill       #0c160f (brighter, direction-tinted border)
  swap capsule fill/stroke #141b18 / #33433c

Type colors
  title #eef1ee · subtitle #aeb6b2 · muted #6f7a76 · node text #c2c9c5
  client label #7fb89f · leg lines #7c8a84 · divider/container #2c3a35
  client-logo dashed slot #4f6a5e · projector line #3f6b5a
```

## 2 · App chrome (rep-side UI, "Trace DS")

```
Mint scale        DEFAULT #00f2b1 · hover #4cf6c8 · press #00d89e
                  text-on-mint #06120c · muted #6f8a7f · avatar #7fe7c0
Cyan2             #2be8d6
Surfaces          page #07090b · card #0f1411 · card2 #0d1210 · input #0b120e
Hairlines         row #17201c · card #1c2621 · control #22302a
                  minted #1c3a2e · selected #2b5e48
Status chips      viewed bg #0f2019 (fg mint) · shared #2be8d6 on #0c2020
                  draft/sandbox #e6b566 on #241d10
Motion ease (UI)  cubic-bezier(.2,.8,.2,1)   ("ease-ds", 150–200ms)
```

## 3 · The light editor (tailored-flow canvas)

Paper-toned, the one light surface in the product:

```
page #f4f2ec · panel #fbfaf6 · bar #faf9f4
line #e6e3da · canvas dots #dedbcf
ink #1f2723 · sub #6b7570 · faint #98a09b
mint #00f2b1 · mint ink #0b8a63 · mint deep #12b98a
mint tint #e9fbf3 · mint line #9fe8cd
amber (warnings) #8a6d1a on #fdf6dd, line #ecd98d · danger #b4544a
```

## 4 · PDF / slide palette

960×540 slides matching the designed proposal templates:

```
bg #08090b · top rule #4cc28e (3.2px) · title #eef1ee · sub #6f7a76
label (small caps, letter-spaced) #7fb89f · pricing text #e8ecf0 · grey #8f98a3
pricing accents (sampled from the logo): green #06f1af · blue #4ae1fc
card fill #1a1a1f on hairlines #3a3f47
lockup: mark 44.6px square at right ~804px, "Trace Finance" Inter-Bold 20
```

## 5 · Typography

```
Deck & PDF        Inter (400/600/700), woff2 in public/fonts
Rate values       JetBrains Mono Bold (700)
App chrome        DM Sans (default) · Poppins (display) · DM Mono (numerics/dates)
Small-caps labels 10–12px, letter-spacing 0.14–0.34em, uppercase, muted color
```

## 6 · Motion grammar (the animated flow)

One token relays along a single rail; hidden behind boxes by z-order, visible
only in the gaps. Constant speed everywhere.

```
Token speed        14 ms per px (constant; long legs simply cruise longer)
Min leg time       560ms floor · station pause 260ms · end-of-flow rest 700ms
FX hub spin        1180ms; mark contracts to 0.6 scale, spins 360°, pops back
                   with easeOutBack; one impact ring on receive (~50% opacity)
Token fade at hub  hidden within 12px of hub center, full beyond 44px
Landing ripple     460ms, peak opacity 0.5, box outline expands ~11%
Deck ease          cubic-bezier(.4,0,.2,1)
Direction          Pay-in travels left→right in green; Pay-out reverses and
                   tints green→cyan (tubes, arrows, token borders tween ~550ms)
```

## 7 · Spatial system (flow layout)

```
Node box           168 × 58, radius 12  (folded "engine" 212 × 88, r14)
Rail               30px tall recessed channel, rounded 15, behind all boxes
Gaps               92px plain · 200px when a conversion hub sits on the leg
Hub                r22 circle on the rail, dark plinth + Trace mark
Branch lanes       ±96px rows off the rail; payers above, recipients below
Machinery frame    dashed 1px container (dash 3 4), radius 16,
                   fill white at 1.8% opacity; lane labels 12px muted
Brazil|Abroad      vertical dashed divider (dash 3 5) through the FX hub
Curves             tributaries join as cubic S-curves anchored at box centers,
                   control offset max(64, Δx·0.55) — flat tangents at both ends
Platform frame     brand-color rounded rect (r18), stroke at 40% opacity,
                   fill at 2.8%; logo chip breaks the top edge; caption below
```

## 8 · Assets

`public/assets/`: trace_logo.png, trace_lockup_mark.png (1200×1200), usdc.png, usdt.png
`public/fonts/`: inter-400/600/700.woff2, jetbrains-mono-700.woff2

## 9 · Voice & copy rules

- No em or en dashes in client-facing generated text; use periods or middots.
- Small-caps section eyebrows ("BENEATH THE SURFACE", "THE DESIRED TRANSACTION").
- Headline pattern: "Built for {Company}" with the company name in mint.
- Quiet, confident captions: "Native to the {Company} platform. Trace operates
  the rails underneath."
