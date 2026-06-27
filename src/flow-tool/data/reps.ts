import type { TraceRep } from "./schema";

// ─────────────────────────────────────────────────────────────────────────────
// Trace Finance salespeople roster.
//
// SOURCE OF TRUTH: "Trace Finance - Sales contact slides.pdf", copied into the
// app at `public/proposals/sales-slides.pdf` — one slide per rep. `slidePage`
// (0-based) points at each rep's pre-designed contact slide; at proposal-build
// time that slide REPLACES the template's generic closing slide, fully designed
// and pre-filled (see lib/proposal.ts).
//
// To add a rep: add their slide to the deck, re-copy the PDF, and add an entry
// here with the new slidePage.
// ─────────────────────────────────────────────────────────────────────────────

export const TRACE_REPS: TraceRep[] = [
  {
    id: "victor-morelli",
    name: "Victor Morelli",
    title: "Head of Sales",
    email: "vmorelli@trace.finance",
    slidePage: 1,
  },
  {
    id: "diogo-cassinelli",
    name: "Diogo Cassinelli",
    title: "Business Development Manager",
    email: "dcassinelli@trace.finance",
    slidePage: 0,
  },
  {
    id: "rafael-vieira",
    name: "Rafael Vieira",
    title: "Business Development Manager",
    email: "rvieira@trace.finance",
    slidePage: 2,
  },
  {
    id: "beatriz-lara-de-mello",
    name: "Beatriz Lara de Mello",
    title: "Business Development Manager",
    email: "bmello@trace.finance",
    slidePage: 3,
  },
];

export function getRep(id: string | undefined): TraceRep | undefined {
  if (!id) return undefined;
  return TRACE_REPS.find((r) => r.id === id);
}
