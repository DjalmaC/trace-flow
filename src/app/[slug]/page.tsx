import { notFound } from "next/navigation";
import { SharedFlowView } from "../f/[code]/SharedFlowView";

// Client-named share link: /<company>-<tail> (e.g. /nuvera-k4x2) — the form
// that ships to clients on the branded domain. Renders the exact same view as
// /f/<code>; the flow API resolves either the code or its slug alias. Static
// routes (/build, /new, /logo-lab, /f/…) always win over this dynamic segment.
//
// Only slug-SHAPED paths reach the viewer: kebab name + random tail. Anything
// else (stray root files like /apple-touch-icon.png, bot probes, bare words —
// slugs always carry a "-tail") gets a real 404 instead of a soft-404 through
// the proposal viewer and a wasted /api/flow round trip.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}-[a-z0-9]{4,12}$/;

export default async function SluggedFlowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SLUG_RE.test(slug)) notFound();
  return <SharedFlowView code={slug} />;
}
