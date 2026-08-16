-- Recovery R3 operational platform configuration. Buckets are created empty.
set lock_timeout = '5s';
set statement_timeout = '120s';

insert into storage.buckets (
  id,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types,
  type
)
values
  (
    'artes',
    'artes',
    true,
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    'STANDARD'::storage.buckettype
  ),
  ('financeiro', 'financeiro', false, false, 26214400, null, 'STANDARD'::storage.buckettype),
  ('logos', 'logos', true, false, 5242880, null, 'STANDARD'::storage.buckettype),
  ('product-images', 'product-images', true, false, 26214400, null, 'STANDARD'::storage.buckettype),
  ('produtos', 'produtos', true, false, 26214400, null, 'STANDARD'::storage.buckettype),
  (
    'site-assets',
    'site-assets',
    true,
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    'STANDARD'::storage.buckettype
  );

create policy "Equipe atualiza arquivos da propria empresa"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = any (
    array['financeiro', 'logos', 'product-images', 'produtos', 'site-assets']::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
)
with check (
  bucket_id = any (
    array['financeiro', 'logos', 'product-images', 'produtos', 'site-assets']::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create policy "Equipe envia arquivos da propria empresa"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = any (
    array['financeiro', 'logos', 'product-images', 'produtos', 'site-assets']::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create policy "Equipe lista arquivos da propria empresa"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = any (
    array['financeiro', 'logos', 'product-images', 'produtos', 'site-assets']::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create policy "Equipe remove arquivos da propria empresa"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = any (
    array['financeiro', 'logos', 'product-images', 'produtos', 'site-assets']::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create extension pg_cron with schema pg_catalog;

select cron.schedule(
  'orcaly-release-expired-stock',
  '*/5 * * * *',
  'select public.expire_marketplace_stock_reservations(500);'
);
