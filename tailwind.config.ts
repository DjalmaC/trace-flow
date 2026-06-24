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
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
