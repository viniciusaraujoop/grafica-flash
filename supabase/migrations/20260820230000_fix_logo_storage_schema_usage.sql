-- ORCALY critical bugfix 2026-08
-- Storage policies for tenant assets call functions in orcaly_private.
-- authenticated already has EXECUTE on the required helper functions, but
-- needs schema USAGE to resolve those functions. Do not grant table access,
-- broad function access, or disable RLS.

GRANT USAGE ON SCHEMA orcaly_private TO authenticated;
