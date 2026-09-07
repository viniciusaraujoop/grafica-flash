-- ORCALY_SECURITY_HARDENING_V1
begin;

create schema if not exists orcaly_private;
revoke all on schema orcaly_private from public, anon, authenticated;

create table if not exists orcaly_private.api_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default clock_timestamp(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on orcaly_private.api_rate_limits from public, anon, authenticated;

create or replace function public.orcaly_consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started timestamptz;
  v_count integer;
begin
  if p_key is null or length(p_key) < 16 or length(p_key) > 128 then
    raise exception 'invalid rate limit key';
  end if;

  if p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid rate limit';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'invalid rate limit window';
  end if;

  insert into orcaly_private.api_rate_limits (
    key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_key, v_now, 0, v_now)
  on conflict (key) do nothing;

  select window_started_at, request_count
    into v_window_started, v_count
  from orcaly_private.api_rate_limits
  where key = p_key
  for update;

  if v_window_started + make_interval(secs => p_window_seconds) <= v_now then
    v_window_started := v_now;
    v_count := 1;

    update orcaly_private.api_rate_limits
    set window_started_at = v_window_started,
        request_count = v_count,
        updated_at = v_now
    where key = p_key;

    return query
      select true, greatest(0, p_limit - v_count),
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  if v_count >= p_limit then
    return query
      select false, 0,
        v_window_started + make_interval(secs => p_window_seconds);
    return;
  end if;

  v_count := v_count + 1;

  update orcaly_private.api_rate_limits
  set request_count = v_count,
      updated_at = v_now
  where key = p_key;

  return query
    select true, greatest(0, p_limit - v_count),
      v_window_started + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.orcaly_consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.orcaly_consume_rate_limit(text, integer, integer)
  to service_role;

drop policy if exists "Público cria pedido em empresa ativa" on public.orders;
drop policy if exists "Publico cria pedido em empresa ativa" on public.orders;
drop policy if exists "Público cria itens em empresa ativa" on public.order_items;
drop policy if exists "Publico cria itens em empresa ativa" on public.order_items;

revoke insert on public.orders from anon;
revoke insert on public.order_items from anon;

do $$
declare
  item record;
begin
  for item in
    select tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke all privileges on table public.%I from anon',
      item.tablename
    );
    execute format(
      'revoke truncate, references, trigger on table public.%I from authenticated',
      item.tablename
    );
  end loop;
end;
$$;

grant select on public.public_company_profiles to anon, authenticated;
grant select on public.public_marketplace_companies to anon, authenticated;
grant select on public.public_marketplace_products to anon, authenticated;
grant select on public.public_site_companies to anon, authenticated;
grant select on public.public_site_sections to anon, authenticated;
grant select on public.public_store_products to anon, authenticated;

revoke insert, update on public.orders from authenticated;

grant insert (
  nome,
  telefone,
  produto,
  largura,
  altura,
  quantidade,
  observacoes,
  status,
  preco_estimado,
  arquivo_url,
  company_id,
  valor_total,
  valor_sinal,
  percentual_sinal,
  forma_pagamento,
  parcelas,
  itens_resumo,
  cliente_empresa,
  dados_inteligentes,
  marketplace_origem,
  prazo,
  priority,
  internal_notes,
  files,
  source,
  original_order_id,
  cupom_id,
  cupom_codigo,
  valor_desconto,
  valor_total_original,
  prioridade,
  prazo_entrega,
  responsavel_id,
  canal_origem,
  endereco_entrega,
  observacoes_internas,
  responsavel_nome,
  delivery_type,
  delivery_fee,
  subtotal,
  total_amount,
  payment_method_id,
  delivery_zone_id,
  address,
  neighborhood,
  complement,
  reference_point,
  change_for,
  items_snapshot,
  discount_amount,
  coupon_code,
  customer_name,
  customer_email,
  customer_phone,
  total,
  payment_method,
  coupon_id
) on public.orders to authenticated;

grant update (
  nome,
  telefone,
  produto,
  largura,
  altura,
  quantidade,
  observacoes,
  status,
  preco_estimado,
  arquivo_url,
  valor_total,
  valor_sinal,
  percentual_sinal,
  forma_pagamento,
  parcelas,
  itens_resumo,
  cliente_empresa,
  dados_inteligentes,
  marketplace_origem,
  prazo,
  priority,
  internal_notes,
  files,
  source,
  original_order_id,
  cupom_id,
  cupom_codigo,
  valor_desconto,
  valor_total_original,
  prioridade,
  prazo_entrega,
  responsavel_id,
  canal_origem,
  endereco_entrega,
  observacoes_internas,
  aprovado_em,
  entregue_em,
  cancelado_em,
  updated_at,
  responsavel_nome,
  visualizado_em,
  notificado_em,
  delivery_type,
  delivery_fee,
  subtotal,
  total_amount,
  payment_method_id,
  delivery_zone_id,
  address,
  neighborhood,
  complement,
  reference_point,
  change_for,
  items_snapshot,
  discount_amount,
  coupon_code,
  customer_name,
  customer_email,
  customer_phone,
  total,
  payment_method,
  coupon_id
) on public.orders to authenticated;

update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ]::text[]
where id = 'artes';

drop policy if exists "Publico envia arte sem listar" on storage.objects;
drop policy if exists "Público envia arte sem listar" on storage.objects;
revoke insert, update, delete on storage.objects from anon;

alter table public.art_approval_requests
  add column if not exists expires_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists revoked_at timestamptz;

update public.art_approval_requests
set expires_at = coalesce(expires_at, created_at + interval '7 days')
where expires_at is null;

alter table public.art_approval_requests
  alter column expires_at set default (clock_timestamp() + interval '7 days');

create unique index if not exists art_approval_requests_token_unique
  on public.art_approval_requests(token);

create index if not exists art_approval_requests_active_token_idx
  on public.art_approval_requests(token, expires_at)
  where revoked_at is null;

commit;
