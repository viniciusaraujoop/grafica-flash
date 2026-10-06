-- DERIVATION EVIDENCE ONLY: selected fragment, not independently executable.
-- R10 ENGINEERED PREIMAGE / STRUCTURAL / FAIL-CLOSED / NOT HISTORICAL.
-- BODY SUPERSEDED BY LEDGER 20260811231921 on the SAME function OID.
-- Source comment only; no persistent catalog COMMENT survives the replacement.
CREATE FUNCTION public.is_orcaly_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $r10_admin_preimage$
  SELECT FALSE;
$r10_admin_preimage$;

ALTER FUNCTION public.is_orcaly_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_orcaly_admin()
  FROM PUBLIC, anon, authenticated, service_role;
-- No GRANT. No private duplicate. #7 moves this OID; #26 replaces its body.
