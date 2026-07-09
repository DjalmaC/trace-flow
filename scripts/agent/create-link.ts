// Create a proposal share link from a VALIDATED spec (the `spec` object that
// resolve-and-validate.ts validate emits). Sandbox is hardcoded on unless
// --approved is passed explicitly — the /proposal-from-call skill never passes
// it; promoting a link to live is Diogo's call.
//
//   npx tsx scripts/agent/create-link.ts <normalized-spec.json> [--local] [--base URL] [--approved]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildShareConfig } from "../../src/flow-tool/agent/build-config";
import type { NormalizedSpec } from "../../src/flow-tool/agent/spec";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: create-link.ts <normalized-spec.json> [--local] [--base URL] [--approved]");
  process.exit(1);
}
const approved = args.includes("--approved");
const baseFlag = args.indexOf("--base");
const base = args.includes("--local")
  ? "http://localhost:3123"
  : baseFlag >= 0
    ? args[baseFlag + 1]
    : "https://trace-flow-three.vercel.app";

const payload = JSON.parse(readFileSync(file, "utf8"));
const spec = (payload.spec ?? payload) as NormalizedSpec; // accept the validator's envelope or a bare spec

// rep key from the repo's .env.local (never printed)
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../.env.local");
const envLine = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("TRACE_REP_KEY="));
const repKey = envLine?.slice("TRACE_REP_KEY=".length).trim().replace(/^["']|["']$/g, "");
if (!repKey) {
  console.error("TRACE_REP_KEY not found in .env.local");
  process.exit(1);
}

const config = buildShareConfig(spec, { approved });

const res = await fetch(`${base}/api/proposals`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-tf-key": repKey },
  body: JSON.stringify({ config }),
});
if (!res.ok) {
  console.error(`create failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const { code } = await res.json();
console.log(
  JSON.stringify(
    {
      code,
      url: `${base}/f/${code}`,
      password: config.gatePassword,
      sandbox: !approved,
      flows: (spec.flows ?? []).map((f) => f.name),
    },
    null,
    2,
  ),
);
