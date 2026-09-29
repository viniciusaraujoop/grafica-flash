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

20260926190250_wealth_portfolio_blind_dml_guard: EXACT_MATCH local/staging, LOCAL_ONLY vs produção; SHA LF d7638637a4fa85a2926f29819ed144d54d6de8f024ce9cc8069d625c16145cfc. Acrescenta predicado privado is_owned_wealth_holding, dono=auth.uid() sem dependência de RLS de leitura, e substitui guard de entrada para proteger DML sem filtro por write-only. Um objeto adicional, 399 adições cumulativas, zero mudanças em produção; 13 versões staging e 82 SQLs locais. Três migrations Portfolio aplicadas em sequência explícita, originais imutáveis.


## Adendo Calendar/Bills (V5)

20260926195246_wealth_financial_calendar: EXACT_MATCH local/staging, LOCAL_ONLY vs produção. SHA LF 35424433eee99be38f6b87553e00350e86df738c8a2ac8c1571a60fb0a799543. Aplicação explícita após Portfolio guard, 14 migrations staging e 83 SQLs locais. Metadata bill_details 1:1 com schedule, RLS/SELECT owner, DML autenticado negado, auditoria, classificação por RPC invoker/privado com auth/read/write/CAS/owner. Calendar e Bills são consultas INVOKER, helper de expansão com RLS, índices/FKs/grants.

27 adições + ACL EXECUTE autenticado para o helper privado puro de aritmética de datas (sem leitura). 426 adições cumulativas vs produção, nenhum objeto legado alterado/removido, produção atual read-only sem diferenças. Snapshot, ledger e boundaries nos relatórios staging-calendar-*.json. Todas as 14 versões verificadas por conteúdo; baseline corresponde ao hash raw com CRLF original, não ao hash LF — arquivo preservado. Nenhuma migration aplicada editada/renomeada. UNKNOWNs históricos preservados.

121 testes domínio/SQL e 43 E2E Preview PASS; cleanup API/SQL completo e cron pausado. Sem WARN novo nos advisors. Herdados/Auth continuam pendentes antes da produção. Preview SHA 1b5328190bd1ad81ef9c957bdf2f4856a9f0f7d3.

## V6 — goal funding and life plans

Applied only to staging: 20260926205052_wealth_goal_funding_life_plans.sql. SHA normalized LF 7ff665992f1813f1888ea6e430c6f047f8f717774acdb017f253ca023b408bcb. Predecessor Calendar, exactly 14 applied versions required, now 15. All local/ledger hashes matched. No prior migration or baseline edited. Tables wealth_goal_funding, wealth_life_plans, private command receipts; RLS owner/read, public DML denied, guarded RPC CAS/PT409/idempotency. 74 additive catalog changes; 500 cumulative additions against unchanged production. Types and advisors updated; no new WARN. Preview certification evidence in planning QA report when complete.

## V8 — Documents Vault

20260926214929_wealth_documents_vault (SHA LF 069e3646afc4e58ea9154bfce93efb36e550a681caddc4571111d5bd69d328c7) e 20260926220404_wealth_documents_storage_read_compatibility (0ea54ee9bde24e9bb7256917eb9118e986edd00549515199076f7e1caf6cdd46): EXACT_MATCH local/staging, LOCAL_ONLY vs produção. Segunda SUPERSEDE somente a policy de leitura do bucket novo para aceitar variantes autenticadas legadas comprovadas pelo Storage hospedado; não libera assinatura/listagem. Aplicação explícita sequencial após Planning, 17 versões staging, 86 arquivos SQL. Todas as versões conferidas por conteúdo; baseline raw CRLF original preservada. 49 adições ao catálogo vs Planning, 549 cumulativas vs produção, zero legado alterado/removido. Bucket privado criado por API como configuração separada, não SQL de metadata. Evidência: staging-documents-ledger/boundaries/final-delta/final-vs-production e production-documents-readonly-check. Nenhum histórico editado, UNKNOWNs preservados.

## V8 — Wealth Timeline

20260926222248_wealth_timeline_read_model (SHA LF 9725a0b45784197b5011432955171e9ec698687b7ac27a8f7bd9acc6167340b3) e 20260926222931_wealth_timeline_transaction_binding (41693ad426fe8080f95fd2c501cfb309fc0c8e4b259436845d5bf098103564d8): EXACT_MATCH local/staging, LOCAL_ONLY vs produção. A segunda SUPERSEDE a implementação privada para seguir FK movimento→holding→portfolio; wrapper e grants preservados. Duas funções novas no delta final, nenhuma tabela/dado modificado. 19 versões staging, 88 arquivos SQL, todos hashes verificados. Cumulativo551 adições contra produção atual sem diferenças; zero legado alterado/removido. Não houve repair/renumeração/replay. Evidências staging-timeline-ledger/delta/vs-production/boundaries e production-timeline-readonly-check. UNKNOWNs históricos preservados.

## V8 — Family e Automation (certificações anteriores)

20260926225948_wealth_family_explicit_sharing SHA LFe6ae1b4797c9322cbb37886d820b4f43ed566cf0d95183ff2efe87f6c612c032;20260926233156_wealth_automation_center SHA LF55dc933372cc9e7f762a5f10a53e629c81117d2229890ce85cdda4873aba4e84. EXACT_MATCH local/staging por ledger/conteúdo, LOCAL_ONLY vs produção. Family acrescentou70 objetos e alterou intencionalmente a policy do Vault novo; Automation31 adições.21 versões então,652 adições cumulativas e nenhum legado alterado/removido. Detalhes nos relatórios staging-family/automation e QA correspondentes. Hashes reconfirmados junto ao ledger22 de Fee.

## V8 — Fee Analyzer

20260927001122_wealth_fee_analyzer: EXACT_MATCH local/staging, LOCAL_ONLY vs produção. SHA LF5a0630265cdbebdadf7f36e961a32a2990eabfb8c84a7b4fb893fdacd2a8164f.22 versões staging/91 SQLs locais, todas22 versões verificadas por conteúdo. Baseline original raw CRLF imutável. Função public.wealth_fee_analysis INVOKER/STABLE e índice wealth_portfolio_cost_dates novos; nenhum objeto anterior modificado/removido.2 adições na unidade,654 cumulativas vs produção inalterada. Não há novas tabelas/policies/SECDEF/cron/extensions; fontes mantêm RLS, grants e owner. Evidências staging-fees-ledger/boundaries/delta/vs-production e production-fees-readonly-check. Três UNKNOWN históricos mantidos.

## V8 — Shield

20260927003416_wealth_shield_declared_policies: EXACT_MATCH local/staging por versão/nome/SQL; LOCAL_ONLY vs produção. SHA LF c4f249842c87c39dfdb6b81b5e3c6a1f897ca20c7247b16c6de8eebef55bd85f.23 migrations staging/92 SQLs locais,23 hashes verificados. Tabela pública de declarações/RLS/grants/audit/índice/constraints, receipts privados/RLS/ACL, gestão pública INVOKER→privada DEFINER e consulta INVOKER/STABLE presentes no catálogo.55 adições;709 cumulativas vs produção; nenhuma alteração/remoção de objeto legado. Produção atual read-only idêntica. Baseline raw CRLF/UNKNOWN/histórico imutáveis. Sem repair/replay/cron/extension/webhook. Evidências staging-shield-ledger/boundaries/delta/vs-production e production-shield-readonly-check.


## V8 — Tax Center

`20260927013000_wealth_tax_center_foundation`: LOCAL_ONLY vs produção. Staging contém 24 migrations; produção auditada somente leitura contém 51 e não possui a versão Tax, `public.wealth_tax_center` nem `wealth_portfolio_tax_dates`.

Arquivo GitHub imutável desde o commit pré-aplicação `e7122f0e969794a73d2819cd92fb7c6365874f42`, blob `74b318ad4ab72edebcc774bd313b68203bf34745`, 7020 caracteres LF e SHA-256 LF `ee0ab55c216dfcd5e1ca6527b486263987bd853b5528f5b75e89da0c54a40870`.

Exceção de fidelidade do ledger textual: `supabase_migrations.schema_migrations.statements[1]` possui 7018 caracteres; os dois delimitadores PL/pgSQL `$$` aparecem como `$`. SHA-256 LF do campo: `d54637e2e61904423d0cfad229789ca4db6d841904173e89c6bb15098093392e`. O arquivo correto não foi alterado depois da aplicação e o objeto compilado foi exercitado pelos testes. Não fazer repair nem editar migration aplicada para alinhar o campo textual; qualquer mudança real de schema usa migration nova.

Objetos: função pública STABLE/SECURITY INVOKER com RLS/owner/entitlement e ACL restrita; índice parcial de eventos fiscais declarados. Sem tabela de imposto, segundo saldo, cron, provider, webhook, regra tributária ou jurisdição.

Certificação: runtime `d47ac1869dcfc22b93e122508153caf665d09cdf`, deployment `dpl_BscyaUKzc7ZrE3PZxwQSUjnBMQmv` READY, hosted run `36319880597` 7/7 PASS, domain/PG 7/7 PASS, artifact `10932416353`, cleanup completo zero. Evidências em `docs/qa/ORCALY_WEALTH_TAX*`.


## V8 — Morning / Night

`20260927132000_wealth_morning_night_briefing`: LOCAL_ONLY vs produção. Staging contém **25 migrations**; produção auditada somente leitura não possui essa versão nem `public.wealth_daily_briefing(text,date)`.

A unidade adiciona somente o read model `public.wealth_daily_briefing(text,date)`, `STABLE` e `SECURITY INVOKER`, com execução autenticada e anon negado. Reutiliza fontes Wealth owner-scoped existentes e não cria nova tabela financeira, segundo saldo, cron, provider, webhook ou integração externa. Banco e mercado permanecem `NOT_CONFIGURED`.

A primeira tentativa pelo endpoint padrão de migration encontrou incompatibilidade do mecanismo de ledger legado e deixou apenas a função recém-criada sem versão registrada; esse objeto órfão foi removido imediatamente enquanto o staging estava vazio. A versão `20260927132000` foi então aplicada por transação controlada com predecessor Tax verificado. Nenhuma migration aplicada foi editada, renumerada ou reparada; mudanças futuras usam migration nova.

Certificação: runtime `9a2c66dbb2e6bf00c484b1791103b2bccd15becd`, deployment imutável `dpl_4JpN5CxFx9qT4nMgy3kTANxEKLek` READY, hosted run `36325027162` com 7/7 PASS, domain/PG 5/5 PASS, artifact `10934075693`, 12 screenshots e cleanup completo zero. Rolling V8 `36325027679` e Platform Quality Gate `36325030319` PASS. Produção permaneceu read-only e sem objetos Morning/Night. Evidências em `docs/qa/ORCALY_WEALTH_BRIEFING*`.


## V8 — Alerts

`20260927162000_wealth_document_expiry` e `20260927170000_wealth_alert_center`: LOCAL_ONLY vs produção. Staging contém **27 migrations**; produção auditada somente leitura não possui essas versões nem `public.wealth_alerts_overview(integer,text)` / `public.manage_wealth_alerts(text,jsonb)`.

A primeira migration adiciona validade explícita ao Vault; nenhuma validade é inferida da data do documento. A segunda adiciona o read model Alerts, preferências e estado privado de interação, receipts/idempotência e boundaries de audit/noise control. RPCs públicas são SECURITY INVOKER; leitura é STABLE; `authenticated` possui EXECUTE e `anon` não.

Fontes factuais certificadas: recurrence, debt, goal pacing, Vault expiry, Shield, Portfolio coverage, Tax gaps e automation needs_attention. Alert descriptions continuam derivadas, sem segundo saldo/fonte financeira, provider externo, cron ou side effect financeiro.

Certificação: runtime `7401e20576ca4b686c03871ff0211474001ce620`, deployment `dpl_DXssFBge1nK46tnpPaA8LGgMUNHA` READY, hosted run `36332287975` SUCCESS, domain/PG 6/6 PASS, artifact `10935669993`, cleanup zero. Rolling V8 e Platform Quality Gate PASS. Produção permanece read-only e intacta.

O Main Site protected auth diff/global lint permanece finding branch-wide herdado e separado; nenhum arquivo login/checkout aparece no delta Alerts a partir de `e3cd68eb054e3f532fa6275eecb40d31ecdf2751`.
