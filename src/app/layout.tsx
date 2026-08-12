import type { Metadata, Viewport } from "next";
import { DM_Mono, DM_Sans, Inter, JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import "./trace-ds-tokens.css";

// Trace DS type system (design handoff): Poppins for display/headings, DM Sans
// for UI/body, DM Mono for numerics/dates/counts/kbd. Inter stays loaded ONLY
// for the deck-render path (flow SVGs + PDF/PPTX exports must keep matching the
// proposal template PDFs, which are set in Inter). JetBrains Mono carries the
// shared-link (/f/) presentation chrome — eyebrows, labels and numerics, per
// the BRLT deck design system.
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-poppins" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-dm-sans" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", variable: "--font-dm-mono" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const jbMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], display: "swap", variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Trace Flow — Interactive cross-border payment flows",
  description:
    "Describe the deal, and the right Trace Finance flow appears — animated and branded for the client.",
};

// Without this, phones default to a ~980px layout viewport (content overflows /
// shifts right). Render at the real device width so the responsive layout applies.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Paint edge to edge on notched phones so the sticky chrome can pad itself
  // with env(safe-area-inset-*) instead of leaving white bands.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${poppins.variable} ${dmMono.variable} ${inter.variable} ${jbMono.variable} ${dmSans.className}`}>
      <body>{children}</body>
    </html>
  );
}
