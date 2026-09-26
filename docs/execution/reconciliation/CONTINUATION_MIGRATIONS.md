# Adendo de reconciliação — continuação Wealth

A matriz histórica (71 locais, 51 produção, 79 linhas, 3 UNKNOWN) permanece válida para o checkpoint original. As três migrations posteriores abaixo elevam o inventário local a 74; não substituem, renomeiam nem presumem equivalência com o histórico. Nenhuma das três existe na produção auditada. Staging contém baseline + ecosystem_identity_wealth + estas três, total de cinco versões.

| Versão/nome local | Produção correspondente | Staging correspondente | SHA-256 SQL normalizado LF | Classificação vs produção | Objetos presentes no staging |
| --- | --- | --- | --- | --- | --- |
| 20260926103114_wealth_lifecycle_aggregates | Nenhuma | Mesma versão/nome, conteúdo idêntico ao ledger | a1ab880670c493a4fe8b3a3a856d16f13991404b438d1dd377779620584d8f83 | LOCAL_ONLY | Colunas lifecycle/version em entries/goals, índices, trigger de versão, auditoria e wealth_summary |
| 20260926110128_wealth_recurring_schedules | Nenhuma | Mesma versão/nome, conteúdo idêntico ao ledger | 28b823b24c0d8851a9b4fc1c259faf2c0ceb20a52b850a1a825b33829b754047 | LOCAL_ONLY | schedules/occurrences, índices/constraints/RLS/grants/auditoria, cálculo de datas, enqueue, criação/controle/processamento/refresh |
| 20260926153138_wealth_recurrence_rpc_boundary | Nenhuma | Mesma versão/nome, conteúdo idêntico ao ledger | 3ff81420c324baba696989030ed020664549e9d50bc8388eb7cf176a0373097f | LOCAL_ONLY | Implementações create/change/run_my movidas ao schema privado; wrappers públicos SECURITY INVOKER e ACLs restritas |

Hash remoto calculado sobre statements[1] via sha256(convert_to(...)); não inferido pelo nome. A migration boundary substitui intencionalmente três corpos/posições de funções da anterior; demais objetos permanecem. Ledger e catálogo atual comprovados separadamente. Arquivos já aplicados são imutáveis; qualquer correção usa nova migration.

Evidências: staging-lifecycle-delta.json, staging-recurrence-final-delta.json (72 adições vs lifecycle), staging-recurrence-vs-production.json (243 adições vs produção capturada), staging-recurrence-cleanup.json e recurrence-advisors-summary.json. Baseline/estratégia histórica: BASELINE_STRATEGY.md e STAGING_VALIDATION.md.

Não copiar dados reais, auth.users, secrets ou configurações operacionais. Nenhum cron registrado nesta unidade. Nenhum reparo no ledger de produção. A enumeração dos objetos em cada delta é parte da matriz verificável.

## Adendo posterior: clock

20260926164000_wealth_recurrence_clock: LOCAL_ONLY vs produção; mesma versão/nome e SQL idêntico no ledger de staging, SHA LF 00e77914174a348135e420619bee4177b0fb33eedeee619b544bbef88a5f2e65. Uma função privada nova presente no catálogo; nenhuma assinatura pública alterada. Quatro migrations posteriores no total, 75 SQLs locais e seis versões no staging. Delta final 244 adições vs produção; arquivo staging-clock-vs-production.json. Cron é configuração operacional separada: um job interno exclusivo do staging, testado e pausado.
