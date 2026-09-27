# Orçaly — Análise de Consolidação de Componentes

Base: `codex/orcaly-ecosystem@9d8c0a7`. Nada abaixo foi alterado nesta branch; é o plano para quando cada área for migrada.

Regra: **merge** = substituir pela primitive da Foundation; **preserve** = manter implementação local (comportamento de domínio legítimo) e só adotar tokens.

| # | Candidato | Arquivos existentes | Comportamento duplicado / divergente | Primitive recomendada | Risco | Decisão |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Status badge | `components/panel-ui/index.tsx` (`StatusBadge`, `PanelBadge`), `components/food/food-shared.tsx`, `components/subscription/SubscriptionManager.tsx`, `app/painel/produtos/page.tsx`, `components/food/DeliveriesManager.tsx`, `components/painel/MarketplacePaymentsPanel.tsx`, `components/painel/PanelSegmentSidebar.tsx`, `components/admin/OwnerBackofficeClient.tsx`, `app/admin/indicacoes/page.tsx` | 9 versões. Mapeamentos status→cor feitos por string em cada arquivo; tons diferentes (`blue/green/red/slate/amber` vs booleano ativo/inativo). | `StatusPill` com `tone: 'neutral'|'info'|'success'|'warning'|'danger'|'accent'` e texto obrigatório (cor nunca é o único sinal). Já implementada em `components/orcaly-next/foundation/StatusPill.tsx`. | Baixo | Merge (mapeamento de domínio fica no chamador) |
| C2 | Empty state | `components/panel-ui` (`PanelEmptyState`), `food/food-shared` (`EmptyState`), `payments/AsaasFinancialPanel`, `financeiro/FinancialAreaClient`, `parceiros/PartnerPortalV2` (`Empty`), `app/cliente/[token]/page.tsx`, `app/painel/clientes-360/[id]/page.tsx`, `painel/MarketplacePaymentsPanel` (`MarketplaceEmptyState`) | 8 versões; algumas com ação, outras só texto; nenhuma distingue "sem dados" de "sem permissão" de "provider não configurado". | `StateBlock kind="empty"|"error"|"not-configured"|"blocked-external"|"forbidden"` (Foundation §12). Implementada como `StateBlock`. | Baixo | Merge |
| C3 | Loading/skeleton | `panel-ui` (`PanelSkeleton`, `MetricCardSkeleton`, `TableSkeleton`, `FormSkeleton`), `app/painel/loading.tsx` (`PainelLoading`), `app/painel/assinatura/loading.tsx`, 12× `app/apps/wealth/*/loading.tsx`, `OrdersSkeleton` | Wealth usa texto com `role=status`; Business usa skeletons; 1 arquivo Wealth sem `role=status`. | `LoadingState` (texto + skeleton opcional, sempre `role="status"`). | Baixo | Merge (texto de domínio preservado como prop) |
| C4 | Modal / drawer | `panel-ui` (`PanelModal`, `PanelDrawer`), `catalog/ProductOptionsModal`, `catalog/CommercialOfferModal`, `painel/FounderWelcomeModal`, `public-site/SegmentMarketplaceCatalog`, `public-site/PremiumCatalog`, `admin/LeadDetailDrawer`, `admin/LeadCreateDrawer` | 16 arquivos com `role="dialog"` + `aria-modal`; nenhum usa `<dialog>` nativo; foco/escape implementados à mão em cada um (não auditado 1 a 1). | `Dialog` sobre `<dialog>` nativo (`showModal()` dá focus trap, `Esc` e inert do fundo gratuitamente). Contrato na Foundation §9. | Médio (modais de checkout/pagamento) | Merge fora de checkout; **preserve** checkout/pagamento até QA dedicado |
| C5 | Confirmação destrutiva | 25 arquivos com `alert()`/`confirm()` nativos | Sem tema, sem texto de consequência, sem distinção destrutivo/financeiro. | `ConfirmDialog` (Foundation §9.3) | Médio | Merge gradual por área |
| C6 | Tabela | `panel-ui` (`PanelTable` = só `div`), `admin/AdminTable`, `SalesTable`, `ProductTable`, 21 arquivos com `<table>` | Só 7 com `caption`, 4 com `scope`. Em mobile, alguns trocam para cards (`PanelMobileCard`), outros fazem scroll horizontal. | `DataTable` (caption obrigatória, `scope`, modo `stack` ≤ 767px). Contrato Foundation §8. | Médio | Merge para tabelas de leitura; preserve tabelas editáveis |
| C7 | Page header | `panel-ui` (`PanelPageHeader`), `PanelPremiumHeader`, eyebrow+h1+lead repetidos em cada página Wealth | Wealth monta cabeçalho manualmente em 24 páginas. | `PageHeader` (eyebrow, title, lead, actions, breadcrumb). | Baixo | Merge |
| C8 | Sidebar / nav de produto | `PanelSidebar` (ativo), `PanelSegmentSidebar` (**0 importadores**), `AdminShellV2`, layouts de `/parceiros` | `planLabel()` duplicado com mapeamento **divergente** (`basico` → "Essencial" vs "Básico"). `isActivePath`/`activeFor` idênticos copiados. | `ProductNav` alimentado pelo registry; utilitário único `isActivePath`. | Alto (nav principal do Business) | Merge por último; **remover `PanelSegmentSidebar` em PR de limpeza coordenado** |
| C9 | Busca | `PanelGlobalSearch` (216 linhas, Business), busca admin (`/api/admin/search`) | Busca por empresa; não cruza produtos (correto, por consent). | `CommandPalette` para navegação/ações; buscas de dados continuam por produto. | Baixo | Preserve buscas de dados; palette só navega |
| C10 | Product card | `components/ecosystem/ProductCard.tsx` | Deriva CTA de props montadas à mão no Hub. | `LauncherTile` + `HubProductCard` consumindo `HubProductSnapshot`. | Baixo | Merge quando Hub 2 for integrado |
| C11 | Toast | `panel-ui` (`PanelToast`), mensagens `role="status"` inline (74 arquivos) | Sem fila, sem duração padrão. | `Toast` + regras Foundation §11. | Baixo | Merge |
| C12 | Botões | `panel-ui` (`PanelButton`), `.primaryButton`/`.textButton` (ecosystem), `premium.css`, Tailwind inline | Alturas 44–50px ok; estilos divergentes. | `Button` (`primary|secondary|quiet|danger`), altura mínima 44px. | Baixo | Merge |

## Utilitários duplicados (lib)

| Função | Onde | Ação |
| --- | --- | --- |
| `planLabel` | `PanelSidebar.tsx`, `PanelSegmentSidebar.tsx` | Unificar em um módulo de planos; resolver divergência com o dono do Business antes (é rótulo comercial). |
| `isActivePath` / `activeFor` | `PanelSidebar.tsx`, `PanelSegmentSidebar.tsx` | Extrair para `lib/orcaly-next/navigation.ts` (implementado isolado como `isActiveHref`). |
| Status de produto → rótulo | `lib/ecosystem/products.ts` (`productStatusLabels`), `app/produtos/[slug]` | Substituir por `hubStatusCopy` do registry novo quando integrado. |

## Ordem sugerida

C1 → C2 → C3 → C12 → C7 (baixo risco, alto ganho visual) → C11 → C6 → C4/C5 → C10 → C8 (último, mais arriscado).
