# Protected personal BPM (development)
Separate from mutable public standings. Never automatically trust a free-BPM string or match a name.
A future trusted submission transaction must verify actor session, active athlete identity/membership and authorization, validate measurement protocol and result, enforce replay protection and preserve provenance. Client-reported results are not tamper-proof.
A separate coach confirmation transaction must lock membership and coach grant, enforce that measurement athlete equals membership athlete, preserve original measurement and return immutable confirmation reference. No direct browser or runtime table access.
Training plan transaction must reference that confirmation for the same membership and derive BPM from the stored measurement, never trust a submitted numeric BPM. Keep memory-only plans available. Until those checks pass the existing server wrapper continues rejecting non-null BPM.
Legacy results may be reviewed as unverified context only. No backfill or change to legacy permissions in this draft. Audit legacy delete/insert exposure separately and test compatibility before hardening.
Schema draft is not yet executable in the release workflow; cross-table same-athlete enforcement, submission and confirmation authorization, concurrency, revocation, corrections and tests are pending. Do not deploy.
