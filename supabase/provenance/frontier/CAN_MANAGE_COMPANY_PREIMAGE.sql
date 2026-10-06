-- DERIVATION EVIDENCE ONLY: selected fragment, not a complete frontier.
-- Not discovered by Supabase migrations; do not execute this file independently.
-- R10 ENGINEERED PREIMAGE / STRUCTURAL / FAIL-CLOSED / NOT HISTORICAL.
-- SUPERSEDED BY LEDGER 20260728182610 on the SAME function OID.
-- Source comment only: no persistent COMMENT ON FUNCTION may survive replay.
CREATE FUNCTION public.can_manage_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
CALLED ON NULL INPUT
SET search_path = ''
AS $r10_preimage$
  SELECT FALSE;
$r10_preimage$;

ALTER FUNCTION public.can_manage_company(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_manage_company(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
-- No GRANT. No private duplicate. Future policies bind to this public identity.
