import type { Metadata } from "next";

// The proposal-setup step is part of the editor surface, so it shares the
// colorless (gray) tab icon (see build/layout.tsx). Overrides the root `icons`.
export const metadata: Metadata = {
  icons: { icon: "/assets/trace_icon_gray.png" },
};

export default function NewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
