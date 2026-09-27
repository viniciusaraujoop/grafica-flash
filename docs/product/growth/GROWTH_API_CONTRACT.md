# Growth — API Contract (proposta; nenhum route handler criado)

Base futura: Server Actions no App Router (padrão atual do Wealth) **ou** `/api/v1/growth/*` para a API pública existente (`docs/public-api.md`). Nenhuma das duas foi implementada.

## Convenções
- Autenticação: sessão do usuário (cookies HTTP-only). Sem service role.
- Contexto: `company_id` vem do **contexto de empresa ativo no servidor**, nunca do corpo da requisição (IDOR/BOLA).
- Autorização: entitlement `product.growth` + permissão por operação (tabela abaixo).
- Mutação: corpo inclui `expected_version` e `idempotency_key` (uuid). Resposta de replay = resposta original.
- Números: contagens e centavos como **string de dígitos** no JSON (BigInt-safe); nunca `number` para dinheiro.
- Erros (formato único): `{ "error": { "code": string, "message": string, "issues"?: Issue[] } }` com códigos: `UNAUTHENTICATED` 401, `NOT_ENTITLED` 403, `FORBIDDEN` 403, `NOT_FOUND` 404 (também para recurso de outra empresa), `VERSION_CONFLICT` 409 (PT409), `INVALID_TRANSITION` 409, `NOT_READY` 422, `REASON_REQUIRED` 422, `VALIDATION` 422, `DECISION_NOT_PERMITTED` 422, `RATE_LIMITED` 429.

| Operação | Permissão | Entrada | Validação de domínio | Saída |
| --- | --- | --- | --- | --- |
| **read** list | growth.read | `status?`, `cursor?` (máx. 50) | — | experimentos + resultado avaliado (`evaluateResult`) |
| **read** one | growth.read | `id` | — | experimento, hipótese, braços, observações, aprendizados, decisões, resultado, sugestões (`suggestNextSteps`) |
| **create** | growth.write | `SetupForm` | `evaluateSetup` (rascunho pode ter pendências) | experimento DRAFT v1 |
| **update** | growth.write | campos + `expected_version` | só DRAFT/READY; `validateHypothesis`; volta READY→DRAFT se ficar incompleto | experimento v+1 |
| **start** | growth.manage | `expected_version` | `transition('start')` + `readinessIssues` | RUNNING, `started_at` |
| **pause** | growth.manage | `expected_version`, `reason` | `transition('pause')` | PAUSED |
| **resume** | growth.manage | `expected_version` | `transition('resume')` | RUNNING |
| **complete** | growth.manage | `expected_version` | `transition('complete')` | COMPLETED + resultado final |
| **invalidate** | growth.manage | `expected_version`, `reason` | `transition('invalidate')` | INVALIDATED (resultado passa a INCONCLUSIVE) |
| **cancel** | growth.manage | `expected_version`, `reason` | `transition('cancel')` | CANCELLED |
| **add observation** | growth.write | `ManualObservationInput`, `variant_id`, `idempotency_key` | `parseManualObservation`; experimento RUNNING/PAUSED; variante do experimento | observação + `warnings` |
| **record learning** | growth.write | `kind`, `text`, `observation_ids`, `limitation?`, `decision_id?` | `validateLearning` | aprendizado |
| **record decision** | growth.manage | `action`, `rationale`, `next_step`, `expected_version` | resultado recalculado no servidor; `buildDecisionReceipt` (bloqueia adopt sem critério) | Decision Receipt persistido |

## Regras transversais
- Servidor **recalcula** resultado e sugestões; nunca confia em valores derivados enviados pelo cliente.
- Nenhum endpoint aceita `outcome`, `WINNER`, métricas derivadas ou `provenance: MEASURED` vindos do cliente manual.
- Rate limit por usuário/empresa nas mutações; tamanho máximo do corpo 16 KB.
- Logs: request id, operação, ids; **sem** valores de observação ou texto de hipótese.
- Auditoria em toda mutação (ver Persistence Contract).
