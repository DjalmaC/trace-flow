// Deterministic core of the /proposal-from-call skill. Two commands:
//
//   npx tsx scripts/agent/resolve-and-validate.ts resolve  <extraction.json>
//   npx tsx scripts/agent/resolve-and-validate.ts validate <spec.json>
//
// `resolve` runs the extracted dial answers through the product's real intake
// resolver and reports the matching flow(s) or exactly which dials are still
// open. `validate` takes the composed ProposalSpec and gates every part of it
// through the same code the app uses (roster, flow library, normalizeTailored
// + deckReadyChecks, normalizePricing + floor guardrails), emitting either a
// normalized spec ready for create-link.ts or a list of errors/questions.
// The LLM never gets to be creative past this file.
//
// This is a thin CLI shell: the logic lives in src/flow-tool/agent/ and is
// shared with the remote MCP tools (src/app/api/mcp).

import { readFileSync } from "node:fs";
import { resolveExtraction } from "../../src/flow-tool/agent/resolve";
import { validateSpec } from "../../src/flow-tool/agent/validate";
import type { Extraction, ProposalSpec } from "../../src/flow-tool/agent/spec";

export type { ProposalSpec, SpecFlowRef } from "../../src/flow-tool/agent/spec";

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const [, , command, file] = process.argv;
if (!command || !file) die("usage: resolve-and-validate.ts <resolve|validate> <json-file>");
const input = JSON.parse(readFileSync(file, "utf8"));

if (command === "resolve") {
  const r = resolveExtraction(input as Extraction);
  if (r.status === "invalid-answers") {
    console.log(JSON.stringify({ status: r.status, badKeys: r.badKeys, badValues: r.badValues }, null, 2));
    process.exit(2);
  }
  console.log(
    JSON.stringify(
      {
        status: r.status,
        candidates: r.candidates,
        exactFlowId: r.exactFlowId,
        direction: r.direction,
        openQuestions: r.openQuestions,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (command !== "validate") die(`unknown command: ${command}`);

const r = validateSpec(input as ProposalSpec);
if (!r.ok) {
  console.log(JSON.stringify({ ok: false, errors: r.errors, questions: r.questions, flags: r.flags }, null, 2));
  process.exit(r.errors.length ? 2 : 3);
}
console.log(JSON.stringify({ ok: true, flags: r.flags, spec: r.spec }, null, 2));
