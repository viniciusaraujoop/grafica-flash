# Academy — Entitlement & Permission Contract

Nada foi alterado em `lib/ecosystem/**`, entitlements, auth ou billing. Este é o contrato para quem integrar.

## Produto
- Entitlement: **`product.academy`** (registry: `lib/orcaly-next/product-registry.ts`, `release: IN_DEVELOPMENT`, `app: NOT_BUILT`, `scopes: ['personal']`).
- Scope: **`personal`** — o dono dos dados é o usuário. Não há dado Academy compartilhado por empresa no MVP.

## Permissões
| Permissão | Concede | Padrão para usuário com `product.academy` |
| --- | --- | --- |
| `academy.read` | listar/abrir/buscar catálogo publicado | sim |
| `academy.progress` | inscrição, progresso, conclusão, sessões | sim |
| `academy.notes` | criar/editar/excluir as próprias notas | sim |
| `academy.bookmarks` | favoritos próprios | sim |
| `academy.manage_content` *(futuro)* | catálogo, licenças, publicação | **não** — só papel editorial/admin Orçaly |

`academy.manage_content` **não** dá leitura de notas, progresso ou favoritos de ninguém.

## Estados de acesso (UI)
| Situação | Comportamento |
| --- | --- |
| Sem sessão | redirecionar para login preservando deep link (atenção ao achado A21 da Foundation: `requireEcosystemIdentity` perde o destino — corrigir antes de publicar rotas) |
| Sem `product.academy` | landing/estado "Conhecer o Academy" (Hub decide via `resolveProductDestination`); nenhuma rota interna exposta na Command Palette |
| Com entitlement, sem permissão específica | seção correspondente em `StateBlock kind="forbidden"` |
| Entitlement expira com dados existentes | dados pessoais preservados (retenção conforme persistence contract), leitura bloqueada até reativar; exportação a definir (**bloqueio de produto**) |

## Cross-product: DENY BY DEFAULT
- Business, Growth, Wealth, Market: **nenhum** acesso a notas, progresso, favoritos ou sessões do Academy.
- Academy não lê dados de outros produtos.
- Intelligence: só com consentimento explícito e revogável (ver `ACADEMY_INTELLIGENCE_BOUNDARY.md`).
- A tela `/apps/privacidade` (existente) é o lugar futuro para esse consentimento; nada foi alterado nela.
