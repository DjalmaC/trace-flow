import type { Metadata } from "next";

// The flow editor gets a colorless (gray) tab icon, so an editing tab is
// distinguishable at a glance from a client-facing proposal tab (which keeps
// the full-colour mark from the root layout). Overrides the root `icons`.
export const metadata: Metadata = {
  icons: { icon: "/assets/trace_icon_gray.png" },
};

export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
