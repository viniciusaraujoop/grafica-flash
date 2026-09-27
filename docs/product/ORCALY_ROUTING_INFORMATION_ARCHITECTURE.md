# Orçaly — Routing & Information Architecture

## 1. Estado atual [REAL]
| Produto | Público | Autenticado |
| --- | --- | --- |
| Master | `/`, `/produtos/[slug]`, `/solucoes/[slug]` | `/apps` (Hub), `/apps/privacidade` |
| Business | `/business` | `/painel/**` (~110 páginas) |
| Wealth | `/produtos/wealth` | `/apps/wealth/**` (24 páginas) |
| Partners | `/parceiros`, `/parceiros/cadastro`, `/parceiros/termos` | `/parceiros/painel`, `/pipeline`, `/notificacoes`, `/demo` |
| Growth/Flow/Academy/Market/One | `/produtos/<slug>` | — (não construídos) |
| Tenant público | `/site/[slug]`, `/loja/[slug]`, `/pedido/[token]`, `/proposta/[token]`, `/cliente/[token]`, `/checkout/**` | — |
| Admin plataforma | — | `/admin/**` |

## 2. Alvo
```
PUBLIC            /<produto>            landing (hoje /produtos/<produto>; /business para Business)
AUTHENTICATED     /apps/<produto>/**    app
HUB               /apps
LOGIN             /login?next=<path seguro>   (lib/auth-navigation.ts#safeNextPath)
```
Decisão desta frente: **manter `/produtos/<slug>` como landing canônica** até o SEO do master ser revisto; `/<produto>` na raiz conflita com rotas de tenant e com `/business` existente. Business e Partners mantêm `/painel` e `/parceiros` até a etapa 10 do Migration Plan (redirects 308 `/painel/*` → `/apps/business/*` só depois de paridade completa).

## 3. Regras de roteamento de acesso

Ordem de avaliação (servidor, em layout do produto):

| # | Situação | Resposta |
| --- | --- | --- |
| 1 | Não autenticado em rota `/apps/**` | redirect `/login?next=<path atual>`. **Hoje** `requireEcosystemIdentity` redireciona sempre para `next=%2Fapps` (e MFA para `/mfa?next=%2Fapps`) — o deep link se perde (Audit A21). |
| 2 | Produto `IN_DEVELOPMENT` | redirect para landing (COMING_SOON) |
| 3 | Contexto errado (ex.: Wealth em contexto company) | página de troca de contexto; nunca mistura dados |
| 4 | `SUSPENDED` | tela do produto em modo leitura mínima + explicação; nunca apaga/oculta existência de dados |
| 5 | `PAYMENT_PENDING` | acesso mantido pelo período de carência definido pelo Billing (não definido — `NOT_CONFIGURED`), com banner |
| 6 | `NOT_SUBSCRIBED` / `AVAILABLE` (sem direito) | redirect para landing com `?from=app` → CTA contextual |
| 7 | `TRIAL` | acesso completo + banner de teste |
| 8 | `BLOCKED_EXTERNAL` | app abre; módulos dependentes mostram StateBlock `blocked-external` |
| 9 | Sem permissão para o módulo | StateBlock `forbidden` dentro do app (não redirect) |
| 10 | Rota inexistente | `not-found` do produto (com navegação do produto), não o 404 global |

**Deep links:** alvo — um link profundo (`/apps/wealth/metas/<id>`) atravessa login e MFA preservando `next` validado por `safeNextPath` (requer passar o path a `requireEcosystemIdentity`; runtime de auth fora desta frente); se o usuário perder direito, cai na regra 6 mas o `next` é mantido para após reassinar. IDs de registro de outro usuário: responder 404 (não 403) para não revelar existência — com RLS a consulta já retorna vazio; confirmar por rota na integração.

**Landing fallback:** qualquer destino não abrível resolve para `product.landing.path` (`resolveProductDestination`).

## 4. Navegação dentro do app
Declarada no registry (`navigation.source = 'registry'`). Wealth: 6 grupos / 18 rotas (todas verificadas por teste). Business: `legacy-adapter` até migrar `lib/panel-modules.ts`. Estado ativo: `mostSpecificActive`.

## 5. Anti-regras
- Nenhuma rota de produto dentro de `/painel` para produtos que não são Business.
- Nenhum link para rota `NOT_BUILT` fora de contexto COMING_SOON (teste).
- `next` nunca aceita host externo (`safeNextPath` [REAL]).
