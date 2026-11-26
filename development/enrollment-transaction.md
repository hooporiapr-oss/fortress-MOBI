# Secure enrollment transaction prototype

Not deployed. The private SQL transaction consumes a preverified, expiring approval and creates an athlete UUID, membership, optional independently verified athlete/guardian grants and an audit receipt atomically. Retries of an active approval return the existing receipt. No coach grant or historical record link is created implicitly.

The approval must be created by a trusted operator following independent verification of identity, authority, account ownership and duplicate risk. No endpoint for issuing approvals exists yet. Re-enrollment or transfers must reuse verified identity through a separately reviewed transaction, not this new-identity function.

Before activation: implement authenticated session verification (including non-anonymous actor, revocation and expiry), review locking of approver grants and revocation, assign a least-privilege backend database role, validate verified account status, establish secure operator approval workflow, and test all SQL in an isolated database. Actor must never originate from request data. No legacy records changed. No production migration or deployment authorized by this commit.

Acceptance: anonymous/direct browser execution denied; wrong program denied; revoked/expired approval denied; revoked administrator denied; atomic rollback on any failed insert; concurrent duplicate consumption returns one UUID; guardian access limited to explicit account; no coach grant by default; no source record link; no existing identity overwritten. Test session revocation and concurrent approver revocation separately before production.
