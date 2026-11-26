# Coach Memory / Memoria del Entrenador — development specification

## Status
Draft schema only, not applied. Depends on verified Universal Athlete Identity enrollment. Existing coach codes and normalized names are not authorization to persist or retrieve athlete memory. No production data or browser write endpoint is added.

## Record types
Versioned structured events: confirmed personal BPM (measurement source and date, not Ritnome substitution), coach-approved plan (stage, selected stations/modes, confirmed BPM, frequency, dated cycle), goal (metric, baseline, target), cycle evaluation (dates, counts, medians, missing-data flags), coaching decision (bounded structured reason), correction (references same-membership event). No unrestricted personal notes in first release. No names, credentials, photos, health data or raw player keys in payload.

## Access flow
1. Verify athlete UUID and enrollment through trusted operator, not name matching. Confirm guardian authority as applicable.
2. Authenticate named coach through supported auth. Provision a revocable grant to the specific athlete membership. Existing shared coach code does not prove named coach identity.
3. Trusted backend derives actor from authenticated session, verifies active membership and grant on every request, resolves source record links, validates typed payload and date, then inserts idempotently in a transaction. Never trust client-supplied author, school or athlete identifiers alone.
4. Read only within current authorized membership. Transfers do not grant new coach automatic access to prior membership records. Athlete/guardian access is a separate reviewed feature.
5. Preserve original events; corrections append references. Define retention, authorized deletion, audit and incident response before piloting. Permanent means durable across sessions, not indefinite retention.
6. Do not save a plan without explicit coach confirmation. Coach can review temporary plan before saving. No automatic BPM change.

## Release gates
Isolated test database: anonymous access denied; unrelated coach denied even with UUID; revoked grant denied; ended membership denied; forged author rejected; same-name profiles isolated; duplicate request idempotency; cross-membership correction denied; schema and size validation; no source deletion; authenticated guardian cannot access coach-only records; verify session revocation. Test rollback and run database advisors. Review existing identity source primary keys, legacy access model and data minimization. Production migration requires separate approval.

## UI
Spanish-first, English toggle; coach sees dated saved plans/goals/decisions and source evidence, with explicit Save action only after backend is ready. No localStorage workaround, no public exports of private memory. Age stage is coach-confirmed and does not set personal BPM.
