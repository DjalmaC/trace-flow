import { FLOWS, defaultConfig } from "../data";
import type { DialCoordinate, Direction, Flow, FlowConfig } from "../data/schema";
import { QUESTIONS, type IntakeAnswers } from "./questions";

// ─────────────────────────────────────────────────────────────────────────────
// The resolver (build brief §5b / spec §6).
//   Stage A — assemble a (partial) DialCoordinate from the intake answers.
//   Stage B — match it against the flow library.
// Brazil v0.1 is *matcher-only*: a coordinate that matches no flow is a red flag
// for human review, never an invented flow.
// ─────────────────────────────────────────────────────────────────────────────

export interface Resolution {
  /** The partial dial coordinate assembled from the answers given so far. */
  coordinate: Partial<DialCoordinate>;
  direction: Direction;
  /** Flows still consistent with every answered dial. */
  candidates: Flow[];
  status: "empty" | "partial" | "exact" | "no-match";
  /** Set only when status === 'exact'. */
  config?: FlowConfig;
}

/** Stage A — merge each answer's patch into a partial coordinate + direction. */
export function resolveCoordinate(answers: IntakeAnswers): {
  coordinate: Partial<DialCoordinate>;
  direction: Direction;
} {
  let coordinate: Partial<DialCoordinate> = {};
  let direction: Direction = "collection";
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (!a) continue;
    const opt = q.options.find((o) => o.value === a);
    if (!opt) continue;
    if (opt.patch) coordinate = { ...coordinate, ...opt.patch };
    if (opt.direction) direction = opt.direction;
  }
  return { coordinate, direction };
}

/** Stage B — flows whose dials equal every *specified* field of the coordinate. */
export function matchFlows(coordinate: Partial<DialCoordinate>): Flow[] {
  const keys = Object.keys(coordinate) as (keyof DialCoordinate)[];
  if (keys.length === 0) return [...FLOWS];
  return FLOWS.filter((flow) =>
    keys.every((k) => flow.dials[k] === coordinate[k]),
  );
}

export function resolve(answers: IntakeAnswers, clientName?: string): Resolution {
  const { coordinate, direction } = resolveCoordinate(answers);
  const specified = Object.keys(coordinate).length;
  const candidates = matchFlows(coordinate);

  let status: Resolution["status"];
  if (specified === 0) status = "empty";
  else if (candidates.length === 0) status = "no-match";
  else if (candidates.length === 1) status = "exact";
  else status = "partial";

  const resolution: Resolution = { coordinate, direction, candidates, status };

  if (status === "exact") {
    resolution.config = {
      ...defaultConfig(candidates[0].id, clientName),
      direction,
    };
  }
  return resolution;
}

/** The human-review message shown on a no-match (spec §6). */
export const NO_MATCH_MESSAGE =
  "This looks like a custom structure — let's map it with the Trace team.";
