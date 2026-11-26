# Architecture decision — 2026-11-26

Status: accepted for the current training scope. This document does not authorize a production release.

## Platform boundaries

- Fortress MOBI (hooporia.mobi): independent athlete entry; standardized cognitive training. Fortress uses 120 BPM; Recall, Recognition and Replay use 100 BPM. Preserve existing timing, difficulty progression, scoring and comparability of results. Reaction Speed is not a required station or prerequisite for MOBI.
- Reaction Velocity (vreaction.com): independent elementary-age reaction training. Its existing Reaction Speed engine establishes the athlete's current reaction BPM for compatible exercises. Preserve gameplay and the current implementation; no new integration is required by this decision.
- Ritnome: optional rhythmic warm-up in both platforms. Manual tempo and tap tempo are distinct from measured Reaction Speed. Do not make a warm-up or cross-platform BPM prerequisite for training.
- Coach View: preserve existing unified reporting and developmental-stage/adaptive training-cycle functionality already in MOBI main. Shared reporting does not imply shared onboarding or a common mandatory training tempo.

## Development preservation and release boundaries

- Keep the experimental Personal BPM host, authentication adapter, universal bridge, cognitive practice adapters, Coach Memory schema and backend in development. They are not approved for production activation by this decision.
- Fortress MOBI PR #3 is an experimental draft; PR #5 is validation-only and must not be merged. Hooporia Server PR #1 remains disabled and draft. Do not merge these wholesale, apply draft SQL, or activate the backend without a separately approved scope and release review.
- Validated evidence: Fortress MOBI Actions runs 45824258452 (Ritnome browser), 45826675966 (17/17 Personal BPM host tests), 45826675954 (isolated SQL), and 45826676148 (browser regression); Hooporia Server run 45827055286 (real disposable local Auth and restricted prescription lookup). The cross-repository integration run 45827722039 was pending at the last recorded check; do not infer success or production readiness from these isolated tests.
- Production functionality is not changed by this document. No further BPM code changes or deployment are required for the accepted architecture. Final operational checks should use existing live functionality without altering athlete data or requiring a new release.
- Interactive Metronome is a separate future project, outside this scope.

## Reopening this work

Require an explicit new objective before resuming experimental personalization or persistent Coach Memory. Distinguish standardized cognitive assessment from optional personalized practice; preserve existing production functionality. Review current branches and test evidence rather than repeating completed work.
