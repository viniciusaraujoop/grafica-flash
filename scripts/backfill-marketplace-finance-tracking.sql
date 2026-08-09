-- ORCALY_FINANCE_ORDER_BACKFILL_V1
-- Execute somente depois de validar e publicar o codigo novo.

-- Gera link de acompanhamento para pedidos antigos do marketplace.
update public.orders
set customer_portal_token = gen_random_uuid()::text,
    updated_at = now()
where marketplace_payment_id is not null
  and customer_portal_token is null;

-- Registra no Financeiro vendas antigas do marketplace que ja foram pagas.
-- O UUID do pagamento marketplace e usado como ID do lancamento, tornando
-- a operacao idempotente.
insert into public.financial_transactions (
  id,
  company_id,
  tipo,
  type,
  categoria,
  descricao,
  description,
  valor,
  amount,
  data_competencia,
  status,
  forma_pagamento,
  payment_method,
  fornecedor_cliente,
  order_id,
  origem,
  paid_at,
  notes,
  raw_data,
  updated_at
)
select
  mp.id,
  mp.company_id,
  'entrada',
  'income',
  'Venda',
  'Venda #' || upper(left(o.id::text, 8)) || ' - ' ||
    coalesce(
      nullif(o.customer_name, ''),
      nullif(o.nome, ''),
      'Cliente'
    ),
  'Venda #' || upper(left(o.id::text, 8)) || ' - ' ||
    coalesce(
      nullif(o.customer_name, ''),
      nullif(o.nome, ''),
      'Cliente'
    ),
  coalesce(
    mp.gross_amount,
    mp.amount,
    o.total_amount,
    o.total,
    0
  ),
  coalesce(
    mp.gross_amount,
    mp.amount,
    o.total_amount,
    o.total,
    0
  ),
  coalesce(
    mp.paid_at,
    o.paid_at,
    mp.updated_at,
    mp.created_at
  )::date,
  'pago',
  coalesce(
    nullif(mp.payment_method, ''),
    nullif(o.payment_method, ''),
    'Mercado Pago'
  ),
  coalesce(
    nullif(mp.payment_method, ''),
    nullif(o.payment_method, ''),
    'Mercado Pago'
  ),
  coalesce(
    nullif(o.customer_name, ''),
    nullif(o.nome, ''),
    'Cliente'
  ),
  o.id,
  'marketplace_checkout',
  coalesce(
    mp.paid_at,
    o.paid_at,
    mp.updated_at,
    mp.created_at
  ),
  'Venda online confirmada pelo Mercado Pago.',
  jsonb_build_object(
    'marketplace_payment_id', mp.id,
    'provider_payment_id', mp.provider_payment_id,
    'provider', 'mercado_pago'
  ),
  now()
from public.marketplace_payments mp
join public.orders o
  on o.id = mp.order_id
 and o.company_id = mp.company_id
where mp.status = 'paid'
  and coalesce(mp.split_status, 'applied') <> 'missing'
on conflict (id) do update set
  valor = excluded.valor,
  amount = excluded.amount,
  status = excluded.status,
  forma_pagamento = excluded.forma_pagamento,
  payment_method = excluded.payment_method,
  fornecedor_cliente = excluded.fornecedor_cliente,
  order_id = excluded.order_id,
  origem = excluded.origem,
  paid_at = excluded.paid_at,
  raw_data = excluded.raw_data,
  updated_at = now();
