import type { Metadata } from "next";
import { SharedFlowView } from "./SharedFlowView";
import { sharedLinkMetadata } from "@/flow-tool/lib/share-meta";

// Public, view-only client link: /f/<code>. No control panel, no access to the
// rest of the tool — just the one flow drafted for that client.
// Tailored link preview, same as the slugged route (see share-meta.ts).
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return sharedLinkMetadata(code);
}

export default async function SharedFlowPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SharedFlowView code={code} />;
}
