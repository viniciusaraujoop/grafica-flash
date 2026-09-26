# Wealth — Debt Center (seção 6.5)

Implementado em /apps/wealth/dividas e /apps/wealth/dividas/[entryId]. Criação, detalhamento de passivo existente sem duplicação, edição, principal original, saldo declarado, juros fixos mensais, mínimo, parcelas totais/restantes, vencimento, prioridade e declaração de quitação. Lista paginada 25. Arquivamento/restauração pelo histórico existente. Nenhuma cobrança, pagamento, transferência ou negociação executada.

wealth_debt_terms estende a própria wealth_entries por FK 1:1; o saldo continua único e entra nos totais integrais existentes. Zero é permitido somente para passivos, representando quitação; receitas/despesas/ativos permanecem positivos. Uma dívida detalhada não pode mudar para outra espécie de lançamento. RPCs públicas invoker → implementação privada com auth/entitlement/owner e CAS da versão da entrada. Sem DML direto autenticado; RLS própria de leitura. Auditoria contém identificadores; cascade/cleanup preservam isolamento.

Simulador determinístico, BigInt e centavos exatos: menor saldo (snowball), maior taxa (avalanche) ou prioridade pessoal. Mínimos primeiro, orçamento mensal total constante, juros antes dos pagamentos e arredondamento por dívida. Reinvestimento do orçamento livre nas outras dívidas. Máximo explícito de 50 dívidas detalhadas/abertas e 600 meses; nenhum total silenciosamente truncado. Informa orçamento abaixo dos mínimos ou saldo no fim do horizonte, sem inventar data de quitação. Parcelas/vencimentos são informações cadastrais; não simula dias úteis, juros diários, taxas variáveis, seguros, tarifas, multas, descontos ou novas compras. Não é CET, oferta de crédito, garantia ou recomendação personalizada.

Critérios de ordenação conferidos na [orientação do CFPB](https://www.consumerfinance.gov/archive/blog/how-reduce-your-debt/). A comparação matemática usa apenas taxas/valores declarados pelo usuário; nenhuma conexão financeira foi criada.

## SQL aplicado somente em staging
| Migration | SHA-256 normalizado LF |
| --- | --- |
| 20260926165000_wealth_debt_center | 6cccbc9078b294f5400fe3f97358dc5bdfc732ad70db890161ab109b3efd7ea2 |
| 20260926171000_wealth_debt_conflict_response | 93c361e50ddee175c690faf330f09461e0999aede501d3ad5c765a98f724e263 |

Primeira migration criou termos/RLS/RPCs/triggers e ajustou o check do passivo quitado. A correção posterior troca o erro de versão por PT409. Não foi editada a migration já aplicada. Hashes comparados ao ledger; ambas LOCAL_ONLY vs produção, equivalência exata local/staging. Oito migrations no staging, 77 SQLs locais no inventário atual.

Delta vs clock: 27 adições e uma alteração intencional do check amount_cents no Wealth novo. Cumulativo vs produção capturada: 271 adições, zero alterações/remoções de objeto antigo de produção. Evidências staging-debt-final-delta.json e staging-debt-final-vs-production.json. Types reais regenerados; correção privada posterior não muda assinaturas. Advisors sem WARN estrutural novo; pendências legadas/Auth continuam separadas.

## Validação
- 95 testes domínio/PostgreSQL: 85 anteriores + 10 desta unidade.
- Lint de escopo PASS; build inclui TypeScript e suites legadas. Build final após correção PASS, incluindo TypeScript, lint de escopo e as 95 verificações de domínio/PostgreSQL.
- 16 checks locais com Supabase real PASS, cleanup inteiro zero, incluindo wealth_debt_terms. Evidência ORCALY_WEALTH_DEBT_LOCAL_E2E.json.
- Browser: criação/edição, centavos, owner forjado, isolamento, versão antiga, read-only, quitação, reuso 1:1, três estratégias, mínimo insuficiente, audit, Axe A/AA e 320/390/768/1440. Screenshot mobile inspecionado.
- Preview certificado: https://orcaly-bb34uyljo-vinicius-araujos-projects.vercel.app; deployment dpl_Fg2Cw8q2o9YyUmSrSaGewcHqFkqr; SHA de aplicação 0df50275488e326aa0b2da8cab2a96b085a66841. READY/Preview. 27 checks inteiramente hospedados PASS, zero erros/requests para produção e todas as contagens de cleanup zero. Evidência: docs/qa/ORCALY_WEALTH_DEBT_VERCEL_E2E.json. A regressão confirma HTTP 409/PT409 em até sete segundos; UI mobile hospedada inspecionada.

## Erros encontrados e resolvidos
TypeScript do projeto não aceita literals BigInt com alvo atual; usados construtores BigInt, preservando aritmética exata sem mudar o target global. O schema original exigia valor positivo para todo lançamento: adicionado check condicional em migration nova para passivo quitado.

E2E real encontrou loop do PostgREST ao usar SQLSTATE 40001 para versão obsoleta. Testes diretos de PostgreSQL não reproduziam a camada HTTP. Substituído por PT409 em migration futura, Action trata o conflito e teste hospedado exige resposta finita. [Diagnóstico oficial](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Nenhuma troca de versão/configuração do servidor foi feita. Não usar 40001 como erro de negócio em RPC.

Comandos: testes em scripts/test-wealth-debt*.mjs; npm run build; scripts/prepare-wealth-staging.mjs debt / debtConflict + db query com --project-ref zwxulgpjucxudadjdqov; catálogo/advisors/types; ORCALY_QA_DEBT=true node scripts/e2e-ecosystem-staging.mjs. Execuções anteriores falhas tiveram cleanup zero. Servidor QA deve ser encerrado antes de typegen/build; cron do staging permanece pausado para testes determinísticos.
