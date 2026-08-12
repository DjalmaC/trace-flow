import { SharedFlowView } from "../f/[code]/SharedFlowView";

// Client-named share link: /<company>-<tail> (e.g. /nuvera-k4x2) — the form
// that ships to clients on the branded domain. Renders the exact same view as
// /f/<code>; the flow API resolves either the code or its slug alias. Static
// routes (/build, /new, /logo-lab, /f/…) always win over this dynamic segment,
// and slugs always carry a "-tail", so they can never collide with app paths.
export default async function SluggedFlowPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SharedFlowView code={slug} />;
}
