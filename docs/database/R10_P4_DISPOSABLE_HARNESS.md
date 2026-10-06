# R10 P4 — disposable harness preparation

This is a preparation checkpoint, not a successful fresh replay, fixed-point proof,
deployment, P7 certification, or authority to publish the branch. Migration owner:
Agent 1. Architecture remains ledger-mirror plus out-of-band pre-ledger frontier.

## Execution boundary

The separate `r10-p4-disposable-replay.yml` workflow accepts only the R10 branch in
the exact repository, on GitHub-hosted Ubuntu 24.04. It has read-only GitHub contents
permissions. Manual dispatch requires the exact workflow SHA. The branch-scoped
push trigger makes the workflow discoverable without modifying main; a future
push requires separate Founder authorization. The existing evidence-guards
workflow is unchanged. No secrets context, environment deployment, account token,
project link or hosted database is used.

Supabase CLI 2.120.0 is installed from its public GitHub release, with SHA-256
`7074584113aa00495beeac661c41fb09f1ddd0a483cd7333894b0d080086dc6e`.
Node 24 and Docker run on the disposable runner. PostgreSQL major 17 is requested;
the actual server and Docker versions are captured, not represented as verified
before execution. Platform image/version differences are not silently allowlisted.

The runner rejects protected production/staging refs in any environment value
(including percent-encoded values), database/PG/Supabase/remote-Docker settings,
self-hosted runners, main, other repositories and unsupported events. Child
processes receive a minimal environment with no hosted credentials. Docker is
hardwired to the runner's Unix socket; the database container must be running on
exactly the owned internal Docker network. Every SQL call rechecks the immutable
container ID and network. SQL uses a Unix socket inside that container, not a URL,
hostname or user-supplied connection. Remote SQL primitives and psql meta-commands
are refused. Internal networking also prevents outbound database SQL connectivity.

`supabase start` can apply migrations/seeds automatically. Therefore it receives a
new runner-temp scratch directory, isolated config, empty migrations directory,
and migrations/seeds disabled. The repository's 71 active historical migrations
are never passed to the CLI. Startup/status output can contain local JWT keys:
startup output is suppressed and `supabase status` is never collected or uploaded.
Cleanup targets only this run's local project/network; no `--all` cleanup is used.

## Frontier gate (not derived)

The harness intentionally fails `FRONTIER_NOT_DERIVED` while these are absent:

- `supabase/frontier/production_base_frontier.sql`
- `supabase/frontier/FRONTIER.json`
- matching non-null `IMMUTABLE_HASHES.json` frontier pin

The future descriptor must contain `kind=ENGINEERED_PRE_LEDGER_FRONTIER`,
`not_ledgered=true`, `first_production_version=20260723210120`, its SQL `sha256`,
and all three `requires_business_data`, `requires_real_auth_users`,
`requires_production_secrets` set to false. The SQL hash must match both descriptor
and immutable pin. It is outside CLI discovery and outside the migration ledger.
No frontier is created, substituted by a head snapshot or derived in this mission.

Before frontier application the runner requires empty application relations,
functions and types (extension-owned objects excluded), and an empty or absent
migration ledger. A failure in this platform-boundary check is a blocker, not
permission to drop platform objects. The frontier must leave the ledger empty.

## Replay and signatures

Only the 51 indexed, manifest-bound prepared production replay forms are run in
strict ledger order. Their bytes are unchanged. Local ledger records are inserted
only AFTER actual successful execution of each form. This is fresh local execution
bookkeeping, never migration repair or fake historical application. Prefix ledger
identity/order is checked after every form; M1A/M1B are never executed. The active
migration directory remains untouched (P6 is not started).

The exact frozen P0 catalog query is reused. It includes schemas, relations,
columns/types/defaults/nullability, constraints, indexes, functions/signatures/
owners/security/search_path, ACL/effective privileges, RLS state, policies,
triggers, views, sequences, Storage bucket configuration/policies, and platform/
extension prerequisites. Migration identity/order is checked separately. No tenant
data is part of signature equivalence.

`PRODUCTION_BASE_SIGNATURE.lossless.redacted.json` is a supplementary lossless
representation of the frozen PostgreSQL JSONB text. Its raw pre-redaction digest
is verified against P0 `affd3c4f7a5155fcbedb9bcf9999477c2e3275a492710fd2859b98ba88f82be9`.
Only the existing personal-email redaction is applied. The reviewed compressed
representation has its own decoded digest and provenance-manifest entry. Existing
P0 evidence is unchanged. Large sequence integers are preserved as numeric lexemes
instead of rounded JavaScript numbers. Normalization sorts object keys only;
array ordering and all catalog values remain significant.

The exact P3 allowlist and four neutralization metadata files are byte-pinned.
#1, #3 and #18 are DML/infrastructure omissions, with zero catalog exclusions.
#30 substitutes only its four exact before/after gate patches in frozen function
definitions. No function-body wildcard, ACL exclusion or whitespace normalization
is permitted. Every other difference fails. An unlisted fixed-point difference
sets `AGENT_2_ARCHITECTURE_ESCALATION_REQUIRED`; do not expand the allowlist or
change historical schema semantics in response.

## Prepared runtime security checks

The SQL suite executes after signature capture, in one rolled-back transaction.
It asserts both marketplace payment defaults are exactly false; zero real owners,
leads/invites/auth identities; all five #30 function signatures, trusted owner,
SECURITY DEFINER, fixed search_path, PUBLIC denial and effective anon/auth/service
ACLs; actual anon/auth execution denial; and actual service_role owner-only success.

Synthetic platform-admin rows use NULL auth linkage and reserved test addresses;
no real auth user or permanent owner is provisioned. Actor tests cover null,
missing, inactive owner/prospector, admin/support/finance/super_admin, exact owner,
prospector-only mixed paths, creator ownership, non-null sales lead and current
lead assignment for rotation/revocation. The partial unique active-owner invariant
is checked separately from authorization. NULL/invalid roles are rejected by the
existing NOT NULL/check constraints; this is honestly reported as constraint proof,
not a function invocation with an impossible stored role. P3 static evidence proves
the explicit null-role fail-closed gate. No constraints/privileges are weakened.
Trusted server callers must still derive actor identity from trusted context;
this harness does not redesign server call sites.

## Evidence and remaining requirements

Only allowlisted JSON files under runner-temp `r10-p4-evidence` may be uploaded,
after a second privacy scan. Outputs include versions, frontier/replay hashes,
execution log/ledger, raw/normalized signature, diff, allowlist report, runtime
security results, fresh-state check and final attestation. No CLI logs, scratch
config, connection URLs, JWTs, identities or raw subprocess error output is uploaded.
On early failure, only available evidence is emitted; missing evidence is never
fabricated. Errors are bounded stage identifiers. A failed cleanup also blocks PASS.

Local preparation verification: built-in Node static tests and scoped ESLint.
Docker/Postgres/CLI execution, SQL runtime validation and fixed-point convergence
remain NOT_EXECUTED in this environment. Workflow YAML parsing is a syntax check,
not GitHub execution proof. P4 runtime remains dependent on a reviewed derived
frontier and an independently authorized branch publication. A failed run cannot
be relabelled as runtime PASS based on static checks.

References: [Supabase start](https://supabase.com/docs/reference/cli/supabase-start),
[CLI releases](https://github.com/supabase/cli/releases/tag/v2.120.0).
