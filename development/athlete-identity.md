# Identidad Única del Atleta / Universal Athlete Identity

Development proposal only. No production SQL or client integration has been applied.

## Existing sources
- Hooporia: hooporia_mobi_runs.id and player_key.
- Reaction Velocity / Cognitivo Gym: vr_mobile_standings.admin_id and vr_reaction_speed_standings.id/admin_id. Confirm source primary keys and station provenance before linking.
- Existing player_teams keys are not a universal identity.

## Enrollment and verification
1. A trusted enrollment operator verifies the athlete and guardian authority when needed. Use existing program membership evidence, not name alone.
2. Create UUID and explicit authenticated access grants. Guardian access is separate and revocable.
3. Verify possession of existing device credential through a server-side flow, plus program confirmation as appropriate; never log or expose the key. Never accept a UUID or name as proof of identity.
4. Historical records from platforms without verified keys remain unlinked until individually verified. Ambiguous records stay untouched. Do not infer ownership from a name, team or school.
5. New training writes must be server-validated against athlete and program membership. Do not trust arbitrary UUIDs from browsers.
6. Existing coach codes remain unchanged until scoped coach membership authorization and negative tests are implemented. No cross-program access by default.

## Acceptance criteria
- Anonymous reads and all client writes denied.
- User A cannot read user B's identity, even knowing UUID.
- Guardian only sees explicitly granted athlete; revoke removes access.
- Source record cannot link to two athletes; no source deletion.
- Same-name athletes stay distinct; transfers preserve identity but not prior coach access.
- No new public report endpoint until ownership, hidden-record rules and parent authorization are tested.
- Verify source key uniqueness, auth session behavior, existing API grants, and RLS in isolated test database.
- Permanent goals and plans should be added only after identity and access are verified.

## Release order
First validate existing Coach View / Mi Pasaporte branch. Separately test identity schema with synthetic accounts, implement verified enrollment and scoped reporting, then pilot with explicit authorization. No hosted migration without approval.
