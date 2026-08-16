-- Recovery R3 baseline: platform prerequisites only.
-- Supabase hosted projects normally install pgcrypto in the extensions schema.
create extension if not exists pgcrypto with schema extensions;

create schema orcaly_private;

comment on schema orcaly_private is
  'Server-only Orçaly helpers and sensitive persistence. Never expose through the Data API.';
