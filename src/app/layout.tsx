import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
