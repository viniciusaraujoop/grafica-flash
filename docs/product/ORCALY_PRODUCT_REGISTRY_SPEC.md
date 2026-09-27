# Orçaly Product Registry — especificação

Implementação isolada: `lib/orcaly-next/product-registry.ts` + `product-status.ts`. **Não conectada ao runtime.** A fonte viva continua `lib/ecosystem/products.ts`; um teste de paridade impede divergência (ids, ordem, nome, release, entitlement, cores, theme color, installability, permissões, feature flags, scope).

## 1. Por que um registry novo em vez de editar o existente
`lib/ecosystem/products.ts` é consumido por Hub, landings, Wealth layout e `evaluateProductAccess` — editar seria tocar runtime certificado. O novo registry é o **sucessor proposto**: pure TypeScript, sem I/O, testável, com vocabulário que o atual não tem (8 estados do Hub, `RouteStatus`, navegação por grupos, IA, billing, dependências externas). Adoção = trocar imports atrás de flag (Migration Plan etapa 3).

## 2. Schema (`ProductRegistryEntry`)

| Campo | Tipo | Regra (validada por `validateRegistry`) |
| --- | --- | --- |
| `id` / `slug` | `RegistryProductId` | únicos; kebab-case |
| `kind` | `'app' \| 'bundle'` | só One é bundle |
| `name` / `shortName` / `description` | string | obrigatórios; `name` começa com "Orçaly " |
| `logo` | `{ src, assetStatus }` | `AVAILABLE` exige `src`; `ASSET_MISSING` usa wordmark em texto (nunca logo gerado) |
| `skin` | `SkinKey` | contrato em `skins.ts` |
| `release` | `LIVE \| EARLY_ACCESS \| IN_DEVELOPMENT` | = `available/preview/planned` do registry vivo |
| `landing` | `RouteRef` | sempre `LIVE` e interna |
| `app` | `RouteRef \| null` | bundle = `null`; `NOT_BUILT` só com `IN_DEVELOPMENT` |
| `canonicalAppPath` | string \| null | destino na IA `/apps/<produto>` |
| `navigation` | `registry \| legacy-adapter \| none` | ids `<produto>.*` únicos; produto não lançado não expõe navegação |
| `scopes` | `personal \| company \| household`[] | app ≥ 1; bundle 0 |
| `householdSharing` | `NONE \| EXPLICIT_CONSENT_ONLY` | explícito exige `personal` |
| `entitlement` | `{ key, permissionPrefix, sources }` | `key = product.<id>`, prefixo `<id>.`, fontes do vocabulário canônico; bundle não se auto-concede |
| `billing` | `{ status: LEGACY \| NOT_CONFIGURED, billingProductKey, trial }` | nenhum preço no registry |
| `oneInclusion` | `IS_BUNDLE \| UNDECIDED` | só o bundle é `IS_BUNDLE`; inclusão real não decidida |
| `pwa` | `{ installable: false, reason, scope, themeColor }` | theme color `#rrggbb`; instalação independente bloqueada até ícones próprios |
| `ai` | `{ provider, enabledModes, dataDomains, crossProductContext }` | `crossProductContext = DENY_BY_DEFAULT`; `regulated_advice`/`execution` proibidos |
| `notifications` | `{ namespace: orcaly.<id>, supported: false }` | — |
| `featureFlags` | string[] | inclui a flag viva quando existir |
| `externalDependencies` | `{ id, label, required, status }`[] | status `CONFIGURED \| NOT_CONFIGURED \| BLOCKED_EXTERNAL \| FROZEN \| NOT_VERIFIED` |

TypeScript completo: ver o arquivo (tipos exportados).

## 3. Estados — separação release × conta
```
ReleaseStatus (produto)  ×  AccountSignal (conta)  ×  externalBlocked
            └──────────── deriveHubStatus() ───────────┘
                                 │
ACTIVE · TRIAL · AVAILABLE · NOT_SUBSCRIBED · PAYMENT_PENDING · SUSPENDED · COMING_SOON · BLOCKED_EXTERNAL
```
Precedência: IN_DEVELOPMENT → COMING_SOON; SUSPENDED; PAYMENT_PENDING; externalBlocked → BLOCKED_EXTERNAL; TRIAL; ENTITLED → ACTIVE; EARLY_ACCESS sem direito → COMING_SOON (convite); LAPSED → NOT_SUBSCRIBED; NONE → AVAILABLE. Teste prova que a função é total e que os 8 estados são alcançáveis.

`AccountSignal` **vem do servidor** (effective entitlements = união das fontes válidas). O registry não autoriza nada.

## 4. Destinos (`resolveProductDestination`)
| Status | Destino |
| --- | --- |
| ACTIVE, TRIAL | app (se rota `LIVE`), senão landing |
| BLOCKED_EXTERNAL | app se `LIVE` (o app explica o bloqueio), senão landing |
| demais | landing pública |

## 5. Consumidores previstos
Hub (`hub-model.ts`), Launcher, Command Palette (`command-index.ts`), Landings (`landing-content.ts`), PWA manifest por produto, namespace de notificações, contexto de IA, página de billing. Nenhum ligado ainda.

## 6. Não faz (por design)
Não lê banco, não calcula preço, não decide consentimento, não registra rotas no Next, não substitui `evaluateProductAccess`.

## 7. Testes (`node --test scripts/test-orcaly-next-registry.mjs` — 17 PASS)
IDs/slugs únicos · validador rejeita 15 mutações inválidas + duplicações · paridade com registry vivo · toda rota `LIVE` existe em `app/**/page.tsx` (inclusive `[slug]` + `generateStaticParams`) · toda `NOT_BUILT` não existe · One nunca operacional · scopes/fontes canônicos · 8 estados alcançáveis e precedência · destinos · palette não vaza rotas de produto não liberado · ranking determinístico · contraste AA · conteúdo de landing sem métricas/preços/depoimentos e com evidência de arquivo · dados demo rotulados · Hub sections · navegação ativa.

**Não adicionado a `npm test`** porque `package.json` está fora do escopo desta branch. Integração: acrescentar `node --test scripts/test-orcaly-next-registry.mjs` a `test:ecosystem` na etapa 3.
