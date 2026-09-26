-- Public API credentials are company-scoped and server-managed. The raw key is
-- never persisted: only a SHA-256 digest of a cryptographically random value.
create table if not exists public.integration_api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  key_prefix text not null unique check (key_prefix ~ '^orcaly_(live|test)_[A-Za-z0-9_-]{10,32}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  scopes text[] not null check (
    cardinality(scopes) > 0
    and scopes <@ array['customers.read','customers.write','orders.read','orders.write','tasks.write','webhooks.manage']::text[]
  ),
  created_by uuid,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > created_at)
);

create index if not exists idx_integration_api_keys_company_active
  on public.integration_api_keys(company_id, created_at desc)
  where revoked_at is null;
create index if not exists idx_integration_api_keys_expiry
  on public.integration_api_keys(expires_at)
  where expires_at is not null and revoked_at is null;

alter table public.integration_api_keys enable row level security;
revoke all on table public.integration_api_keys from public, anon, authenticated;
grant select, insert, update, delete on table public.integration_api_keys to service_role;
