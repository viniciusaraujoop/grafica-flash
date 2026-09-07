-- ORCALY_STORAGE_BUCKET_SECURITY_1D5
-- Impede listagem publica e isola alteracoes de arquivos por empresa.

create or replace function orcaly_private.storage_path_company_id(p_name text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_segment text;
begin
  v_segment := split_part(coalesce(p_name, ''), '/', 1);

  if v_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_segment::uuid;
  end if;

  return null;
end;
$$;

create or replace function orcaly_private.can_manage_storage_path(p_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    orcaly_private.can_manage_company(
      orcaly_private.storage_path_company_id(p_name)
    ),
    false
  );
$$;

revoke all on function orcaly_private.storage_path_company_id(text)
  from public, anon, authenticated, service_role;
revoke all on function orcaly_private.can_manage_storage_path(text)
  from public, anon, authenticated, service_role;

grant execute on function orcaly_private.storage_path_company_id(text)
  to authenticated, service_role;
grant execute on function orcaly_private.can_manage_storage_path(text)
  to authenticated, service_role;

update storage.buckets
set public = false,
    file_size_limit = 26214400
where id = 'financeiro';

update storage.buckets
set file_size_limit = 26214400
where id in ('artes', 'produtos', 'product-images');

update storage.buckets
set file_size_limit = 5242880
where id = 'logos';

drop policy if exists "Autenticados atualizam imagens de produtos" on storage.objects;
drop policy if exists "Autenticados atualizam imagens do site" on storage.objects;
drop policy if exists "Autenticados enviam imagens de produtos" on storage.objects;
drop policy if exists "Autenticados enviam imagens do site" on storage.objects;
drop policy if exists "Autenticados removem imagens de produtos" on storage.objects;
drop policy if exists "Autenticados removem imagens do site" on storage.objects;
drop policy if exists "Equipe atualiza anexos financeiros" on storage.objects;
drop policy if exists "Equipe envia anexos financeiros" on storage.objects;
drop policy if exists "Equipe le anexos financeiros" on storage.objects;
drop policy if exists "Equipe remove anexos financeiros" on storage.objects;
drop policy if exists "Imagens de produtos podem ser vistas publicamente" on storage.objects;
drop policy if exists "Permitir atualizar imagens produtos" on storage.objects;
drop policy if exists "Permitir atualizar logos" on storage.objects;
drop policy if exists "Permitir excluir imagens produtos" on storage.objects;
drop policy if exists "Permitir excluir logos" on storage.objects;
drop policy if exists "Permitir leitura de artes" on storage.objects;
drop policy if exists "Permitir ler imagens produtos" on storage.objects;
drop policy if exists "Permitir ler logos" on storage.objects;
drop policy if exists "Permitir upload de artes" on storage.objects;
drop policy if exists "Permitir upload imagens produtos" on storage.objects;
drop policy if exists "Permitir upload logos" on storage.objects;
drop policy if exists "Publico ve imagens de produtos" on storage.objects;
drop policy if exists "Publico ve imagens do site" on storage.objects;
drop policy if exists "Usuarios autenticados podem enviar imagens de produtos" on storage.objects;

create policy "Equipe lista arquivos da propria empresa"
on storage.objects
for select
to authenticated
using (
  bucket_id = any (
    array[
      'financeiro',
      'logos',
      'product-images',
      'produtos',
      'site-assets'
    ]::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create policy "Equipe envia arquivos da propria empresa"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = any (
    array[
      'financeiro',
      'logos',
      'product-images',
      'produtos',
      'site-assets'
    ]::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create policy "Equipe atualiza arquivos da propria empresa"
on storage.objects
for update
to authenticated
using (
  bucket_id = any (
    array[
      'financeiro',
      'logos',
      'product-images',
      'produtos',
      'site-assets'
    ]::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
)
with check (
  bucket_id = any (
    array[
      'financeiro',
      'logos',
      'product-images',
      'produtos',
      'site-assets'
    ]::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create policy "Equipe remove arquivos da propria empresa"
on storage.objects
for delete
to authenticated
using (
  bucket_id = any (
    array[
      'financeiro',
      'logos',
      'product-images',
      'produtos',
      'site-assets'
    ]::text[]
  )
  and orcaly_private.can_manage_storage_path(name)
);

create policy "Publico envia arte sem listar"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'artes'
  and char_length(name) between 1 and 240
  and name !~ '(^|/)\.\.(/|$)'
);
