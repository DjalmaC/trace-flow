# Proposal-agent evals

Each folder is one call: `transcript.md` plus the expected result
(`extraction.json` + `expected-spec.json` for calls that should produce a link;
`expected-outcome.md` for calls where the correct behaviour is to stop and ask).

## Why

This is the regression set for /proposal-from-call. When the skill prompt, the
references, or the underlying model changes, replay these calls and diff —
quality stays constant because drift shows up here before it shows up in front
of a client.

## Replay

For each eval: run stages 1–5 of the skill (extract → resolve → pricing →
spec → validate) on `transcript.md` — no link creation — and compare against
the expected files. Differences in dial answers, flow choice, pricing values,
or stop/ask behaviour are regressions; wording differences are not.

## Growing the set

After Diogo approves a real proposal, save the real transcript + the approved
spec here (strip anything sensitive; logo data URLs are omitted — record
source + treatment instead).
