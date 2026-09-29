# Ecosystem security boundaries

The existing security model in `docs/security-model.md` remains authoritative for Business. New personal routes do not use the service-role client. They validate the user through Supabase Auth, require enrolled MFA challenges to be satisfied, evaluate release + product entitlement + explicit permission, and query with the user's session. RLS checks ownership and active entitlement again on direct database calls.

`ecosystem_product_entitlements` is read-only to authenticated users. Each row has exactly one subject (user or company), a bounded permission array, start/expiry and explicit status. Company membership is a separate condition. A company grant never grants access to personal Wealth data, and One does not imply every permission.

Private pages and responses use no-store/noindex protections. Login destinations reject external origins, protocol-relative URLs, backslashes, encoded control characters and authentication loops. The client session keeper no longer races the login Server Action's MFA/product redirect. Proxy refresh persists cookies before the authenticated Home redirect.

Consent transfers require an exact source, destination, context, data scope, purpose, unexpired/unrevoked grant and independent source/target authorization. There is currently no cross-product transfer consumer or self-service grant endpoint. The privacy page lists user-owned consent rows and allows only revocation; column grants prevent changing purpose/ownership or restoring a revoked consent.

The migration gives anonymous users no new data grants. Wealth UPDATE has both USING and WITH CHECK. Entitlement expiry retains records. Audit triggers in a private schema use a fixed empty search_path and are not executable by client roles; they store identifiers and operations, not amounts or private text. No worker consumes new data or bypasses these boundaries.

Hosted audit found 111 public tables, all with RLS, 143 policies, 510 indexes, 173 foreign keys and 38 triggers. No public SECURITY DEFINER function with a missing configured search_path was found. Forty-four no-policy INFO notices require service-only classification rather than automatically adding permissive policies. The WARN about authenticated execution of `get_my_platform_admin_access` was reviewed: its fixed `pg_catalog, public` search path, `auth.uid()` owner filter, active-role filter and single-row result implement the existing identity bootstrap. No grant was broadened or revoked. Leaked-password protection is disabled in the hosted project ([Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

Hosted production RLS regression, storage cross-tenant tests, MFA refresh/revocation, full LGPD export/deletion/retention workflows and global authorization coverage remain unverified. None is labeled complete based on local tests.
