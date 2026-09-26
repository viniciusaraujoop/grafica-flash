# Relatório V6 — unidade de planejamento

Metas avançadas, Funding e Life Event Planning implementados. A unidade preserva wealth_goals, saldos e recorrências; acrescenta fontes, projeções explicáveis e cenários de eventos de vida. Produção/main intocadas.

Checkpoint de entrada: codex/orcaly-ecosystem, 0af3f3e060831e8c482dcbe41beb38c325753917, árvore limpa, 14 migrations confirmadas somente por leitura. Home/Hub/Core/Portfolio/Calendar/Bills preservados. Agora staging zwxulgpjucxudadjdqov tem 15 migrations e 84 arquivos locais; nova 20260926205052_wealth_goal_funding_life_plans, SHA LF 7ff665992f1813f1888ea6e430c6f047f8f717774acdb017f253ca023b408bcb, exatamente igual ao ledger. Os 15 hashes conferem; baseline CRLF original preservada. Nenhum reset, db push, repair, edição de SQL aplicado, main merge ou promoção.

Produção ozrasuktfthsvbqprtel somente leitura: comparação do snapshot atual com Calendar confirma zero mudanças. Delta desta unidade 74 adições; cumulativo contra produção 500 adições, zero legado alterado/removido. Nenhuma extension, cron, webhook ou integração externa nova. Advisors sem novos WARN; avisos herdados/Auth seguem gates de produção; 47 INFO RLS sem policies incluem receipts privados intencionalmente inacessíveis. Detalhes/hashes/remediações em docs/execution/reconciliation/*planning*.json.

Metas usam wealth_goals existente e reserved/saved_cents declarado. Funding acrescenta prioridade/categoria/fontes sem somar saldos. CAS compartilhado com editor legado; RPC privado protegido por owner/read/write, versão, lock e receipt idempotente. Projeções exatas sem retornos, ritmo planejado, saúde explicada por quantidade de aportes. Leitura da meta não exige escrita. Life Plans em /apps/wealth/planejamento traz custos iniciais/recorrentes, capacidade, reserva, prazo, premissas, lacunas e vínculos a metas/dívidas/carteiras próprias. Cenários são simulações independentes; não presumem pagamentos, crédito ou valorização. Contratos e limites: docs/qa/ORCALY_WEALTH_PLANNING.md.

Validação: 130 testes domínio/PostgreSQL (121 anteriores + 9 novos), TypeScript e lint PASS. E2E local: 17 PASS, Auth/DB hospedados, concorrência real com PT409, replay, Server Actions, owner, isolamento, revogação, read-only/write-only, Axe, temas e seis larguras. Correção de contraste restrita ao arquivamento na nova página. Todos os fixtures removidos; QA local e agent-browser encerrados. Relatório ORCALY_WEALTH_PLANNING_LOCAL_E2E.json. Build e Preview desta unidade ainda pendentes; o último Preview certificado continua Calendar em orcaly-ef77tbh5l-vinicius-araujos-projects.vercel.app.


Master V5/V6 segue em andamento; nenhuma conclusão de desenvolvimento ou prontidão de produção foi declarada. Após Preview certificado, continuar Vault e sequência V6.
