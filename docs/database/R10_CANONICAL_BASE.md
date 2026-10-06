# R10 canonical production base — partial checkpoint

P3 update (2026-10-06): the prior 50-form/row30-decision-pending checkpoint below
is historical context. P3 now has 51 forms, four neutralizations, and exact
owner/security-authorized fail-closed row30 gates. See R10_P3_CHECKPOINT_EVIDENCE.json,
P3_OWNER_SECURITY_DECISION.json and SIGNATURE_ALLOWLIST.json. This does not begin P4
or validate frontier defaults, runtime ownership, ACLs or convergence.
Focused verification command:

```text
node --test scripts/db/r10-contract.test.cjs scripts/db/r10-p3-static.test.cjs
```

All P3 authorization results are STATIC_VERIFIED, not runtime PASS. No historical
execution record, other prepared SQL, M1 files or active migration was modified.

Executor: CODEX_ASTRA_6. Migration owner: AGENT_1. Base main: 9611d195290247694ad60d5aa2638ac8b96ecefb.

## Status and architecture

Architecture approved: LEDGER-MIRROR + OUT-OF-BAND PRE-LEDGER FRONTIER.
This branch is BLOCKED, not an implemented/certified production base. P1/P2 are prepared.
P3 has 50 non-discoverable proposed forms. P4 and P6 are not executed.
The fresh-replay command is a fail-closed checkpoint, NOT a working replay executor.
No production/staging SQL has been applied. Main is untouched. No PR or merge.

Production history must mirror the 51 authentic version/name identities. The engineered
frontier belongs outside supabase/migrations; it must never enter a migration ledger
or be applied to production. Certified M1A x3 and M1B x1 remain byte-identical.
The intended active set is 55, but the unchanged current set is 71.

## Evidence

supabase/provenance/MANIFEST.json verifies all evidence and prepared replay files.
ledger/production/INDEX.json maps all 51 identities to SQL evidence, metadata and
proposed form. All production execution authorship remains UNKNOWN unless independently
proven; historical Git candidates are not production execution attribution.
git-history/INDEX.json records preserved, redacted or normalized representations.
One no-final-newline Git blob additionally uses an exact-byte base64 envelope.
Catalog evidence is lossless gzip/base64 AFTER redaction; the scanner decodes it.

RAW_HASH is SHA-256 of the original frozen statement representation: ledger statements
joined with LF, not a claim about server byte storage. REDACTED_HASH hashes that
representation after redaction before its canonical terminal newline. MANIFEST hashes
the actual files. Raw sensitive evidence stays outside Git. The frozen PostgreSQL
signature is not the same digest as the redacted JSON or encoded catalog.
Scoped .gitattributes preserves evidence bytes and exempts historical EOF blank lines
and unified-diff blank-context prefixes from whitespace checks. Application/certified
migration whitespace rules are unchanged; replay forms retain ledger EOF spacing.
SIGNATURE_QUERY.sql preserves the read-only P0 catalog method with terminal newline
normalization. No business rows, auth identities, Storage objects or secret values
were exported into the archive.

## STOP dependencies

1. Entry #30 (founder_invite_sales_integration_v1) embeds a production person-specific
   identity in four function authorization gates. The raw identity is not committed.
   Redacted evidence is not executable. Replacing it changes authorization semantics;
   retaining it needs an explicit owner/security/privacy decision. No form was emitted.
2. No Docker, installed WSL distribution, PostgreSQL runtime or Supabase CLI is available.
   No hosted project was created and no global installation was attempted.
3. Frontier fixed-point and every raw schema/ACL/search_path/RLS/index/constraint/view/
   trigger comparison remain NOT_EXECUTED. There is no reviewed convergence allowlist.
4. Three environment-bound neutralizations require Agent 4 review.

Do not promote proposed forms, fabricate a frontier or restructure active migrations
until those dependencies close. A head schema snapshot is NOT a pre-ledger frontier.

## Repository-only commands

From this branch root:

```text
node --test scripts/db/r10-contract.test.cjs
node scripts/db/verify-active-dir --plan-only
node scripts/db/secret-scan
node scripts/db/signature
node scripts/db/verify-active-dir
```

The final strict command intentionally fails while the 71-file directory is unchanged.
Plan-only PASS is not canonical-directory PASS. The signature command without input
does not execute comparison; with an offline redacted JSON input, it compares that
representation only, not a raw PostgreSQL signature or replay attestation.
fresh-replay never opens a connection in this checkpoint. Loopback is a candidate
classification, not an authorization: a future executor still needs empty-ledger,
empty-application-schema, local platform prerequisite and connection-identity checks.
Protected production/frozen-staging references and nonlocal/override URLs are refused.
Never pass credentials on the command line. No real target is required for guard tests.

The R10 CI job has read-only repository permissions, no secrets, database calls or
deployment. Its strict active-directory check stays red until P6 is legitimately
completed. It does NOT certify fresh replay, frontier convergence or P7.

## Future disposable validation (not executed)

An separately available local disposable Supabase/Postgres must first prove an empty
ledger and empty application schemas. Do not rebuild platform-managed internals/roles.
Assert required extensions and platform prerequisites; construct only app-owned objects.
Derive pre-ledger state by reverse effect analysis, not by replaying a production dump.
Then: engineered frontier -> 51 forms -> frozen production-base raw signature, with
separate functions/search_path, grants/ACL, RLS/policies, indexes, constraints, views,
triggers and migration-list comparisons. Only an explicit reviewed allowlist may differ.
No real users, tenant rows, secrets, Storage objects or cron schedules may be needed.
Any unapproved schema change, protected target, nonempty target or failed convergence
is an immediate STOP.

## Production contract and replacement staging

Production and frozen historical staging remain read-only. Repository conforms to
production ledger, never the reverse. Do not use migration repair, --include-all,
fake applied versions, db pull with possible ledger repair, historical SQL replay,
frontier application, resets, hidden Dashboard SQL or automatic deploy jobs.
Production db push --dry-run was NOT_EXECUTED_SAFETY_UNCERTAIN; this mission did not
verify the installed CLI's non-mutating behavior. Future separately reviewed read-only
dry-run must report exactly M1A x3 + M1B, four pending identities; anything else STOP.

Replacement hosted staging and any paid project/branch need separate Founder authority.
P7 and CFR are not authorized here. After convergence/owner/security review, Coordinator
may decide whether CFR can start. Do not implement PRE-M1A Wealth CFR, M1C, M1D or M1E
as part of this branch.
