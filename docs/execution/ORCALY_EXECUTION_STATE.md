# Orçaly — checkpoint certificado V4

Status: CHECKPOINT_CONTINUATION_REQUIRED. Portfolio Foundation está concluído e certificado no staging. O master V4 completo NÃO está concluído nem READY_FOR_PRODUCTION. Próxima unidade: Financial Calendar e Subscription & Recurring Bills Center, reutilizando as fontes existentes. Não refazer Home, Hub ou Wealth 6.1–6.8.

Preview certificado: https://orcaly-1aah4iwht-vinicius-araujos-projects.vercel.app
Deployment: dpl_AJQYxRHfyabMHo1XGEz97iV1RBoV, READY/Preview.
SHA de aplicação: 7dad853c8724e7aeae08fc9dcf739a841eb53380.
39 checks hospedados PASS, finalizados 2026-09-26T19:18:57.471Z; zero erros de navegador/chamadas à produção. Evidência: docs/qa/ORCALY_WEALTH_PORTFOLIO_VERCEL_E2E.json. Commit documental posterior inclui somente evidências e ajuste do runner de QA, sem alterar aplicação/SQL certificado; conferir HEAD real em git.

Master ativo: C:\Users\arauj\Downloads\CODEX_ORCALY_MASTER_FINALIZATION_V4.md, 32 seções lidas integralmente. Precedência: evidência real > handoff vigente > V4 > V3/canônico > histórico. Checkpoint de entrada 173954ea824cbaf2e7b941dcc4a66af7ed7fb1ad, árvore limpa. Nenhuma reinstalação/alteração nova do CLI ou package-lock; package.json mudou só o comando de testes. Branch codex/orcaly-ecosystem; GitHub dessa branch e Preview já autorizados, não perguntar novamente.

Produção ozrasuktfthsvbqprtel somente leitura; staging zwxulgpjucxudadjdqov vinculado ao CLI. Não reset de produção, db push histórico, repair, edição de SQL aplicado, promoção ou merge main. WhatsApp congelado. .env.local aponta produção e foi preservado. QA usa start-staging-qa.mjs ou o Preview configurado com staging. Main verificado d940debf9556e1180fa3c709da0f560d3aa96374; deployment de produção conhecido dpl_3HeTKTcSdeM2kvzYUk5Drw5yJVtf, intocado nesta execução.

Entregue: carteiras reais/Lab, posições 1:1 com wealth_entries, vínculo a metas, quantidade/custo exatos, ledger dos 11 eventos, proventos/tarifas, avaliações com origem, cobertura desconhecida, alocação/Raio X, rebalanceamento e Future Simulator. Sem segundo saldo, cotações inventadas, ordens/pagamentos ou efeitos externos. Lab fora do patrimônio real. Ownership/entitlements/RLS/grants/CAS/idempotência/audit protegidos; edição genérica de holdings bloqueada. Rotas /apps/wealth/carteiras e /[portfolioId]; limites explícitos em docs/qa/ORCALY_WEALTH_PORTFOLIO.md. Portfolio usa dados declarados; market provider NOT_CONFIGURED.

Validação: 113 testes domínio/PostgreSQL (103 anteriores + 10 grupos Portfolio) PASS; lint de escopo, TypeScript e build PASS no Preview final. Três warnings legados do prebuild permanecem. 18 checks locais + 39 hospedados; Auth/Actions reais, histórico/CSV/lifecycle/recorrência/worker/Debt/NetWorth/Health regressivos, concorrência, replay, transferências, custo médio, RLS/cross-user/entitlements/consent, Lab, simuladores e auditoria. Axe A/AA, teclado/rolagem e larguras 320/390/768/1024/1440/1920; capturas versionadas em docs/qa/assets/wealth-portfolio, mobile/desktop inspecionados.

Staging tem 13 migrations; diretório local tem 82 SQLs. Dez anteriores preservadas. Aplicadas explicitamente após Health 20260926190000:
- 20260926181546_wealth_portfolio_foundation — SHA LF 65587f9653b26d3a39456b300f3c23ee013bb4918ab3f475171aa7cf3d8dda4d.
- 20260926185024_wealth_portfolio_target_binding — 7ec8a877ec19a08a4468478027bf36f40c01a7858d3dc9c960f543a81a647668.
- 20260926190250_wealth_portfolio_blind_dml_guard — d7638637a4fa85a2926f29819ed144d54d6de8f024ce9cc8069d625c16145cfc.

Versões geradas pelo CLI: as duas primeiras são numericamente anteriores a Health. Manter ordem explícita; não renomear história. As três são EXACT_MATCH local/staging por conteúdo e LOCAL_ONLY vs produção. Binding corrige referência SQL ambígua; guard corrige DELETE/UPDATE sem leitura por entitlement write-only. Predicado privado definer verifica somente auth.uid(), sem revelar holding alheia. Nenhum arquivo aplicado editado. Ledger/ACLs/catálogo em docs/execution/reconciliation/staging-portfolio-*.json; tipos reais regenerados; correções privadas não alteraram a interface pública.

Schema final: 100 adições e quatro mudanças intencionais vs Health, somente no Wealth novo. Cumulativo vs produção: 399 adições e zero alterações/remoções de objetos anteriores. Produção atual comparada somente leitura: zero diferenças, 51 versões históricas. Matriz histórica/3 UNKNOWNs preservados. Advisors sem WARN novo; INFO de recibos privados sem políticas é deny-by-default intencional. Permanecem WARN legado get_my_platform_admin_access, 63 auth_rls_initplan, 54 multiple_permissive_policies, uma FK legada sem índice e configuração Auth ainda não certificada resolvida.

Cleanup final confirmado via API e SQL: users, entries, goals, portfolios, holdings, transactions, recibos privados, audit, snapshots, debt terms, schedules, occurrences, jobs/idempotency/outbox = 0. Cron staging PAUSADO (zero jobs ativos). Nenhum cliente real, auth.users, dado pessoal ou secret copiado. Servidor local e sessão agent-browser encerrados; nenhum processo desta tarefa precisa permanecer ativo.

Erros encontrados/corrigidos: rede bloqueada do servidor local (reinício somente do QA com rede); binding targets (migration forward); semântica dl (Axe); bypass write-only (reproduzido no Postgres local e bloqueado pelo guard novo). Supabase hospedado rejeita DELETE sem WHERE antes do guard com 21000: runner aceita esse código apenas com mensagem WHERE e saldo intacto, além de 42501. Não se alterou produto para mascarar falhas.

Pendentes V4: Calendar/Bills, metas/funding, life-event, Vault, Timeline, Family, Automation, Fee Analyzer, Shield, Tax, Morning/Night, Alerts, Ask Wealth, Portfolio Intelligence, Market/Radar/OpenFinance contracts/adapters/UI e Regulatory Mode; plataforma/produtos/One/billing/scopes/consent/notificações/inteligência, login contextual, Hub2/launcher/brands/PWAs e gates de release. Resolver avisos herdados/UNKNOWNs, MFA/integrações reais, backup/rollback/observabilidade e validações completas antes de qualquer pedido de produção. Não promover nesta execução.
