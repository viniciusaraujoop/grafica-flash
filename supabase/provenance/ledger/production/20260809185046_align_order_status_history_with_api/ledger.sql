alter table public.order_status_history
  add column if not exists changed_by_email text;

comment on column public.order_status_history.changed_by_email is
  'E-mail do usuário que alterou o status, quando a mudança é feita pelo painel.';
