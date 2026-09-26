# Orçaly Wealth — Portfolio Foundation (V4)

Escopo implementado em staging, com certificação de Preview em andamento. O master completo continua pendente.

## Modelo e limites

Cada holding estende por chave primária um único ativo de wealth_entries. Saldo, classe, liquidez, data, versão e arquivamento permanecem nesse ativo; holdings guardam quantidade decimal exata, custo declarado e metadados. Vincular um ativo existente preserva seu saldo e não cria outro. Lab armazena somente hipóteses, fora do patrimônio real. Vínculo a meta é informativo, sem reservar recursos duas vezes.

Carteiras e posições têm ownership, entitlement, CAS/PT409, comandos idempotentes e auditoria. Toda alteração passa pelo wrapper público invoker e implementação privada com search_path vazio. Comandos do mesmo usuário são serializados; transferências travam entradas em ordem de UUID. RLS permite somente leitura própria, grants negam DML direto, e um guard impede alterar/apagar holdings pelo CRUD genérico. Recibos privados têm deny-by-default, sem SELECT autenticado.

Movimentos: buy, sell, contribution, withdrawal, income, dividend, interest, fee, tax, transfer, adjustment. Custo médio ponderado em centavos; encerramento remove todo custo residual. Custo desconhecido continua desconhecido. Transferências internas conservam quantidade/custo, sem ganho realizado. Ajustes permitem corrigir somente custo com quantidade zero; ledger preserva estado antes/depois. Proventos, taxas e impostos não criam lançamentos de caixa ou pagamentos. Não há apuração tributária ou execução de ordens.

Avaliações: MANUAL_VALUE, IMPORTED_VALUE (extrato informado pelo titular), PROVIDER_MARKET_VALUE reservado a integração futura, NOT_AVAILABLE. Cliente não pode reivindicar avaliação de provedor. Mercado = NOT_CONFIGURED. Mudança de quantidade invalida a avaliação; valor físico zero + status desconhecido não significa patrimônio zero. Posição encerrada com quantidade zero tem valor zero conhecido. Visão geral, patrimônio, indicadores e CSV mostram dados parciais; CSV deixa as células monetárias desconhecidas vazias. Snapshots antigos continuam válidos e os novos preservam cobertura de avaliação.

Alocação/Raio X agregam todas as posições, por classe, identificador do ativo, emissor, setor, moeda declarada, liquidez e vencimento. Valores são BRL, sem conversão cambial inventada. Listas têm paginação de 25, sem limitar os totais. Picker de metas mostra primeiras 100 explicitamente; vínculo atual é preservado. Destinos de transferência na interface são posições compatíveis da página; RPC aceita qualquer destino compatível do mesmo titular. Campos ausentes permanecem desconhecidos.

Rebalanceamento distribui centavos por resto determinístico, exige avaliação de todas as posições e não executa operações. Future Simulator usa patrimônio líquido conhecido (passivos já descontados), lacuna/aportes de metas e mínimos de dívidas como referências; aporte informado é líquido das obrigações. Retorno mensal constante só incide sobre patrimônio positivo, inflação deflaciona saldo final; não simula novamente contratos de dívida nem desconta passivos duas vezes. Não produz garantia de retorno. Lab é isolado e persistente.

## Validação e correções

112 testes de domínio/PostgreSQL (103 anteriores + 9 grupos Portfolio) passaram, incluindo valores agregados acima da precisão segura de Number, mais de mil holdings, oito casas de quantidade, arredondamento de custo, todos os eventos, isolamento, grants, revogação, CAS, idempotência, Lab, cenários e CSV. Typecheck/lint de escopo/build passaram antes do Preview; build final registrado em portfolio-build-final.log. Três warnings históricos do prebuild permanecem.

18 checks locais com Supabase hospedado passaram; Auth, login e Actions reais, RLS, ownership forjado, conflito de versão, venda/custo, avaliação de extrato, alvos, cenários, Lab, revogação, audit, Axe WCAG A/AA e larguras 320/390/768/1024/1440/1920. Capturas mobile/desktop inspecionadas; evidência ORCALY_WEALTH_PORTFOLIO_LOCAL_E2E.json. Cenários adicionais de CAS concorrente/transferência serão exercitados na suíte hospedada final.

Falhas encontradas e corrigidas: servidor local iniciado no sandbox sem acesso de rede produzia login sem usuário; reinício do processo exclusivo de QA com rede resolveu. Configuração válida de targets tinha referência PL/pgSQL ambígua; reproduzida em teste e corrigida por migration nova, sem editar a aplicada. Axe encontrou elementos soltos dentro de dl; semântica corrigida e E2E repetido. Nenhum caso foi omitido para obter PASS. Contas sintéticas removidas após todas as tentativas.

## Banco e reconciliação

Baseline certificada foi preservada. Aplicação explícita APÓS Health 20260926190000: 20260926181546_wealth_portfolio_foundation e 20260926185024_wealth_portfolio_target_binding (timestamps reais gerados pelo CLI; não renomear a história para ordenar). Staging agora tem 12 versões; repositório 81 SQLs. Hashes/ledger em staging-portfolio-ledger.json. As duas migrations são EXACT_MATCH local/staging e LOCAL_ONLY vs produção. Target_binding substitui apenas a referência ambígua no corpo privado, com guard que exige exatamente uma ocorrência esperada.

Delta vs Health: 99 adições e quatro mudanças intencionais no Wealth novo: wealth_net_worth e wealth_summary adicionam cobertura, check de valor permite ativo zero, ordem das colunas recebe valuation_status. Cumulativo vs produção atual: 398 adições e nenhuma alteração/remoção de objetos anteriores de produção. Produção comparada somente leitura: zero diferenças. Matriz histórica e três UNKNOWNs permanecem; nenhuma migration repair, db push ou alteração histórica.

Advisors: sem WARN estrutural novo. INFO rls_enabled_no_policy agora 46, incluindo recibos privados propositalmente sem política; WARN legado public.get_my_platform_admin_access continua. Performance: 63 auth_rls_initplan, 54 multiple_permissive_policies e uma FK legada sem índice; unused_index é estatística, não motivo para apagar índices novos. Cron permanece pausado. Auth leaked-password protection e avisos herdados não certificados resolvidos.

Comandos: supabase migration new para cada arquivo; node --test scripts/test-wealth-portfolio.mjs; npm run test:ecosystem; npm run typecheck; eslint de escopo; npm run build; node scripts/prepare-wealth-staging.mjs portfolio/portfolioBinding; npx supabase db query --linked --project-ref zwxulgpjucxudadjdqov --file .local-qa/reconciliation/apply-wealth-continuation.sql -o json. Aplicação transacional com guard de staging vazio/baseline e ledger na mesma transação. Nenhum dado real, auth.users, segredo ou webhook foi copiado. .env.local preservado.

Referências de implementação: [funções Supabase](https://supabase.com/docs/guides/database/functions) e [locks PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html). Evidência real de schema e testes prevalece sobre inferências de nome.
