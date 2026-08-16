# Orçaly — Fase 2: Portal do Cliente

Data da auditoria e implementação local: 16/08/2026.

Status: fundação read-only implementada e validada localmente, porém mantida desligada. A Fase 2 ainda não deve ser considerada concluída em produção até aplicar as migrations em preview, executar os testes reais de duas empresas e resolver a estratégia de arquivos.

## Auditoria específica da Fase 2A

O relatório da Fase 1 foi relido integralmente em `docs/fase-1-infraestrutura-segura.md`. O relatório da Fase 0 não está presente no repositório nem no anexo recebido; por isso, a arquitetura relevante foi reauditada diretamente no código, nas migrations, nas APIs e no schema remoto acessível em modo somente leitura.

Na verificação remota de 16/08/2026 foram observados: 10 empresas, 2 associações em `company_members`, 25 pedidos, 32 itens, 2 históricos de status, 3 propostas, 1 magic link legado, 1 evento de portal legado, 17 pagamentos de pedido, 1 entrega e 4 atribuições de entrega. As tabelas da fundação local da Fase 1 (`feature_flags`, `company_feature_flags` e `operational_events`) ainda não existem no banco remoto verificado. Portanto, a migration da Fase 1 é pré-requisito da migration da Fase 2.

| Área | Estrutura encontrada | Decisão |
| --- | --- | --- |
| Empresas e acesso interno | `companies`, `company_members`, `getRequester()`, `getCompanyAccess()` | Reutilizar para tenant, autenticação e autorização do painel. |
| Clientes | Não há tabela canônica `customers`; identidade está desnormalizada em pedidos e links legados | Não criar modelo paralelo nesta subfase; o acesso fica vinculado a empresa + entidade. |
| Pedidos | `orders`, `order_items`, `order_status_history` | Reutilizar pedido e itens. Não usar `order_status_history` na timeline pública porque não possui visibilidade. |
| Orçamentos | `proposals`; não há domínio canônico `quotes` maduro | Não implementar aprovação nesta entrega. |
| Pagamentos | `order_payments` e integrações existentes | Não consultar nem alterar Mercado Pago; pagamentos ficaram fora do DTO. |
| Entregas | `deliveries`, `delivery_assignments` | Expor somente tipo, status e previsão; nunca endereço, telefone ou entregador. |
| Timeline | `operational_events` da migration da Fase 1 | Aceitar exclusivamente `visibility = customer_visible`, com tipos públicos allowlisted. |
| Arquivos | Buckets públicos `site-assets`, `produtos`, `product-images`, `logos` e `artes`; bucket privado `financeiro` | Não expor arquivos nesta etapa. O bucket público `artes` precisa de decisão/migração antes de signed URLs terem valor de segurança. |
| Feature flags | Fundação da Fase 1 com `customer_portal`, default global desligado e override por empresa | Reutilizar com comportamento fail-closed. |
| Segurança transversal | Rate limiter em banco, auditoria, CSP e proxy existentes | Reutilizar sem criar subsistemas paralelos. |

APIs legadas relacionadas e preservadas: `/api/cliente/[token]`, `/api/pedido/[token]`, `/api/propostas/[token]`, `/api/orders/[id]` e `/api/orders/[id]/timeline`. Os portais legados usam token puro ou escopo mais amplo do que o novo modelo; não foram reutilizados nem modificados para evitar regressão silenciosa. Eles permanecem um risco a tratar separadamente.

Arquitetura escolhida:

```text
painel autenticado
  -> POST /api/orders/{id}/portal-access
  -> RPC transacional gera/rotaciona acesso
  -> token puro retornado uma única vez

cliente
  -> /acompanhar#TOKEN (fragmento não enviado ao servidor)
  -> POST /api/customer-portal/resolve (token no corpo)
  -> hash no servidor
  -> acesso + flag + tenant + entidade
  -> consultas allowlist
  -> DTO sanitizado
```

Ordem segura de rollout:

1. aplicar a migration da Fase 1 em ambiente de preview;
2. aplicar a migration da Fase 2 em preview;
3. executar advisors, inspeção de grants/RLS e testes reais Empresa A × Empresa B;
4. habilitar `customer_portal` somente para uma empresa piloto;
5. gerar link para pedido fictício e validar token, revogação, expiração, cache e timeline;
6. só então criar o botão de gestão no painel;
7. manter arquivos, aprovação, comentários e pagamentos bloqueados até auditorias próprias.

## 1. O QUE FOI IMPLEMENTADO

- Rota mobile-first `/acompanhar#TOKEN` para acompanhamento read-only de pedido sem token no access log do HTML.
- Resolver público `POST /api/customer-portal/resolve`, sem token no caminho da API e sem acesso direto do browser ao Supabase.
- API interna autenticada para gerar/rotacionar e revogar acesso de um pedido.
- DTO versionado e allowlisted com empresa, status, datas, itens, valores autorizados, timeline pública e resumo seguro da entrega.
- Estados de carregamento, indisponibilidade, timeline vazia, itens vazios, valores ausentes e entrega ausente.
- Branding com nome, logo HTTPS validado, cores seguras e “Powered by Orçaly”.
- Headers privados, `noindex`, `no-referrer` e renderização dinâmica.

Nenhum fluxo de cobrança, Mercado Pago, Auth, aprovação, comentário, upload ou status de pedido foi alterado.

## 2. O QUE FOI REUTILIZADO

- `companies`, `company_members`, `orders`, `order_items`, `deliveries`.
- `feature_flags`, `company_feature_flags` e `operational_events` da fundação da Fase 1.
- `getRequester()`, `getCompanyAccess()`, permissões aditivas, rate limiter e auditoria existentes.
- Configuração central de segmentos e status para os rótulos “Em produção”, “Em preparo”, “Em reparo”, “Separando” e equivalentes.
- Proxy/CSP e o padrão atual de Server Route Handlers do Next.js 16.

## 3. NOVAS ESTRUTURAS

`customer_portal_access` é a única nova tabela proposta. Ela contém empresa, tipo e ID da entidade, hash do token, estado, expiração, revogação, atividade controlada e auditoria de criação/revogação. Não contém token puro nem cria dependência de uma tabela `customers` inexistente.

Novos módulos separados por responsabilidade:

- `contracts.ts`: contrato do DTO e fontes internas;
- `tokens.ts`: geração, hash e validação;
- `dto.ts`: sanitização, rótulos e timeline pública;
- `access.server.ts`: resolução server-side e consultas tenant-scoped;
- componentes de página e visualização do pedido.

## 4. ARQUIVOS ALTERADOS

Arquivos criados:

- `app/acompanhar/layout.tsx`
- `app/acompanhar/page.tsx`
- `app/api/customer-portal/resolve/route.ts`
- `app/api/orders/[id]/portal-access/route.ts`
- `components/customer-portal/CustomerPortalPageClient.tsx`
- `components/customer-portal/PortalOrderView.tsx`
- `lib/customer-portal/access.server.ts`
- `lib/customer-portal/contracts.ts`
- `lib/customer-portal/dto.ts`
- `lib/customer-portal/tokens.ts`
- `tests/customer-portal/customer-portal.test.ts`
- `tests/customer-portal/migration-contract.test.ts`
- `tests/customer-portal/route-contract.test.ts`
- `tests/customer-portal/tsconfig.json`
- `supabase/migrations/20260816162948_customer_portal_read_only_v1.sql`
- este relatório.

Arquivos existentes alterados:

- `next.config.ts`: origem restrita para logos públicos do Supabase.
- `proxy.ts`: headers privados e anti-indexação do Portal.
- `package.json`: suíte `test:customer-portal` integrada a `npm test`.

## 5. MIGRATIONS

Foi criada, mas não aplicada, `20260816162948_customer_portal_read_only_v1.sql`. Ela é aditiva e falha explicitamente se a fundação da Fase 1 não existir.

A migration cria:

- tabela `customer_portal_access`;
- índices de lookup, tenant e entidade;
- unicidade de hash e de acesso ativo por entidade;
- trigger de `updated_at` reutilizado da Fase 1;
- RPC `orcaly_rotate_customer_portal_access()` para rotação atômica;
- RPC `orcaly_record_customer_portal_access()` para atividade limitada a uma atualização a cada 15 minutos.

Nenhuma migration foi enviada ao banco remoto. `supabase db lint --local` não pôde executar porque não existe Postgres local em `127.0.0.1:54322` e Docker não está instalado; o SQL foi coberto por testes contratuais estáticos.

## 6. TOKEN E SEGURANÇA

- Token gerado no servidor com 32 bytes criptograficamente aleatórios e codificação base64url.
- Persistência exclusiva de SHA-256 com separação de domínio `orcaly-customer-portal:v1`.
- Token puro retornado apenas na resposta de geração do link; nunca salvo em tabela, evento, auditoria ou log.
- Expiração padrão de 30 dias, estado ativo/revogado, revogação e regeneração.
- Rotação revoga o acesso ativo anterior na mesma transação.
- Erro público genérico para token inválido, expirado, revogado, flag desligada ou entidade ausente.
- Rate limit fail-closed de 30 tentativas por IP a cada 5 minutos.
- Corpo JSON limitado a 4 KiB; token validado antes do hash/consulta.
- Resposta personalizada com `private, no-store, no-cache`, `noindex` e `no-referrer`.

O token aparece somente no fragmento (`#TOKEN`) do link compartilhável. Fragmentos não são enviados no request HTTP da página e, portanto, não entram no access log do servidor ou do proxy. O browser lê o fragmento e envia o token exclusivamente no corpo POST privado do resolver.

## 7. RLS

`customer_portal_access` tem RLS habilitada, policy explícita de negação para `anon` e `authenticated`, revogação de privilégios de `public`, `anon` e `authenticated`, e grants mínimos somente para `service_role`. O browser nunca lê a tabela diretamente.

As funções de rotação e atividade também revogam execução pública e concedem execução somente a `service_role`. A aplicação continua responsável pela autorização server-side e não trata UUID como autorização.

## 8. MULTITENANCY

- O acesso é vinculado a `company_id + entity_type + entity_id`.
- A RPC confirma que o pedido pertence à empresa antes de inserir o acesso.
- Todas as consultas de pedido, itens, eventos e entrega repetem o filtro de empresa e entidade.
- O construtor do DTO recusa inconsistência entre acesso, empresa e pedido.
- A API de gestão deriva a empresa da sessão e nunca aceita `company_id` do browser.

Testes unitários/contratuais cobrem IDOR e isolamento lógico. O teste de integração real com duas empresas ainda é gate obrigatório antes do piloto.

## 9. TIMELINE

A timeline pública usa exclusivamente `operational_events` com filtro server-side `visibility = customer_visible`. `order_status_history` foi deliberadamente excluída porque não possui marcador de visibilidade.

Mesmo entre eventos públicos, apenas tipos conhecidos são convertidos em texto. Metadata crua, ator, IDs, observações internas e tipos desconhecidos não são devolvidos. Se não houver evento público, a interface mostra o empty state.

## 10. ARQUIVOS/STORAGE

Arquivos não foram implementados. A auditoria encontrou `artes` público, além de outros buckets públicos; emitir signed URL para objeto já público não cria proteção real. O próximo passo seguro exige bucket privado ou cópia/migração controlada, vínculo `company_id + entity_id + access` e endpoint que escolha o path no servidor.

O logo empresarial é o único recurso externo aceito nesta versão: HTTPS, host `*.supabase.co`, caminho público do Storage e SVG remoto bloqueado.

## 11. AÇÕES DO CLIENTE

Nenhuma. O Portal é estritamente read-only.

Foi criada somente a gestão interna mínima de acesso por usuário autorizado: gerar/regenerar e revogar. Aprovação de orçamento, recusa, alteração de arte, comentários, upload, pagamento e mudança de status ficaram fora do escopo entregue.

## 12. FEATURE FLAG

A flag `customer_portal` da Fase 1 é verificada na geração, revogação e resolução. Ela permanece globalmente desligada e aceita override por empresa. Falha de leitura da flag resulta em Portal desligado.

Com a flag OFF, as rotas existentes, pedidos, site e painel mantêm o comportamento anterior; nenhum pedido antigo recebe acesso automaticamente.

## 13. TESTES REALIZADOS

- `npm test`: 29/29 testes passaram (13 da fundação + 16 do Portal).
- Token: formato, 32 bytes, unicidade amostral, hash determinístico e separado por domínio.
- Acesso: expiração, revogação e tipo de entidade.
- DTO: allowlist, ausência de dados proibidos, isolamento, labels por segmento e números inválidos sem `NaN`.
- Timeline: evento interno oculto e somente `customer_visible` aceito.
- Migration: dependência da Fase 1, hash, RLS, grants, rotação e atividade throttled.
- Rotas: POST-only, rate limit, cache privado, `noindex`, gestão autenticada e tenant-scoped.
- `npx tsc --noEmit`: passou.
- ESLint restrito a todos os arquivos da Fase 2, `proxy.ts` e `next.config.ts`: passou sem achados.
- `npm run security:check`: passou.
- `npm run verify:payments`: passou, confirmando que os limites do fluxo de pagamento permaneceram intactos.
- Navegador: estado inválido genérico sem `500`, Portal completo com DTO fictício sanitizado, console sem erros e árvore acessível coerente.
- Transporte do token: o browser abriu `/acompanhar#TOKEN` e o access log registrou somente `GET /acompanhar`, sem o fragmento.
- Viewports 320, 360, 375, 390, 414 e 1440 px: largura do documento igual ao viewport em todos os casos, sem overflow horizontal.

O lint global continua com 537 problemas preexistentes (394 erros e 143 avisos), concentrados em código legado e backups. Nenhum pertence aos arquivos da Fase 2. Por isso, o gate global de lint do repositório ainda não pode ser declarado verde.

## 14. BUILD

`npm run build` passou com Next.js 16.2.9/Turbopack, TypeScript e geração de 213 páginas. As rotas `/acompanhar`, `/api/customer-portal/resolve` e `/api/orders/[id]/portal-access` foram classificadas como dinâmicas.

## 15. REGRESSÃO

Smoke test local sem credenciais:

- `/`, `/login`, `/cadastro`, `/site/grafica-flash` e `/orcamento`: `200` sem erro de browser;
- `/painel`, `/painel/pedidos` e `/painel/clientes`: redirecionamento para login preservado;
- `/admin`: redirecionamento para o login de parceiros preservado;
- site público e tela de login: renderização e árvore acessível verificadas;
- nenhum `500` inesperado;
- segurança e contratos de pagamentos passaram.

Não foi executada regressão autenticada de operações internas por ausência de credenciais piloto nesta sessão.

## 16. RISCOS REMANESCENTES

1. As migrations das Fases 1 e 2 ainda não foram aplicadas remotamente.
2. Faltam testes integrados com token real e duas empresas em preview, incluindo concorrência e revogação durante acesso.
3. O relatório original da Fase 0 não foi encontrado.
4. Os portais legados `/cliente/[token]` e `/pedido/[token]` permanecem com modelos de token/escopo anteriores; precisam de plano de migração sem quebra.
5. O bucket `artes` é público e impede uma entrega segura de arquivos nesta subfase.
6. Não existe tabela canônica de clientes nem número público canônico de pedido. O DTO não expõe fragmento do UUID e usa `publicOrderNumber: null` até existir identificador comercial seguro.
7. A gestão de link existe apenas como API; ainda não há botão no painel.
8. O lint global legado não está verde.
9. Não houve `supabase db lint` local nem advisors pós-migration por falta do runtime local e por a migration não ter sido aplicada.

## 17. ROLLBACK

O rollback primário é desligar `customer_portal` globalmente ou remover o override da empresa piloto. Isso bloqueia geração e resolução sem tocar em pedidos existentes.

Código e schema são aditivos. Em incidente, pode-se reverter as rotas/componentes mantendo a tabela inerte para auditoria. Não é recomendado apagar a tabela durante rollback operacional. Os fluxos legados não foram substituídos, e abrir o Portal nunca altera status do pedido.

## 18. PREPARAÇÃO PARA FASE 3

A fundação deixa prontos para evolução futura:

- acesso genérico por `entity_type` sem abrir autorização genérica hoje;
- DTO versionado, adequado para novos campos públicos compatíveis;
- rótulos por segmento usando configuração central;
- eventos estruturados e visibilidade explícita;
- feature flag por empresa e piloto;
- isolamento entre analytics, atividade de acesso e timeline operacional.

Para receber o fluxo avançado de gráfica e personalizados, a próxima fase poderá publicar eventos como produção iniciada, arte preparada/aprovada e entrega concluída sem reescrever o Portal. Nenhuma funcionalidade da Fase 3 foi iniciada.
