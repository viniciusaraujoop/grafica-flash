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

## Adendo Debt Center

20260926165000_wealth_debt_center (SHA LF 6cccbc9078b294f5400fe3f97358dc5bdfc732ad70db890161ab109b3efd7ea2) e 20260926171000_wealth_debt_conflict_response (93c361e50ddee175c690faf330f09461e0999aede501d3ad5c765a98f724e263): LOCAL_ONLY vs produção; versões/nomes iguais e conteúdo exato no ledger de staging. Termos/RLS/índice/FK/auditoria, guard de espécie, save/settle wrappers/implementações presentes no catálogo. A segunda substitui intencionalmente o corpo da função save para erro PT409; não cria outro schema ou saldo. A primeira altera somente o check do amount_cents no Wealth novo (zero para liability). Estado: 77 locais, oito migrations no staging, delta 271 adições intencionais vs produção. Evidência completa em staging-debt-final-delta.json e staging-debt-final-vs-production.json. Nenhuma migration histórica editada; UNKNOWNs preservados.

## Adendo Net Worth

20260926180000_wealth_net_worth: LOCAL_ONLY vs produção atual; EXACT_MATCH local/staging (SQL normalizado LF bed98f1bb3e78d88154aab1739c9796e241691c24c20fdde7ea354f76dad0af8). Novas colunas position_class/liquidity e constraints em wealth_entries; snapshots/índices/RLS/grants/audit; wealth_net_worth, classify_wealth_position e capture público invoker/privado com auth/entitlement. Nove migrations em staging, 78 arquivos históricos/novos no diretório local. Nenhuma migration aplicada editada. Produção permanece em 51 versões históricas; schema atual idêntico ao capturado antes desta unidade. Delta staging-net-worth-delta.json: 27 adições e uma expansão da ordem de colunas, somente na tabela Wealth nova; cumulativo 298 adições e nenhum objeto antigo de produção alterado/removido. UNKNOWNs históricos continuam explícitos.

## Adendo Financial Health

20260926190000_wealth_financial_health: LOCAL_ONLY vs produção; EXACT_MATCH local/staging (SQL LF cb6b4a34a2387627b62f801ed94751b16c21bce67e5c91fd2e3987b48c9efdca). Uma função wealth_health_inputs STABLE/INVOKER/search_path vazio, execução anon negada/auth concedida, com verificações internas e RLS das fontes. Dez migrations no staging, 79 SQLs locais. Delta uma função nova; cumulativo 299 adições e nenhuma alteração/remoção de objeto antigo de produção. Reutiliza snapshots, resumo, dívidas e recorrências; não grava dados nem modifica políticas existentes.
## Adendo Portfolio (V4)

20260926181546_wealth_portfolio_foundation (SHA LF 65587f9653b26d3a39456b300f3c23ee013bb4918ab3f475171aa7cf3d8dda4d) e 20260926185024_wealth_portfolio_target_binding (7ec8a877ec19a08a4468478027bf36f40c01a7858d3dc9c960f543a81a647668): EXACT_MATCH local/staging por versão, nome e conteúdo do ledger; LOCAL_ONLY vs produção. Aplicação explícita depois de Health 20260926190000; números gerados pelo CLI não justificam renomear migrations aplicadas. A segunda SUPERSEDE somente o binding targets da função privada, sem substituir outros objetos.

Portfolios/holdings/transactions/recibos, índices/FKs/checks/RLS/grants/audit, guard da entrada, manage RPC invoker/privado e view agregada presentes no catálogo. Valor único em wealth_entries; coverage nas duas funções de resumo; check permite ativo zero; coluna valuation_status. Delta: 99 adições e quatro mudanças em objetos Wealth novos; cumulativo 398 adições, nenhum objeto anterior de produção alterado/removido. 12 migrations staging, 81 arquivos locais. Evidência: staging-portfolio-ledger.json, staging-portfolio-delta.json, staging-portfolio-vs-current-production.json e production-portfolio-readonly-check.json. UNKNOWNs históricos preservados; produção não recebeu migration ou repair.
