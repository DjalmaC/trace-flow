import type { Config } from "tailwindcss";

// Design tokens ported from the Trace deck (see src/flow-tool/components/tokens.ts
// for the canonical source of truth; mirrored here for Tailwind utility access).
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/flow-tool/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        deck: {
          base: "#08090b",
          glow1: "#15392d",
          glow2: "#0b1714",
          rule: "#4cc28e",
        },
        node: {
          fill: "#121815",
          stroke: "#2b3a34",
          text: "#c2c9c5",
        },
        green: {
          accent: "#46d39a",
          fill: "#11241b",
          text: "#eaf6ef",
        },
        pill: {
          fill: "#1a221e",
          stroke: "#33433c",
          text: "#d6ddd8",
        },
        trace: {
          cyan: "#2be8d6",
          green: "#34dca0",
        },
        leg: "#7c8a84",
        muted: "#6f7a76",
        title: "#eef1ee",
        subtitle: "#aeb6b2",
        client: "#7fb89f",
        usdc: "#2775CA",
        usdt: "#26A17B",
        // Trace DS (design handoff) — brand mint + supporting surface/hairline
        // scale used by the redesigned screens. Mint is the primary CTA color.
        mint: {
          DEFAULT: "#00f2b1",
          hover: "#4cf6c8",
          press: "#00d89e",
          on: "#06120c", // text on mint
          muted: "#6f8a7f",
          avatar: "#7fe7c0",
        },
        cyan2: "#2be8d6",
        surface: {
          page: "#07090b",
          card: "#0f1411",
          card2: "#0d1210",
          input: "#0b120e",
        },
        hairline: {
          row: "#17201c",
          card: "#1c2621",
          control: "#22302a",
          minted: "#1c3a2e",
          selected: "#2b5e48",
        },
        status: {
          viewedBg: "#0f2019",
          sharedFg: "#2be8d6",
          sharedBg: "#0c2020",
          draftFg: "#e6b566",
          draftBg: "#241d10",
        },
      },
      fontFamily: {
        // DS type system: DM Sans is the app default; Poppins for display;
        // DM Mono for numerics/dates/kbd. Inter remains for the deck/export path.
        sans: ["var(--font-dm-sans)", "system-ui", "Arial", "sans-serif"],
        display: ["var(--font-poppins)", "var(--font-dm-sans)", "sans-serif"],
        mono: ["var(--font-dm-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        ds: "cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [],
};

export default config;
