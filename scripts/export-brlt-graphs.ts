// Export the BRLT designs (F01 to F04, M01) in the design package's graph.json
// shape, for the package verifier:
//   npx tsx scripts/export-brlt-graphs.ts <out-dir>
//   python3 _reference/trace-four-individual-flows/verify.py --candidate-dir <out-dir>
// Read-only against the app; writes JSON files only.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BRLT_FLOWS } from "../src/flow-tool/data";
import { flowGraphExport } from "../src/flow-tool/data/graph-export";

const out = process.argv[2];
if (!out) {
  console.error("usage: tsx scripts/export-brlt-graphs.ts <out-dir>");
  process.exit(2);
}
mkdirSync(out, { recursive: true });
for (const f of BRLT_FLOWS) {
  const g = flowGraphExport(f);
  writeFileSync(join(out, `${g.id}.json`), JSON.stringify(g, null, 2) + "\n");
  console.log(`${g.id}: ${g.nodes.length} nodes, ${g.edges.length} edges → ${join(out, `${g.id}.json`)}`);
}
