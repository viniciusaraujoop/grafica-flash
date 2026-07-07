-- Assinatura Orçaly: Pix avulso mensal + cartão recorrente
-- Seguro: não apaga dados, apenas adiciona colunas necessárias.

alter table public.plan_payments
  add column if not exists tipo text,
  add column if not exists payment_method text,
  add column if not exists mercado_pago_payment_id text,
  add column if not exists mercado_pago_preapproval_id text,
  add column if not exists mercado_pago_authorized_payment_id text,
  add column if not exists raw_webhook jsonb,
  add column if not exists raw_subscription jsonb,
  add column if not exists raw_authorized_payment jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists next_payment_date timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.companies
  add column if not exists assinatura_auto_recorrente boolean default false,
  add column if not exists assinatura_forma_pagamento_preferida text,
  add column if not exists assinatura_pix_avulso_status text,
  add column if not exists assinatura_pix_avulso_ultimo_pagamento timestamptz,
  add column if not exists assinatura_proxima_cobranca timestamptz,
  add column if not exists assinatura_ultimo_pagamento timestamptz,
  add column if not exists assinatura_cancelada_em timestamptz,
  add column if not exists mercado_pago_subscription_id text,
  add column if not exists mercado_pago_subscription_status text,
  add column if not exists mercado_pago_customer_email text,
  add column if not exists assinatura_mp_payload jsonb;

create index if not exists idx_plan_payments_company_status
on public.plan_payments(company_id, status);

create index if not exists idx_plan_payments_payment_id
on public.plan_payments(mercado_pago_payment_id);

create index if not exists idx_plan_payments_preapproval_id
on public.plan_payments(mercado_pago_preapproval_id);

create index if not exists idx_companies_subscription_status
on public.companies(assinatura_status);

create index if not exists idx_companies_subscription_payment_mode
on public.companies(assinatura_forma_pagamento_preferida);

-- Diagnóstico final
select
  'plan_payments' as tabela,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'plan_payments'
  and column_name in (
    'tipo',
    'payment_method',
    'mercado_pago_payment_id',
    'mercado_pago_preapproval_id',
    'mercado_pago_authorized_payment_id',
    'raw_webhook',
    'raw_subscription',
    'raw_authorized_payment',
    'paid_at',
    'next_payment_date',
    'cancelled_at'
  )
union all
select
  'companies' as tabela,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'companies'
  and column_name in (
    'assinatura_auto_recorrente',
    'assinatura_forma_pagamento_preferida',
    'assinatura_pix_avulso_status',
    'assinatura_pix_avulso_ultimo_pagamento',
    'assinatura_proxima_cobranca',
    'assinatura_ultimo_pagamento',
    'assinatura_cancelada_em',
    'mercado_pago_subscription_id',
    'mercado_pago_subscription_status',
    'mercado_pago_customer_email',
    'assinatura_mp_payload'
  )
order by tabela, column_name;
