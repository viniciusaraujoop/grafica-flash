-- Scope lock for the Integration Expansion mission.
-- Existing connection history is intentionally preserved; only rollout flags for
-- excluded providers are closed so they cannot be enabled from this catalog.
update public.platform_feature_flags
set enabled = false,
    updated_at = now()
where key in (
  'integration_gmail',
  'integration_slack',
  'integration_microsoft_teams',
  'integration_open_finance',
  'integration_erp'
);
