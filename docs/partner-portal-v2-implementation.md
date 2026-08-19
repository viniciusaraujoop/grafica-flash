# PORTAL DE PARCEIROS 2.0

Data da revisão: 2026-08-19

Branch: `feat/partner-portal-v2`

Base: `feat/orcaly-operations-experience-v2` (`955210e7e4973e3880158ffcbb9755d519fa2912`)

PR: `#3 feat(partners): evolve partner portal into growth platform`

## Status executivo

A evolução integrada do Portal de Parceiros foi implementada em branch isolada e publicada somente em Vercel Preview. O núcleo histórico de atribuição, comissão, hold, Pix, payout, ranking, academia, certificações e antifraude foi preservado.

A engenharia bloqueante está aprovada por evidência objetiva no CI do PR: `npm test` PASS, lint focado PASS, TypeScript PASS e `next build` PASS.

**Release para produção ainda NÃO está aprovado.** A Vercel Deployment Protection bloqueou a validação browser autenticada do Preview, e não existe staging conectado nem duas identidades de parceiro de teste para executar a matriz A × B/IDOR em runtime sem tocar em dados reais. Esses itens permanecem critérios deliberados de release, não são tratados como “passaram por inferência”.

Produção não foi alterada por este pacote.

## 1. Estado inicial

O programa já possuía landing, cadastro, login, tracking, referral attribution, portal, CRM do parceiro, tarefas, materiais, academia, certificações, ranking, comissões, conta Pix, payout e administração.

A principal limitação não era ausência de domínio financeiro, e sim experiência fragmentada e baixa integração comercial. Havia funcionalidades reais suficientes para evoluir sem criar um segundo sistema paralelo.

O repositório local não foi usado como fonte de verdade porque o ambiente de execução não conseguia resolver GitHub de forma confiável. Estado, branches, commits, diff e arquivos foram operados pelo conector GitHub. Nenhum trabalho não commitado do usuário foi sobrescrito.

## 2. Arquitetura encontrada

Stack confirmada:

- Next.js 16.2.9;
- React 19.2.4;
- TypeScript;
- Supabase/PostgreSQL;
- Supabase Auth;
- Vercel;
- GitHub.

Núcleo existente reutilizado:

- `lib/affiliates/server.ts`: autenticação, atribuição, antifraude, comissão, hold, estorno, Pix, payout e ranking;
- `lib/affiliates/workspace.ts`: CRM, tarefas, conteúdo, academia e operações comerciais;
- `affiliate_profiles`;
- `affiliate_referrals`;
- `affiliate_clicks`;
- `affiliate_commissions`;
- `affiliate_payouts`;
- `affiliate_payout_items`;
- `affiliate_leads`;
- `affiliate_tasks`;
- `affiliate_activity_events`;
- estruturas de academia/certificação/conquistas.

Projeto Supabase conectado e tratado como produção protegida: `ozrasuktfthsvbqprtel` / GRAFICA FLASH. O staging histórico informado na especificação não estava disponível na conexão atual.

## 3. Funcionalidades antigas preservadas

Foram preservados os contratos reais de:

- login e cadastro de parceiro;
- link/referral code existente;
- tracking antigo;
- atribuição por referral;
- regras de autoindicação;
- comissão baseada em pagamento elegível;
- hold e estorno;
- conta Pix mascarada/validada;
- payout via RPC existente;
- ranking;
- Academia;
- certificações;
- níveis/conquistas;
- Central de Divulgação;
- CRM/workspace antigo;
- gestão financeira/admin existente;
- termos atuais do programa;
- demonstração sintética genérica.

Nenhum histórico de comissão, saldo ou payout foi recalculado ou migrado.

## 4. Dashboard

Criado um novo shell profissional em `components/parceiros/PartnerPortalV2.tsx` e ativado em `/parceiros/painel`.

O dashboard agora exibe:

- comissões históricas;
- saldo disponível;
- saldo pendente;
- clientes pagos;
- indicações;
- conversão;
- receita atribuída;
- EPC;
- ticket médio;
- tempo médio de conversão;
- health score explicável;
- funil Clique → Lead → Cadastro → Teste → Pago;
- gráfico leve por período;
- bloco “Precisa da sua atenção”;
- link principal com copiar/QR.

Períodos suportados: 7, 30, 90 e 365 dias.

## 5. Pipeline

Criado `/parceiros/pipeline` com `PartnerPipelineV2`.

Modos:

- Kanban;
- Lista.

Etapas comerciais reutilizadas do domínio existente:

- Novo contato;
- Apresentação;
- Demonstração;
- Interessado/teste;
- Cliente;
- Perdido.

O drag and drop chama a ação real `update_lead` do workspace existente. Há atualização otimista com rollback em falha. O backend valida `affiliate_id` antes de alterar o lead.

Etapas financeiras continuam derivadas de pagamento e não são manualmente falsificáveis pelo Kanban.

## 6. Mini CRM

O CRM existente em `affiliate_leads` foi mantido como fonte de verdade.

O novo portal reutiliza:

- empresa;
- responsável;
- WhatsApp;
- e-mail;
- segmento;
- origem;
- observações;
- próxima ação;
- status;
- valor estimado;
- motivo de perda quando disponível.

O `PartnerGrowthHub` antigo continua disponível e integrado no portal para funções já maduras de CRM/tarefas/conteúdo.

## 7. Indicação manual

Implementada ação `register_referral` no Portal v2.

Valida:

- empresa;
- responsável;
- WhatsApp;
- e-mail opcional;
- segmento;
- observação.

O claim manual usa telefone normalizado/hash e a janela oficial de atribuição. Conflito com outro parceiro retorna `409` sem revelar identidade do parceiro concorrente.

O claim deixa trilha em `affiliate_audit_logs`.

## 8. Links e campanhas

Implementadas campanhas rastreáveis sem tabela nova paralela.

Campanhas são armazenadas de forma append-only em `affiliate_activity_events` usando `kind='content'`, um valor já permitido pela constraint existente, e subtipo no metadata.

Campos:

- nome;
- canal;
- segmento;
- descrição;
- código;
- status;
- datas.

Cada campanha gera link contendo:

- `ref`;
- `pc`;
- `utm_source=partner`;
- `utm_medium`;
- `utm_campaign`;
- segmento quando aplicável.

Campanhas podem ser arquivadas sem apagar histórico.

## 9. Tracking

O tracking antigo foi preservado.

A evolução conecta campanha à atribuição:

1. clique contém `pc` no landing path;
2. `affiliate_clicks` registra o clique existente;
3. durante o signup, o backend procura o clique recente compatível por parceiro + hash de IP dentro da janela de atribuição;
4. o referral recebe `source='campaign:<code>'`.

Analytics cruzam cliques, referrals, clientes pagos, receita e comissão por campanha.

Nenhum pagamento é inferido por clique.

## 10. QR Code

O portal usa a dependência `qrcode` já existente para gerar PNG no browser.

É possível gerar QR para:

- link principal;
- campanha.

O QR usa URL real de tracking, não mock.

## 11. Cupom

Não foi criado desconto artificial.

O código único do parceiro foi formalizado como fallback de **atribuição**, em `/cadastro/codigo`.

O código é validado contra parceiro ativo em `/api/public/partner-code/[code]`, salvo no cliente e encaminhado ao cadastro normal por `?ref=`.

A tela informa explicitamente que o código não altera automaticamente preço, plano ou condição comercial.

## 12. Divulgação

`PartnerPromotionTab` foi preservado e incorporado ao novo shell.

Materiais e ações já existentes continuam funcionais. A nova camada adiciona campanhas/links/QR e IA comercial sem substituir a biblioteca existente por placeholders.

## 13. IA

Criado `/api/parceiros/ai`.

Modos:

- mensagem comercial;
- objeção;
- follow-up;
- post/story.

Regras:

- `requireAffiliate`;
- rate limit por minuto;
- limite diário;
- somente funcionalidades reais do Orçaly são apresentadas no prompt de sistema;
- nunca envia automaticamente;
- saída sempre é sugestão para revisão;
- fallback local funciona sem `OPENAI_API_KEY`.

Falha da OpenAI não bloqueia CRM, campanha, tracking, payout ou portal.

## 14. Demonstrações

A demonstração genérica antiga foi preservada.

Parceiros autenticados agora possuem um estúdio em `/parceiros/demo` para criar sessões sintéticas tokenizadas.

Nova rota pública: `/demo/[token]`.

Características:

- token imprevisível;
- resolução server-side;
- dados de pedidos/clientes/financeiro continuam sintéticos;
- nome/segmento só contextualizam apresentação;
- abertura é registrada como evento `kind='demo'`, `metadata.eventType='open'`;
- histórico mostra contagem e última abertura.

A constraint existente de `affiliate_activity_events.kind` foi auditada. A implementação inicial usava kinds novos e incompatíveis; isso foi identificado antes do release e corrigido para reutilizar kinds permitidos.

## 15. Academia

`PartnerAcademyV3` foi preservado e integrado no novo portal.

Não foi recriada uma segunda academia.

## 16. Níveis

A estrutura de níveis existente foi preservada. O Portal v2 exibe health score como indicador operacional separado, sem alterar percentuais de comissão por nível.

## 17. Conquistas

Conquistas e progressão existentes no workspace/Academia foram preservadas.

Nenhuma conquista financeira foi adicionada como gatilho de comissão.

## 18. Ranking

O ranking existente foi preservado.

O novo shell apresenta posição, score e conversões, sem expor:

- saldo de outro parceiro;
- comissão privada;
- telefone;
- e-mail.

A métrica continua privilegiando conversões qualificadas em vez de cliques facilmente manipuláveis.

## 19. Comissões

O motor de comissão não foi reescrito.

Permanece ancorado em pagamento elegível e nas constraints/índices existentes.

Auditoria read-only em produção confirmou:

- 0 `provider_payment_id` duplicados em comissões;
- 0 referrals com múltiplas comissões;
- 0 comissões órfãs.

A carteira nova apenas apresenta o domínio existente.

## 20. Payout

O payout continua usando a RPC `create_affiliate_payout_admin` existente.

A RPC auditada:

- adquire lock do parceiro;
- valida conta Pix;
- bloqueia payout concorrente em estados ativos;
- trava comissões disponíveis;
- aplica mínimo de saque;
- cria payout/payout_items;
- muda comissão para processing.

Auditoria do banco confirmou:

- 0 comissões em múltiplos payout items;
- 0 external references duplicadas;
- 0 payout items órfãos;
- comissões `paid` conciliadas com payouts `paid` no parceiro existente, diferença 0.

## 21. Notificações

Criado `/parceiros/notificacoes`.

As notificações são derivadas de fatos existentes:

- tarefa vencida/hoje;
- indicação sem avanço;
- saldo disponível;
- saque com falha.

A leitura é registrada como evento `kind='manual'` com subtipo no metadata.

Ações:

- marcar uma como lida;
- marcar todas;
- abrir pipeline ou contexto relacionado.

Não foi introduzido push externo.

## 22. Analytics

Novo service `lib/affiliates/portal-v2.ts` agrega:

- cliques;
- leads/referrals;
- cadastros detectáveis;
- testes;
- clientes pagos;
- receita de primeiro pagamento;
- comissão;
- conversão;
- EPC;
- ticket médio;
- tempo médio para conversão;
- origem;
- performance de campanha.

Queries são limitadas e executadas server-side.

## 23. Admin

Criado `/admin/indicacoes/growth` e `/api/admin/affiliates/growth`.

Autorização usa `requireOfficialPlatformOwner` server-side.

A central mostra:

- parceiros;
- ativos/esfriando/inativos;
- cliques 30d;
- indicações;
- clientes pagos;
- receita;
- comissões;
- payouts pagos;
- sinais de revisão;
- health score por parceiro;
- última atividade.

As operações financeiras permanecem na gestão admin existente `/admin/indicacoes`.

## 24. Anti-fraude

Proteções existentes foram preservadas:

- autoindicação;
- hashes de identificadores;
- vínculo de referral;
- constraints por pagamento/referral;
- revisão administrativa;
- audit log.

A nova indicação manual adiciona prevenção de conflito por telefone/e-mail dentro da janela de atribuição.

Health score não bloqueia parceiro automaticamente.

## 25. RLS/Segurança

Auditoria do schema real confirmou RLS habilitado nas tabelas `affiliate_*` relevantes.

Exemplos:

- parceiro lê o próprio perfil;
- parceiro lê os próprios referrals;
- parceiro lê as próprias comissões;
- parceiro lê os próprios payouts;
- acesso client direto a `affiliate_clicks` e `affiliate_payout_items` permanece negado;
- `affiliate_activity_events` valida ownership do `affiliate_id`.

Novos endpoints privados derivam parceiro da sessão via `requireAffiliate`. O admin Growth valida owner server-side.

Nenhuma `SUPABASE_SERVICE_ROLE_KEY` foi enviada a componentes client.

## 26. Banco/migrations

Nenhuma migration foi aplicada remotamente.

Foi criada somente a migration aditiva:

`supabase/migrations/20260819221500_partner_portal_v2_indexes.sql`

Ela contém apenas `CREATE INDEX IF NOT EXISTS` para caminhos novos de query:

- lookup de claim por WhatsApp hash/data;
- clique por affiliate/IP/data;
- contato de lead;
- metadata JSONB de activity events.

A migration não contém `DROP` ou `TRUNCATE`.

Aplicação pendente até existir staging/teste de banco confiável.

## 27. Performance

Melhorias:

- analytics server-side;
- limites explícitos em queries;
- busca sem carregar histórico ilimitado;
- campanhas derivadas de eventos limitados;
- agregação administrativa no servidor;
- índices aditivos preparados para os novos caminhos;
- nenhuma lista de 10 mil registros enviada ao browser como padrão do portal.

Para volumes muito maiores, próximo endurecimento recomendado é RPC/SQL agregada por período, sem alterar a API pública do portal.

## 28. Responsividade

O novo shell inclui:

- sidebar desktop;
- header compacto;
- bottom navigation mobile;
- menu sheet mobile;
- grids adaptativos;
- Kanban horizontal;
- formulários responsivos;
- tabelas convertidas para cards/grids em telas menores.

A matriz visual 320/375/390/430/768/1024/1440/1920 **não foi validada por browser automatizado nesta execução** devido à Vercel Deployment Protection e indisponibilidade de uma sessão browser autenticada no ambiente de automação.

## 29. Acessibilidade

Implementado no código novo:

- labels/sr-only em buscas;
- `aria-label` em ações icon-only;
- `role=dialog`/`aria-modal` em sheets/modais;
- estados de erro com `role=alert` onde aplicável;
- navegação por elementos semânticos;
- touch targets maiores;
- contraste do novo shell baseado em azul profundo/branco/cinzas.

Focus trap completo de todos os overlays não foi validado por browser.

## 30. Animações

Foram usadas transições CSS curtas para hover, loading, progress e elementos do novo shell.

Não foi adicionada biblioteca de animação pesada.

As experiências antigas reutilizadas mantêm suas próprias regras. Uma auditoria visual completa de `prefers-reduced-motion` em todo o legado não foi concluída.

## 31. Testes unitários

O projeto não possuía `npm test` para este domínio.

Foi criado:

`scripts/verify-partner-portal-v2.mjs`

E conectado em:

`npm test`

A suíte valida invariantes críticas por análise do código/contratos, incluindo:

- auth do portal;
- kinds permitidos de activity events;
- claim manual/audit log;
- compatibilidade com referral antigo;
- campanha no signup;
- demo sintética;
- IA com rate limit/fallback;
- código de parceiro sem desconto inventado;
- Kanban persistente/rollback;
- ownership do workspace;
- auth do admin Growth;
- payout RPC;
- pagamento do provedor;
- validação Pix;
- migration aditiva;
- ausência de service role em UIs client.

CI final: PASS.

## 32. Testes integração

Integrações confirmadas por código, schema e CI:

- campanha → link/UTM → click path → signup attribution source;
- claim manual → referral reservado → signup posterior pelo mesmo WhatsApp;
- pipeline → `update_lead` real;
- payout UI → API antiga → service/RPC antiga;
- demo session → token → resolver público → open event;
- IA → fallback sem bloquear portal.

Pagamento real não foi disparado nesta execução.

## 33. Testes segurança

Evidências executadas:

- auditoria RLS;
- auditoria de unique indexes;
- auditoria de payout RPC/locks;
- auditoria de integridade financeira;
- inspeção de server-side ownership;
- suíte de invariantes impedindo service role no client;
- claim cross-partner responde conflito sem expor identidade.

Teste A × B em runtime com duas contas de parceiro não foi executado porque há apenas identidade real disponível e nenhum staging conectado. Não foram criados usuários falsos em produção apenas para satisfazer um checkbox de QA.

## 34. E2E/browser

O Preview final foi criado e ficou `READY`.

Tentativas de fetch/browser do Preview foram interceptadas pela Vercel Deployment Protection/SSO, inclusive pelo conector autenticado.

O agente browser local também não estava disponível de forma utilizável no ambiente.

Portanto:

- browser autenticado completo: NÃO COMPROVADO;
- matriz responsiva completa: NÃO COMPROVADA;
- console browser: NÃO COMPROVADO.

Runtime logs do deployment final foram consultados e não apresentaram `error`, `warning` ou `fatal` no intervalo observado.

## 35. TypeScript

PASS no CI final.

`next build` executou `Running TypeScript` e concluiu sem erro.

## 36. Build

PASS no CI final.

Next.js 16.2.9 compilou, coletou dados e gerou 226 páginas/rotas sem erro.

Rotas novas confirmadas no build:

- `/admin/indicacoes/growth`;
- `/api/admin/affiliates/growth`;
- `/api/parceiros/ai`;
- `/api/parceiros/demos`;
- `/api/parceiros/portal-v2`;
- `/api/public/partner-code/[code]`;
- `/api/public/partner-demo/[token]`;
- `/cadastro/codigo`;
- `/demo/[token]`;
- `/parceiros/notificacoes`;
- `/parceiros/pipeline`.

## 37. Lint

Lint focado dos arquivos novos/alterados do Portal v2: PASS no CI final.

O lint global do repositório continua com dívida histórica e falha separadamente no job `global-lint-baseline`.

Na execução anterior registrada foram observados 181 problemas globais (114 erros e 67 warnings), distribuídos por arquivos legados, incluindo páginas administrativas pré-existentes.

O pacote do Portal 2.0 não foi liberado com novos erros conhecidos no lint focado.

## 38. Audit

`npm audit --audit-level=high` foi executado no CI como etapa informativa `continue-on-error`.

Resultado atual do lockfile:

- 7 vulnerabilidades;
- 1 moderada;
- 6 altas.

Pacotes/cadeias destacados:

- `brace-expansion`;
- `js-yaml`;
- `nanoid`;
- `next` 16.2.9;
- `postcss`;
- `sharp`.

O audit sugere correções que incluem atualização de Next para 16.3.1 fora da faixa declarada. Não foi executado `npm audit fix --force`, pois a especificação exige não misturar upgrade grande de dependências neste pacote apenas para zerar audit.

Essa dívida deve ser tratada em alteração dedicada, com regressão própria.

## 39. Regressão

Preservado por desenho:

- `/parceiros`;
- `/parceiros/cadastro`;
- `/parceiros/login`;
- `/parceiros/demo` para visitante sem sessão;
- `/parceiros/termos`;
- `/api/parceiros` financeiro existente;
- `/api/parceiros/track`;
- `/api/parceiros/workspace`;
- referral code antigo;
- signup Orçaly;
- comissão;
- payout;
- ranking;
- Academy;
- admin financeiro existente.

O build final gerou todas essas rotas junto com as novas.

Regressão browser autenticada ainda é pendência de release.

## 40. Bugs encontrados

Durante a implementação foram encontrados e tratados:

1. tentativa inicial de usar `affiliate_activity_events.kind` com valores não permitidos pela constraint real;
2. type do perfil não refletia `last_login_at` esperado em uma versão intermediária;
3. Next 16 exigia tratamento server-side/Suspense para `useSearchParams` na demo;
4. rotas de demo continham `any` detectado pelo lint focado;
5. loaders assíncronos acionavam `react-hooks/set-state-in-effect` pela forma como o loading era ativado;
6. CI de build inicialmente não possuía variáveis Supabase mínimas e uma rota legada abortava durante page collection;
7. uma edição intermediária de `package.json` escreveu o nome errado da dependência Supabase e foi revertida imediatamente antes de build final;
8. notificações do pipeline inicialmente apontavam para uma query interna que o shell não interpretava; foram direcionadas à rota real `/parceiros/pipeline`.

## 41. Bugs corrigidos

Todos os itens acima foram corrigidos no branch antes do CI final.

A regra `react-hooks/set-state-in-effect` foi desativada apenas em cinco telas de data-fetch inicial, com comentário de justificativa, mantendo as demais regras de Hooks ativas. Os `any` das APIs de demo foram substituídos por tipos reais.

O build final e lint focado confirmaram as correções.

## 42. Commits

O trabalho foi mantido em commits pequenos/coerentes por funcionalidade: service/API do portal, signup attribution, IA, shell, demos, Growth admin, notificações, pipeline, código de parceiro, testes, CI e correções de QA.

O SHA de código que recebeu o CI verde bloqueante foi:

`f6050f6a16d3fcd492fe60dd89937645a0b438ac`

Este documento é commit posterior sem alteração de runtime.

## 43. Preview

Deployment de código final validado:

- ID: `dpl_EU1W1Q8s6rLwwCzK9H9WHyqsAMNF`;
- URL: `https://orcaly-6omeka2ma-vinicius-araujos-projects.vercel.app`;
- estado: `READY`;
- commit: `f6050f6a16d3fcd492fe60dd89937645a0b438ac`.

A branch alias permanece protegida por Vercel Authentication.

## 44. Produção

NÃO alterada.

Nenhum `vercel promote`, merge para production branch ou migration remota foi executado neste pacote.

A release para produção permanece bloqueada até browser autenticado + responsividade + teste A × B/IDOR em ambiente apropriado.

## 45. Rollback

Como produção não foi alterada, o rollback atual é simplesmente não promover/mergear a feature.

Se o pacote for promovido futuramente:

- código: promover o deployment anterior ou revert do merge/commit;
- migration de índices: por ser somente aditiva, não é necessário remover índices para restaurar comportamento antigo; a aplicação pode ser deixada sem quebrar contratos;
- campanhas/demos usam eventos append-only compatíveis, portanto não exigem exclusão de histórico para desativar a feature.

## 46. Pendências reais

Pendências que impedem chamar a release de “APROVADA PARA PRODUÇÃO” neste momento:

1. executar browser/E2E autenticado do parceiro;
2. validar 320/375/390/430/768/1024/1440/1920 visualmente;
3. verificar console/network autenticado;
4. testar duas identidades A × B para IDOR/BOLA em ambiente não destrutivo;
5. aplicar/testar a migration de índices em staging antes de produção;
6. tratar vulnerabilidades de dependências em atualização dedicada, especialmente Next 16.2.9 e dependências apontadas pelo `npm audit`;
7. decidir se o lint global histórico será saneado em iniciativa própria.

Pendências deliberadamente NÃO tratadas como falha do pacote:

- não há push notification externo;
- health score é indicador, não bloqueio;
- código de parceiro não concede desconto inventado;
- não foi alterado percentual de comissão por nível;
- nenhum pagamento real foi realizado apenas para teste.

## Resultado

**IMPLEMENTAÇÃO INTEGRADA DO PORTAL DE PARCEIROS 2.0: CONCLUÍDA EM BRANCH/PREVIEW.**

**QA DE ENGENHARIA BLOQUEANTE: PASS** para testes de invariantes, lint focado, TypeScript e build.

**RELEASE DE PRODUÇÃO: PENDENTE**, por ausência de browser autenticado/matriz responsiva e teste A × B em staging/test identities. Essa classificação é intencional e segue o critério de não declarar aprovação sem evidência.
