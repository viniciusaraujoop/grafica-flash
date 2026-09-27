# Growth — Integration Contract (futuro; nada externo implementado)

Fonte executável dos contratos: `lib/orcaly-next/growth/providers.ts`. **Todos os providers estão `NOT_CONFIGURED`.** Nenhuma chamada externa, credencial, OAuth ou webhook existe para Growth.

| Provider | Métricas que pode fornecer | Frescor máx. | Cursor | Atribuição a braço |
| --- | --- | --- | --- | --- |
| Meta Ads | impressions, clicks, spend_cents, leads, conversions | 24 h | último dia completo por conta | campanha/conjunto/anúncio mapeado **explicitamente** pelo usuário |
| Google Ads | impressions, clicks, spend_cents, conversions | 24 h | último dia completo por customer id | campanha/grupo mapeado explicitamente |
| Google Analytics | conversions, revenue_cents | 48 h | último dia processado da propriedade | parâmetro UTM declarado por braço |
| TikTok Ads | impressions, clicks, spend_cents, conversions | 24 h | último dia completo por anunciante | campanha/grupo mapeado explicitamente |

## Data contract
- Uma linha importada vira `GrowthObservation` com `provenance: 'MEASURED'`, `source_id = <provider>`, janela diária, valores inteiros exatos (moeda da conta convertida **somente** se a conta for BRL; outra moeda = `BLOCKED_EXTERNAL` até haver regra de câmbio declarada).
- Nunca inferir métrica não fornecida (ex.: GA não dá cliques de anúncio → `UNKNOWN`).
- Nunca somar dados de providers diferentes para a mesma métrica/braço sem regra de deduplicação declarada.
- Atribuição é **mapeamento explícito** feito pelo usuário; o sistema não "adivinha" qual campanha é qual braço.

## Health
`NOT_CONFIGURED` → `CONNECTED` (verificação real de leitura, não só credencial salva) → `STALE` (última sincronização acima do frescor) / `ERROR` (`AUTH_EXPIRED`, `PERMISSION_REVOKED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `SCHEMA_CHANGED`, `UNKNOWN`, com `retryable`) / `BLOCKED_EXTERNAL` (aprovação de app, verificação de negócio, moeda).
Credencial salva **não** significa `CONNECTED`.

## Freshness
Todo resultado que usa dado `STALE` lista a limitação no resultado e no Decision Receipt. Dados `ERROR` não entram em avaliação.

## Sync cursor
Opaco por provider, persistido por conexão; sincronização incremental idempotente (chave natural: provider + conta + entidade + dia). Reprocessamento de janela recente (D-3) para correções tardias do provider, gerando nova observação e `superseded_by` na anterior.

## Source attribution
Cada observação guarda `source_id`, conta, entidade e horário de importação. UI mostra "Medido · Meta Ads · 26/09" ao lado do valor.

## Failure state
Falha de sync nunca apaga observações existentes; experimento continua avaliável com dados válidos + limitação. UI usa `SourceStatus` com texto (não só cor).

## Pré-requisitos para implementar (não atendidos)
Jobs worker existente (`lib/jobs/*`) auditado para Growth · armazenamento de credenciais existente (`lib/integrations/core/credentials.ts`) revisado · aprovação de apps nos providers · política de retenção · testes de contrato com fixtures gravadas.
