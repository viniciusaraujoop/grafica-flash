# Wealth — edição de lançamentos

Continuação do master depois da certificação do staging e do histórico/CSV. Schema permanece baseline + migration Wealth original; nenhuma tabela, função ou policy nova nesta unidade.

## Comportamento

O título no histórico abre `/apps/wealth/lancamentos/[entryId]` quando o usuário tem read + write. A página e a Server Action verificam sessão, MFA quando configurado, flag e entitlement. A Action relê o lançamento com o cliente da sessão, filtro de proprietário e RLS. Campos user_id, id, idempotency_key e created_at não entram no payload de atualização.

A revisão do formulário é um SHA-256 dos valores mutáveis e do ID; serve para detectar uma edição antiga, não para autorizar acesso. Se outra aba alterou os dados, o formulário recebe conflito. O UPDATE também compara atomicamente todos os valores confiáveis relidos, cobrindo a alteração entre SELECT e UPDATE. Esta técnica compara estado, não mantém histórico de versões: alterações que voltam exatamente aos valores anteriores são indistinguíveis e não constituem um log de versões. A auditoria existente registra a atualização com identificadores somente.

O formulário preserva os valores digitados em erro e oferece reabertura explícita da versão atual. Não apaga nem arquiva registros. Edição de metas e arquivamento ainda precisam de outra unidade. Recorrência continua sendo referência, sem gerar cobranças ou jobs.

O parser monetário agora aceita o limite inclusivo já permitido pelo banco (100.000.000.000.000 centavos), e continua rejeitando o centavo seguinte. O preenchimento do formulário converte centavos com BigInt, sem arredondamento decimal.

## Verificação

- 69 testes de domínio/PostgreSQL PASS, incluindo revisão para cada campo editável e round-trip monetário no limite.
- Typecheck e lint de escopo PASS.
- E2E local com Supabase real: **17 checks PASS**; edição e reload em centavos, proprietário/created_at/idempotency imutáveis, auditoria, duas abas com conflito, ID forjado, página de outro usuário, perda de write e replay anônimo.
- Axe WCAG A/AA PASS na edição; screenshot mobile inspecionado, sem transbordamento.
- React: componente pequeno com useActionState, sem effects/sincronização manual; campos não controlados e pending bloqueiam reenvio enquanto a Action está em andamento. Revisão/owner não são derivados de dados não confiáveis para autorizar acesso.

Build de produção PASS. **Vercel + Supabase reais: 18 checks PASS**, zero erros, fixtures removidos. Preview https://orcaly-icaddekex-vinicius-araujos-projects.vercel.app, deployment `dpl_BQWTpnh3fs8yNWuXLWt7HG3QiuGH`, SHA `62008d4078e99c9efb5dbecac88784ef5d144ab5`. Evidência: `ORCALY_WEALTH_EDIT_VERCEL_E2E.json`.

Fixtures removidos. Evidência local: `ORCALY_WEALTH_EDIT_LOCAL_E2E.json`. Produção continua intocada.
