-- Orçaly — Programa Clientes Fundadores
-- FASE 1 hardening: founder_invites preserva histórico e não aceita DELETE via service_role.

revoke all on table public.founder_invites from service_role;
grant select, insert, update on table public.founder_invites to service_role;
