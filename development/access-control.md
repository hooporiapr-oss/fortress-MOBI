# Centro de Autorización — Access Control Center

Development draft. Not deployed. Apply identity, coach memory, then access control drafts in isolated testing only.

| Actor | Scope | Allowed |
|---|---|---|
| Program administrator | Explicit active program grant | Verify enrollment and provision/revoke scoped grants through future backend |
| Coach | Explicit active athlete membership grant | Read and append approved memory events within membership |
| Athlete | Explicit identity grant | Own approved athlete records only, not coach memory |
| Guardian | Explicit verified identity grant | Approved athlete records only, not coach memory |

Roles do not imply one another. An administrator cannot read coach memory merely by administering a program. Coach codes, names, school labels and client-provided actor IDs are not proof of authorization. No client calls to private authorization helpers.

## Backend transaction contract
Verify signed non-anonymous session and revocation; derive actor from trusted session; lock target membership and grant rows in consistent order; recheck current scope, timestamps and revocation within transaction; validate typed event; insert idempotently. Revocation and transfer use the same locking protocol. No service credential in browser. Enrollment and guardian authority must be independently verified by authorized operator. Program grant cannot authorize unrelated program. Source links must have verified immutable keys. No name matching. No endpoint implemented yet.

## Test matrix
Anonymous denied; forged actor rejected at session boundary; expired/revoked session denied; admin A cannot manage B; admin alone cannot read memory; coach A cannot access athlete B; revoked coach denied; future/ended membership denied; athlete and guardian roles distinct; revoked guardian denied; no direct browser table/function access; no cross-membership corrections; concurrent revocation/write serialized; duplicate requests idempotent. Test on synthetic accounts in isolated database and review advisors before production authorization.
