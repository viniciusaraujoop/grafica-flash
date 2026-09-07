# ORÇALY ADMIN / CONTROL CENTER 2.0

Data da revisão: 2026-08-19

Branch: `feat/admin-control-center-v2`

Base: `feat/partner-portal-v2` (`e6397ef419fd0d94b0c64002b30fa3604ba26232`)

PR: `#4 feat(admin): evolve backoffice into Control Center 2.0`

## Status executivo

O Admin Control Center 2.0 foi implementado em branch isolada sobre o Portal de Parceiros 2.0. O trabalho reutiliza os domínios existentes de empresas, assinatura, pagamentos, parceiros, auditoria, segurança, scanner, webhooks e autenticação administrativa.

O Supabase conectado `ozrasuktfthsvbqprtel` foi confirmado como ambiente ativo do Orçaly/GRAFICA FLASH e tratado como **produção protegida**. Nenhuma migration deste trabalho foi aplicada remotamente.

No HEAD validado pelo GitHub Actions, `npm test`, lint focado e `npm run build` passam. O lint global continua com dívida histórica e permanece baseline não bloqueante. O workflow também executa `npm audit` sem aplicar upgrade forçado.

**ADMIN CONTROL CENTER 2.0: NÃO APROVADO PARA PRODUÇÃO neste momento.**

Motivos objetivos:

1. a migration que cria Support Tickets/Feature Flags e amplia constraints/RPC do RBAC não foi aplicada a um staging confirmado;
2. testes runtime de RBAC com identidades Owner/Platform Admin/Finance/Support/Security/Operations/Viewer/usuário comum ainda não podem ser executados com segurança no ambiente conectado;
3. browser/E2E autenticado e matriz completa de responsividade ainda dependem de uma sessão administrativa de teste apropriada;
4. webhook replay continua deliberadamente desabilitado porque o handler atual não é comprovadamente idempotente para reprocessamento manual.

Produção não foi promovida por este trabalho.

## 1. Estado inicial

O Admin já possuía páginas de empresas, assinantes, financeiro, pagamentos, parceiros, auditoria, segurança, scanner, leads, integrações, equipe e APIs internas. O problema central era fragmentação: várias telas respondiam “quais registros existem?”, mas não entregavam uma visão operacional integrada do estado da plataforma.

O repositório foi operado por branch isolada. O estado conectado do GitHub foi usado como fonte de verdade para commits e diff.

## 2. Arquitetura encontrada

Stack confirmada:

- Next.js 16.2.9;
- React 19.2.4;
- TypeScript;
- Supabase/PostgreSQL/Auth;
- Vercel;
- GitHub.

Domínios reutilizados:

- `companies`;
- `company_members`;
- `plan_payments`;
- `subscription_events`;
- `marketplace_payment_settings`;
- `payment_webhook_events`;
- `security_events`;
- `security_blocklist`;
- `admin_audit_logs`;
- `admin_bug_reports`;
- `admin_scan_runs`;
- `admin_system_snapshots`;
- `platform_admins`;
- `platform_admin_invites`;
- domínio `affiliate_*` do Portal de Parceiros.

## 3. Segurança encontrada

O sistema já possuía autenticação administrativa server-side, porém o modelo tinha divergências:

- o type declarava `admin` e `finance`, mas o resolver de sessão aceitava efetivamente apenas Owner/Support/Prospector;
- várias policies antigas ainda referenciam `admin_users`, enquanto a autenticação moderna usa `platform_admins`;
- a antiga tela de Segurança alterava eventos diretamente pelo browser;
- o CHECK real de `platform_admins.role` não possuía Security/Operations/Viewer.

O Control Center V2 não usa essas inconsistências como autorização implícita. APIs novas passam pelo RBAC server-side em `lib/platform-admin.ts` antes de usar o cliente administrativo do Supabase.

## 4. Funcionalidades antigas preservadas

Foram preservados:

- autenticação administrativa existente;
- Owner oficial;
- Finance/Support/Prospector existentes;
- financeiro legado;
- gestão legada de equipe em `/admin/equipe`;
- scanner existente;
- gestão de parceiros/indicações/comissões/payouts;
- histórico de pagamentos;
- webhooks existentes;
- login e alteração de senha;
- migrations antigas;
- domínio de assinatura e providers atuais.

Nenhum provider financeiro foi trocado.

## 5. Control Center

`/admin` agora usa `AdminControlCenterV2`.

Mostra dados reais ou explicitamente indisponíveis:

- MRR observado;
- ARR observado;
- empresas pagantes;
- trials;
- novas empresas;
- receita do mês;
- pagamentos pendentes/falhos;
- parceiros ativos;
- comissões pendentes;
- empresas em atraso/cancelando;
- alertas críticos/altos;
- auditoria recente.

O bloco `Precisa da sua atenção` possui gravidade, contexto, entidade, data e CTA.

## 6. Empresa 360

Criado `/admin/empresas/[id]`.

Áreas implementadas:

- visão geral;
- assinatura;
- uso;
- usuários/memberships;
- pagamentos;
- integrações;
- segurança;
- auditoria.

Mostra também health score, último login do owner quando disponível, onboarding, uso, plano e estado derivado da assinatura.

## 7. Assinaturas

A Empresa 360 lê o contrato real de assinatura e exibe timeline de `subscription_events` e pagamentos.

Ações administrativas implementadas com contrato seguro:

- bloquear/desbloquear acesso da empresa;
- prorrogar trial;
- adicionar cortesia de acesso.

Prorrogação/cortesia exigem motivo e `Idempotency-Key`.

Alteração manual de plano, refund e sincronização forçada não foram expostos sem um contrato administrativo idempotente completo.

## 8. Receita

Criado `/admin/metrics`.

A receita da plataforma é derivada de `plan_payments` com status aprovados. O financeiro das empresas clientes não é somado como receita SaaS do Orçaly.

## 9. SaaS Metrics

Implementadas:

- MRR observado;
- ARR;
- receita do mês;
- receita do mês anterior;
- ARPU observado;
- cobertura da base usada no MRR.

Churn/Retention/Cohorts/LTV não recebem número inventado quando a série temporal necessária não está materializada de forma confiável.

## 10. Customer Success

Criado `/admin/customer-success`.

A API usa consultas limitadas a empresas, pedidos, produtos, clientes, integrações, pagamentos e auth users.

## 11. Health Score

Score explicável de 0–100 em `calculateCompanyHealth`.

Considera sinais observáveis como:

- assinatura em atraso/cancelamento;
- fim próximo de trial;
- último login do owner;
- onboarding;
- site/marketplace;
- produtos;
- pedidos;
- clientes;
- integração com erro.

Classes:

- `HEALTHY`;
- `ATTENTION`;
- `AT_RISK`.

O score não bloqueia cliente automaticamente.

## 12. Onboarding Monitor

Criado `/admin/onboarding-monitor`.

Etapas observadas:

- conta criada;
- empresa configurada;
- segmento;
- logo;
- primeiro produto;
- site publicado;
- WhatsApp;
- pagamento;
- primeiro pedido.

Empresas com onboarding incompleto por mais de sete dias são listadas como presas na ativação.

## 13. Suporte

Criada estrutura funcional de tickets na migration:

- `platform_support_tickets`;
- `platform_support_ticket_events`.

A API possui leitura, criação e transição de status com RBAC/auditoria.

Como o schema não foi aplicado à produção, `/admin/suporte` falha fechado e informa a migration pendente em vez de simular tickets.

## 14. Support Mode

Implementado Modo Suporte read-only.

Entrada normal:

1. requer `support.impersonate_readonly`;
2. requer motivo;
3. requer feature flag `support.mode`;
4. grava `support_mode_readonly_started` no audit log;
5. abre a Empresa 360 com banner explícito de somente leitura.

Não rouba sessão do cliente e não autentica o admin como usuário da empresa.

Enquanto a migration/flag não estiver pronta, a API retorna fail-closed.

## 15. Usuários

Criado `/admin/usuarios` sobre `company_members` com paginação server-side.

Exibe nome, e-mail, empresa, cargo e status.

Nenhuma senha é consultada ou exibida.

Ações de reset/invalidação de sessão não foram inventadas porque ainda não existe um contrato seguro por `user_id` documentado para todas as memberships.

## 16. RBAC

`lib/platform-admin.ts` foi ampliado para:

- Owner;
- Platform Admin;
- Finance;
- Support;
- Security;
- Operations;
- Viewer;
- Prospector.

Domínios principais:

- companies.*;
- users.*;
- billing.*;
- partners.*;
- support.*;
- system.*;
- security.*;
- features.*;
- admins.*;
- audit.read;
- webhooks.*;
- growth.read;
- notifications.read;
- scanner.*.

Aliases legados são mantidos para não quebrar APIs antigas.

## 17. Ações críticas

Ações sensíveis novas validam permissão no servidor.

Bloqueio, trial, cortesia, feature flag, equipe, segurança, suporte e Support Mode exigem motivo e geram audit log.

Ações não seguras ou não contratadas não aparecem como botões funcionais.

## 18. Audit

`auditPlatformAction` passou a sanitizar payload recursivamente.

Chaves sensíveis como password, authorization, access/refresh tokens, service role, secrets e dados de cartão são substituídas por `[REDACTED]`.

Há limites de profundidade, tamanho de string, arrays e número de propriedades.

## 19. Security Center

`/admin/seguranca` foi substituído por UI que usa API server-side.

Exibe `security_events` e `security_blocklist` reais.

Resolver evento exige `security.manage`, motivo e auditoria.

## 20. System Health

Criado `/admin/system-health`.

Estados possíveis:

- Operational;
- Degraded;
- Down;
- Unknown.

Fontes:

- Supabase: consulta real;
- Vercel: apenas evidência do runtime atual, com ressalva explícita;
- Mercado Pago: telemetria de webhooks recentes;
- WhatsApp: logs recentes;
- OpenAI: `Unknown` sem telemetria persistida de saúde externa;
- E-mail: `Unknown` quando não há telemetria;
- Jobs/Cron: `Unknown` sem registro centralizado.

## 21. Webhooks

Criado `/admin/webhooks`.

Exibe:

- provider;
- evento;
- objeto provider;
- status;
- attempts;
- received/processed;
- erro;
- `payload_sanitized`.

## 22. Feature Flags

Migration cria `platform_feature_flags` com escopos:

- global;
- plano;
- segmento;
- empresa.

Precedência implementada:

`empresa > segmento > plano > global`.

Toda alteração usa RBAC e audit log.

Flags iniciais de risco:

- `support.mode` desativada;
- `admin.ai` desativada como configuração disponível para rollout.

## 23. Configurações

A configuração administrativa legada foi preservada.

O Control Center não expõe secrets completos nem adiciona editores de secret no browser.

## 24. Busca Global

Ctrl/Cmd+K implementado no shell.

Busca com debounce e limites server-side em entidades permitidas pelo papel:

- empresas;
- usuários;
- pagamentos;
- parceiros;
- webhooks.

A paleta não executa ações destrutivas.

## 25. Growth

`/admin/growth` encaminha à Central Growth de parceiros já desenvolvida, evitando um segundo sistema paralelo.

## 26. Parceiros

O Admin reutiliza `/admin/indicacoes/growth` do Portal Parceiros 2.0 e preserva a gestão financeira já existente em `/admin/indicacoes`.

## 27. IA

Criado `/api/admin/ai` + `AdminDailyBriefV2`.

Características:

- rate limit;
- dados fornecidos pelo Control Center;
- prompt proíbe inventar evento;
- não recebe tools de ação;
- não bloqueia cliente;
- não aprova payout;
- não faz refund;
- não altera plano;
- fallback local quando OpenAI não está disponível.

## 28. Notificações

Criado `/admin/notificacoes`.

Alertas são derivados de condições reais:

- security event aberto;
- webhook falho;
- pagamento falho/rejeitado;
- payout pendente/falho.

O header mostra contagem de alertas Critical/High quando permitido.

Não foi criada uma falsa caixa de “lidos”: a condição desaparece quando é resolvida na fonte.

## 29. Banco

Leitura real confirmou as tabelas existentes e a ausência atual de Support Tickets/Feature Flags.

O projeto `ozrasuktfthsvbqprtel` foi tratado como produção.

## 30. Migrations

Criada e NÃO aplicada remotamente:

`supabase/migrations/20260819230000_admin_control_center_v2.sql`

Conteúdo:

- tickets;
- eventos de ticket;
- feature flags;
- RLS;
- índices;
- evolução dos CHECKs de roles;
- evolução da RPC `complete_platform_admin_invite`.

A substituição dos CHECKs/RPC é necessária para que Security/Operations/Viewer sejam papéis reais, não apenas TypeScript.

## 31. APIs

Novas APIs principais:

- `/api/admin/control-center-v2`;
- `/api/admin/companies-v2`;
- `/api/admin/company-360/[id]`;
- `/api/admin/search`;
- `/api/admin/users-v2`;
- `/api/admin/payments-v2`;
- `/api/admin/customer-success`;
- `/api/admin/system-health`;
- `/api/admin/webhooks`;
- `/api/admin/security`;
- `/api/admin/notifications-v2`;
- `/api/admin/support-tickets`;
- `/api/admin/support-mode`;
- `/api/admin/feature-flags`;
- `/api/admin/team-v2`;
- `/api/admin/ai`.

## 32. Performance

Aplicado:

- limites explícitos;
- paginação por cursor em empresas/usuários/pagamentos;
- contagens agregadas onde apropriado;
- busca limitada;
- debounce;
- selects explícitos;
- queries em paralelo quando seguras.

O Control Center retorna indicadores de cobertura quando um limite pode afetar a leitura.

## 33. Segurança

Garantias do novo código:

- RBAC no servidor;
- service role não enviada ao client;
- audit sanitization;
- motivo em ações críticas;
- Support Mode fail-closed;
- Feature Flags fail-closed;
- webhook replay bloqueado;
- dados de webhook usam payload sanitizado;
- Owner não pode ser desativado pela API Team V2.

## 34. Responsividade

Os componentes foram construídos com grids fluidos, tabelas com overflow horizontal, drawer mobile e layout responsivo.

A validação browser visual completa em 375/390/430/768/1024/1280/1440/1920 ainda é critério pendente de release porque não existe sessão Admin de teste fornecida ao browser automatizado.

## 35. Acessibilidade

Implementado no código novo:

- botões reais para ações;
- labels/aria em navegação e busca;
- diálogo com `aria-modal` onde aplicável;
- foco automático na command palette;
- targets de toque próximos/acima de 40px;
- contraste sóbrio;
- conteúdo não depende apenas de cor.

Validação browser/teclado completa permanece pendente.

## 36. Animações

Foram usadas transições sutis e skeletons.

Classes `motion-reduce` são aplicadas aos carregamentos/transições principais. Não foram adicionadas animações decorativas longas.

## 37. Testes Unitários

O repositório não possui framework unitário tradicional configurado para este domínio.

Foi criada suíte de invariantes executável por `npm test`, que valida regras críticas estáticas do Control Center e mantém os invariantes do Portal Parceiros.

Resultado no CI atual: PASS.

## 38. Integração

O `next build` executa TypeScript e valida a integração de imports/rotas.

Foram realizadas consultas read-only no banco real para validar MRR/ARR/receita e duplicidade de IDs financeiros/webhook.

Testes destrutivos de integração não foram executados contra produção.

## 39. E2E

E2E autenticado completo permanece bloqueado sem uma identidade administrativa de teste e sem staging confirmado.

A release não deve ser aprovada por inferência.

## 40. RBAC Tests

Validações estáticas do permission matrix estão no `npm test`.

Testes runtime Owner/Platform Admin/Finance/Support/Security/Operations/Viewer/usuário comum dependem da migration + identidades de teste e não foram executados em produção.

## 41. IDOR Tests

As novas APIs sempre derivam o admin da sessão e validam permissão server-side.

Teste adversarial runtime com múltiplas identidades ainda está pendente; não foi criado usuário artificial em produção apenas para marcar “PASS”.

## 42. Financial Tests

Auditoria read-only em 2026-08-19:

- empresas derivadas como ativas: 2;
- ativas com pagamento-base observado: 1;
- MRR observado: R$ 99,90;
- ARR observado: R$ 1.198,80;
- receita aprovada no mês: R$ 0,00;
- `provider_payment_id` duplicados: 0;
- `(provider, provider_event_id)` duplicados: 0.

O dashboard mostra cobertura do MRR justamente porque nem toda empresa ativa possui pagamento-base observado.

## 43. TypeScript

GitHub Actions executa `next build`, incluindo TypeScript.

Resultado no último workflow bloqueante: PASS.

## 44. Build

`npm run build`: PASS no workflow bloqueante do PR.

Vercel Previews são gerados automaticamente pela branch.

## 45. Lint

Lint focado: PASS no último workflow bloqueante.

Lint global: dívida histórica existente, executada como baseline `continue-on-error`.

Não foi usado o trabalho do Control Center como desculpa para refatorar todo o legado.

## 46. Browser

Ferramenta de browser está disponível, porém a validação autenticada depende de sessão/credencial Admin de teste. O Preview também pode estar sujeito à Deployment Protection da Vercel.

Apenas fluxos que puderem ser acessados legitimamente serão marcados como testados.

## 47. Regressão

Preservados deliberadamente:

- Finance legado;
- Partner Growth/gestão financeira;
- equipe Admin legada;
- scanner;
- login;
- alteração de senha;
- providers;
- assinatura;
- webhooks.

Algumas páginas foram substituídas por experiências V2 mantendo os dados/rotas de domínio: Home Admin, Empresas, Pagamentos e Segurança.

## 48. Bugs encontrados

Durante a implementação foram encontrados:

1. roles declarados mas rejeitados no resolver Admin;
2. CHECK do banco incompatível com RBAC desejado;
3. RPC de convite hardcoded para Prospector;
4. antiga tela Security escrevendo diretamente pelo browser;
5. webhook aprovado não seguro para replay manual;
6. MRR sem base para 100% das empresas ativas;
7. paginação inicialmente com tipagem incorreta de cursor;
8. PromiseLike do PostgREST incompatível com type explícito da busca;
9. erro de parsing na primeira versão da UI RBAC;
10. Support Mode inicialmente acessível sem feature flag de rollout.

## 49. Bugs corrigidos

Corrigidos no código novo:

- resolver de roles;
- permission matrix;
- sanitização de audit;
- cursor typing;
- busca PromiseLike;
- parsing do Team V2;
- Security Center server-side;
- Support Mode auditado e fail-closed por flag;
- convite de Admin preparado para roles reais via migration/RPC.

Webhook replay não foi “corrigido” por maquiagem: permanece bloqueado até haver idempotência comprovada.

## 50. Commits

Commits coerentes incluem:

- `feat(admin): harden RBAC and add control center services`;
- `feat(admin): add control center and company 360 experience`;
- `feat(admin): add observability support and feature operations`;
- `feat(admin): add payments alerts support mode and daily brief`;
- `feat(admin): add secure team RBAC invitations`;
- `test(admin): add control center invariants and CI`;
- correções pontuais de TypeScript/lint/RBAC/support mode.

## 51. Preview

A branch gera Vercel Preview automaticamente.

Nenhuma promoção para produção foi executada.

O Preview final deve ser usado para browser QA depois que houver acesso administrativo de teste adequado.

## 52. Rollback

Código:

- manter PR draft/não fazer merge;
- se posteriormente integrado, usar `git revert` dos commits do Control Center ou rollback do deployment Vercel.

Banco:

- a migration não foi aplicada atualmente;
- após aplicação, desligar `support.mode`/flags permite desativar superfícies de maior risco;
- rollback de código não exige apagar tickets/flags;
- constraints/RPC devem ter migration de reversão específica se alguma aplicação futura precisar ser revertida.

## 53. Pendências

Bloqueios/pendências antes de produção:

1. aplicar `20260819230000_admin_control_center_v2.sql` somente em staging confirmado;
2. testar convites/roles estendidos no staging;
3. executar matriz RBAC completa;
4. executar IDOR/BOLA com identidades apropriadas;
5. validar Support Mode e sua feature flag;
6. validar Support Tickets/Feature Flags depois da migration;
7. browser/E2E autenticado;
8. responsividade nas larguras exigidas;
9. teclado/foco/contraste em browser;
10. console/network sem regressões;
11. revisar o diff final após qualquer correção de QA;
12. somente então considerar produção.

Até essas evidências existirem, o status correto é **Preview/PR técnico pronto para QA, não produção aprovada**.
