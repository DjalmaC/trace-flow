// Create a proposal share link from a VALIDATED spec (the `spec` object that
// resolve-and-validate.ts validate emits). Sandbox is hardcoded on unless
// --approved is passed explicitly — the /proposal-from-call skill never passes
// it; promoting a link to live is Diogo's call.
//
//   node scripts/agent/create-link.mjs <normalized-spec.json> [--local] [--base URL] [--approved]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: create-link.mjs <normalized-spec.json> [--local] [--base URL] [--approved]");
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
const spec = payload.spec ?? payload; // accept the validator's envelope or a bare spec

// rep key from the repo's .env.local (never printed)
const envPath = join(dirname(fileURLToPath(import.meta.url)), "../../.env.local");
const envLine = readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("TRACE_REP_KEY="));
const repKey = envLine?.slice("TRACE_REP_KEY=".length).trim().replace(/^["']|["']$/g, "");
if (!repKey) {
  console.error("TRACE_REP_KEY not found in .env.local");
  process.exit(1);
}

const flows = spec.flows ?? [];
const customFlows = flows.filter((f) => f.tailored).map((f) => ({ ...f.tailored, editor: undefined }));
const config = {
  flowId: flows[0]?.tailored?.id ?? flows[0]?.flowId,
  clientName: spec.company,
  clientRep: spec.contact || undefined,
  clientLogoUrl: spec.logo?.dataUrl,
  clientLogoPlate: spec.logo?.plate,
  collected: spec.collected ?? "BRL",
  delivered: spec.delivered ?? "USD",
  direction: spec.direction,
  stablecoin: spec.stablecoin,
  variants: flows.length > 1 ? flows.map((f) => ({ flowId: f.tailored?.id ?? f.flowId, name: f.name })) : undefined,
  customFlows: customFlows.length ? customFlows : undefined,
  proposalType: spec.proposalType,
  date: spec.date,
  traceRepId: spec.repId,
  salesperson: spec.salesperson,
  pricing: spec.pricing,
  gatePassword: spec.company?.trim() || undefined,
  sandbox: approved ? undefined : true,
};

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
    { code, url: `${base}/f/${code}`, password: config.gatePassword, sandbox: !approved, flows: flows.map((f) => f.name) },
    null,
    2,
  ),
);
