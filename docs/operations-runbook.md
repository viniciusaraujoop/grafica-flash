# ORÇALY — OPERATIONS RUNBOOK

## Objetivo

Procedimentos de diagnóstico, Preview, produção e rollback para a Platform Evolution 3.0.

## Ambientes confirmados

### Vercel

- Project: `orcaly`
- Production domain: `orcaly.com.br`
- Baseline production deployment em 2026-08-30: `dpl_5JhRM22qN5rx4KUducukhZfuwchL`
- Baseline commit: `e835806976650ed1e8da162141d463cdecdd383b`

### Supabase

- Production project ref: `ozrasuktfthsvbqprtel`
- Region: `sa-east-1`
- Postgres: 17
- Branch de staging: não disponível no baseline auditado.

## Regra de incidente

Ao encontrar erro novo:

1. interromper o milestone;
2. capturar rota/request/status/error ID;
3. verificar Vercel runtime/build logs;
4. consultar telemetria/DB de forma read-only;
5. reproduzir;
6. corrigir a causa mínima;
7. executar teste focal;
8. regressões compartilhadas;
9. revisar diff;
10. criar novo Preview.

Não usar reload, sleep arbitrário, retry infinito ou `catch { return [] }` como correção.

## Error ID

Erros server-side integrados ao reporter recebem `ORC-XXXXXXXXXX` e request ID.

Fluxo de investigação:

1. copiar `ORC-...` informado pela UI/suporte;
2. buscar no Health Center/Application Errors quando o schema estiver aplicado;
3. correlacionar com logs Vercel pelo horário/request ID;
4. verificar rota/operação;
5. nunca pedir ao cliente token/cookie/senha para investigar.

## Health Center

`/admin/system-health`

Interpretação:

- **Operational:** evidência positiva observada;
- **Degraded:** sucesso e falha, ou falha recente real;
- **Down:** check direto essencial falhou;
- **Unknown:** telemetria/configuração insuficiente.

`Unknown` não deve ser convertido em verde manualmente.

## Migrations

Antes de aplicar migration:

1. confirmar project ref;
2. comparar schema real;
3. revisar SQL linha por linha;
4. confirmar que é aditiva quando possível;
5. revisar grants/RLS/functions/search_path;
6. validar código compatível com schema ausente durante rollout;
7. aplicar primeiro em staging/branch quando disponível;
8. executar queries pós-migration;
9. executar advisors.

Se staging pago precisar ser criado, obter confirmação de custo antes.

## Preview gate

Preview só é candidato quando:

- `npm test` PASS;
- `npm run verify:payments` PASS;
- `npm run security:check` PASS;
- focused lint PASS;
- Next production build PASS;
- TypeScript PASS;
- `git diff --check` PASS;
- migrations novas revisadas;
- nenhum segredo no diff.

Depois:

- home smoke;
- login fresh quando Auth for tocado;
- painel/current company;
- rotas do milestone;
- network/console;
- mobile relevante;
- logs de runtime.

## Produção

Preferir promover o deployment exato que passou QA quando o workflow suportar promoção.

Antes da promoção registrar:

- deployment candidate;
- commit;
- deployment anterior saudável;
- migration state;
- rollback candidate.

## Smoke pós-produção

Executar imediatamente:

- `orcaly.com.br`;
- login fresh;
- painel;
- current company;
- pedidos;
- public storefront/order flow;
- upload/site builder quando Storage tiver sido tocado;
- referral/signup quando Growth tiver sido tocado;
- áreas novas;
- Vercel errors 5xx/401/403 inesperados;
- Supabase/PostgREST/Storage errors inesperados.

## Rollback

Se houver regressão crítica após promoção:

1. promover/rollback para o deployment saudável anterior;
2. interromper novas tentativas em produção;
3. confirmar restauração do domínio;
4. fazer smoke do baseline restaurado;
5. diagnosticar em branch/Preview;
6. só promover correção depois dos gates.

Não tentar empilhar hotfixes em produção se rollback seguro estiver disponível.

## Drift de schema/código

Baseline 2026-08-30 possui drift conhecido:

- migrations do Assistente e WhatsApp já aplicadas no DB;
- código correspondente ainda vive em branches paralelas;
- `platform_feature_flags` ainda ausente no DB conectado.

Esse drift deve ser reduzido por integração seletiva e migrations verificadas, não por `supabase db push` indiscriminado.
