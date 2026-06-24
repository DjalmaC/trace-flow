import { SharedFlowView } from "./SharedFlowView";

// Public, view-only client link: /f/<code>. No control panel, no access to the
// rest of the tool — just the one flow drafted for that client.
export default async function SharedFlowPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SharedFlowView code={code} />;
}
