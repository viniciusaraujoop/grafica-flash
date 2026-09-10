-- ORCALY — Company Timezone Foundation
-- Additive, nullable by design. Existing companies are not silently assigned a timezone.

alter table public.companies
  add column if not exists timezone text;

comment on column public.companies.timezone is
  'Canonical company IANA timezone. Nullable until explicitly configured; operational scheduling must not infer browser timezone.';

alter table public.companies
  drop constraint if exists companies_timezone_shape_check;

alter table public.companies
  add constraint companies_timezone_shape_check
  check (
    timezone is null
    or (
      timezone = btrim(timezone)
      and char_length(timezone) between 1 and 100
    )
  );
