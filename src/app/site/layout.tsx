import type { Metadata } from "next";

// The corporate site, recreated one-for-one in the BRLT glass family
// (design-ref/STYLE.md). Public — the gate middleware doesn't match /site.
export const metadata: Metadata = {
  title: "Trace — Payments & stablecoin infrastructure for Brazil and LatAm",
  description:
    "Convert BRL to stablecoins in under a minute through PIX. Hold BRL, USD and EUR accounts, and settle cross-border payments 24/7 — all through one compliant API.",
  icons: { icon: "/assets/trace_icon.png" },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
