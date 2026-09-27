# Orçaly UX Foundation V1

Implementação de referência (isolada, não conectada ao runtime):
- tokens: `components/orcaly-next/foundation/foundation.module.css` (escopados em `.root`, nunca em `:root`)
- primitives: `components/orcaly-next/foundation/primitives.tsx` (`FoundationRoot`, `StatusPill`, `StateBlock`, `DemoBanner`)
- skins: `lib/orcaly-next/skins.ts`

**Não substitui a identidade atual.** Fonte base continua `Arial, Helvetica, sans-serif` (a mesma de `app/globals.css`); cores de produto são as do registry vivo (teste de paridade). O que muda é a *estrutura*: escala, tokens semânticos, regras.

## 1. Escopo — o que é Foundation e o que é Skin

| Foundation (igual em todos) | Skin (contrato por produto) |
| --- | --- |
| spacing, grid, containers, breakpoints | accent, surface |
| tipografia base e escala | tipografia de display (peso, tracking, família opcional) |
| forms, dialogs, tables, tooltips, toasts | densidade (compact/comfortable/spacious) |
| estados loading/empty/error/success | raio (crisp/soft/round) |
| foco, teclado, reduced motion, touch | personalidade de motion (duração/easing) |
| launcher, command palette, notificações | navegação, home, elementos signature |
| chart foundation (eixos, grid, tooltip, a11y) | estilo de gráfico e ênfase |

## 2. Tokens

### 2.1 Spacing (base 4px)
`--ox-space-1..8` = 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Nenhum valor fora da escala em código novo.

### 2.2 Tipografia base
| Token | px | Uso |
| --- | --- | --- |
| `--ox-text-xs` | 12 | metadados, pills (**mínimo absoluto** — Audit A15 encontrou 8–10px) |
| `--ox-text-sm` | 14 | texto secundário, tabelas |
| `--ox-text-md` | 16 | corpo |
| `--ox-text-lg` | 18 | lead |
| `--ox-text-xl` | 22 | h3 / título de seção |
| `--ox-text-2xl` | 28 | h2 |
| `--ox-text-3xl` | 36 | h1 app |
| `--ox-text-4xl` | 48 | h1 landing (com `clamp()`) |

Leading: 1.15 títulos, 1.6 corpo. Coluna de leitura máx. 72ch. Números monetários e métricas: `font-variant-numeric: tabular-nums`.

### 2.3 Display typography contract
Cada skin define `display.weight` (500/600/700) e `display.tracking`. Família de display é **opcional** e só entra com ativo licenciado aprovado (Academy pode usar serifada; fallback Georgia). Sem web font nova nesta fase (sem dependência).

### 2.4 Superfícies semânticas
`--ox-bg`, `--ox-surface`, `--ox-surface-muted`, `--ox-surface-raised`, `--ox-ink`, `--ox-ink-muted`, `--ox-line`, `--ox-line-strong`, e pares de estado `--ox-{info,success,warning,danger}` + `-bg`. Todos os pares de texto/fundo medidos ≥ 4.5:1 em claro e escuro (menor: 5.75:1). Tema escuro via `prefers-color-scheme` ou `data-theme="dark"`.

### 2.5 Bordas, raio, elevação
Borda 1px `--ox-line`; separação forte `--ox-line-strong`. Raio: `sm 6`, `md 10`, `card` (skin: 8/14/22), `pill 999`. Elevação: `--ox-shadow-1` (cards), `--ox-shadow-2` (popovers/dialogs). Nada além de dois níveis.

### 2.6 Densidade
`--ox-density-gap`: compact 12 · comfortable 16 · spacious 24. Densidade altera gap e padding de card/linha de tabela; nunca o tamanho mínimo de texto ou de alvo de toque.

## 3. Grid e containers
- Container: `max-width 1280px` (1360 ≥ 1440px), padding lateral 16 (mobile) / 32 (≥ 768).
- Grid de conteúdo: colunas `minmax(0, 1fr)` **sempre** — lição do QA desta branch: trilhas `auto` deixaram capturas/placeholder alargarem a página em 320/390px.
- Coluna de leitura 72ch; layouts de 2 colunas só ≥ 1024 (3fr/2fr).

## 4. Breakpoints canônicos
| Nome | min-width | Observação |
| --- | --- | --- |
| base | 0 | projeto começa em 320px |
| md | 768 | tablet; nav colapsada → visível |
| lg | 1024 | 2 colunas |
| xl | 1440 | container largo |
Substituem 760/1050/1500 (ecosystem) e 520/760/1023/1180 (painel) — Audit A3. Tailwind 4: declarar em `@theme` na etapa 2 da migração.

## 5. Forms
- Label visível sempre acima do campo; placeholder nunca substitui label.
- Altura mínima 44px; erro abaixo do campo, ligado por `aria-describedby`, texto + ícone (não só cor).
- Validação ao sair do campo e no envio; nunca a cada tecla (exceto força de senha).
- Campos monetários: moeda explícita no rótulo; separador pt-BR; valor exato em centavos (padrão Wealth `parseMoney`).
- Botão de envio mostra estado pendente (`aria-busy`) e não permite duplo envio (idempotência já é regra do backend).

## 6. Tables
- `<table>` com `<caption>` (pode ser `sr-only`) e `th scope="col"` — hoje só 7/21 e 4/21 (Audit A13).
- ≤ 767px: modo *stack* (cada linha vira card com pares rótulo/valor), nunca scroll horizontal da página.
- Ordenação: `aria-sort` no cabeçalho ativo. Paginação: "Página X de Y" + contagem total quando conhecida.
- Números à direita com `tabular-nums`; status com StatusPill.

## 7. Search
Busca **de dados** fica dentro de cada produto (respeita scope). Busca **global** = Command Palette, que só navega/aciona e nunca lê dados de produtos (ver §15).

## 8. Dialog rules
- Modal: `<dialog>` nativo + `showModal()` (focus trap, `inert`, Esc da plataforma). Implementado na palette.
- Título obrigatório (`aria-labelledby` ou `aria-label`); fechar por Esc, botão visível e clique no backdrop (exceto dialogs destrutivos).
- Foco inicial no primeiro campo ou na ação *menos* destrutiva; ao fechar, foco volta ao disparador (**verificado**: o foco é devolvido no evento `close`, que é assíncrono — testes devem esperar o evento).
- Mobile ≤ 767px: dialog vira tela cheia.

### 8.1 ConfirmDialog (substitui `alert/confirm`)
Título = ação ("Excluir pedido #123?"), corpo = consequência, botões com verbo ("Excluir pedido" / "Cancelar"). Ações financeiras/irreversíveis seguem `ORCALY_INTELLIGENCE_UX_CONTRACT.md` §9.

## 9. Tooltip rules
Só para informação suplementar; nunca para conteúdo necessário à tarefa. Abre em hover **e** foco; fecha com Esc; não contém links. Em touch, substituído por texto visível ou botão "?" que abre popover.

## 10. Toast / notificações
- Toast: confirmações não críticas, `role="status"`, 5s, pausável em hover/foco, máx. 3 empilhados.
- Erros que exigem ação nunca são só toast → StateBlock/alert inline.
- Notificações persistentes pertencem ao namespace do produto (`orcaly.<produto>`, registry); Hub mostra só o que o produto publicou (Pulse).

## 11. Loading
- Toda rota nova: `loading.tsx` com `LoadingState` (`role=status`, texto específico: "Consultando seu cofre pessoal…" — padrão Wealth).
- Skeleton só quando a forma final é conhecida (tabela, cards). Nunca skeleton > 3s sem texto.
- Carregamento parcial: seção que falha mostra StateBlock `error`; o resto da página continua.

## 12. Empty / error / success — `StateBlock`
| kind | Quando | Papel ARIA |
| --- | --- | --- |
| `empty` | consulta ok, zero registros | — |
| `error` | falha técnica; diz o que **não** foi feito ("nenhum saldo foi estimado") | `alert` |
| `forbidden` | sem permissão/papel | — |
| `not-configured` | provider/recurso não configurado | — |
| `blocked-external` | dependência externa ausente | — |
| `loading` | carregando | `status` |
Sucesso: toast ou mensagem inline `role=status`; nunca modal de sucesso.

## 13. Acessibilidade (padrão mínimo)
WCAG 2.2 AA. Checklist por tela: 1 `h1`, hierarquia sem saltos, nomes acessíveis em todo controle, `lang="pt-BR"`, skip link, sem informação só por cor, contraste AA, alvos ≥ 44×44, sem overflow horizontal de 320 a 1920, reduced motion respeitado, navegação completa por teclado. O harness `scripts/orcaly-next-visual-qa.mjs` automatiza parte disso (Axe não está disponível nesta sessão; o QA hospedado do Wealth já usa Axe e deve ser o padrão final).

## 14. Foco e teclado
- Anel único: `--ox-focus-ring` (3px sobre o fundo + 3px azul), só em `:focus-visible`. Substitui as 8 variações atuais (Audit A14).
- Atalhos globais: `Ctrl/⌘+K` palette. Nenhum atalho de letra única sem modificador (conflita com leitores de tela).
- Grids navegáveis (launcher): setas movem, Home/End extremos, Tab sai do componente.

## 15. Motion
| Primitive | Duração | Uso |
| --- | --- | --- |
| `enter` | skin (160–260ms) | popovers, dialogs (opacity + translate ≤ 6px) |
| `state` | 150ms | hover, seleção |
| `route` | nenhuma por padrão | — |
Só `transform`/`opacity`. `prefers-reduced-motion: reduce` → durações 0.01ms (verificado no launcher). Nada de parallax ou animação contínua em telas de dados.

## 16. Mobile e touch
Alvos ≥ 44×44 (verificado automaticamente em 6 larguras); espaçamento mínimo 8px entre alvos; ações primárias na metade inferior em apps (bottom bar Business); inputs com `inputmode` correto; nada depende de hover.

## 17. Chart foundation
- Toda visualização declara **fonte, período e unidade** (herdado dos blocos explicáveis do Wealth).
- Valor ausente = lacuna com rótulo, **nunca zero** (`NOT_AVAILABLE`).
- Rótulo direto nas séries quando ≤ 4 séries; legenda caso contrário. Máx. 6 séries.
- Alternativa acessível: tabela de dados alcançável (link "Ver dados") ou `<figcaption>` com resumo.
- Cores: série principal = accent do skin; demais neutras; estados usam tokens semânticos.

## 18. Navigation primitives
`ProductNav` (declarada no registry), `Breadcrumb`, `Tabs`, `BottomBar` (mobile), `UniversalLauncher`, `CommandPalette`. Estado ativo calculado por `lib/orcaly-next/navigation.ts#mostSpecificActive` (nunca pai e filho ativos ao mesmo tempo).

## 19. Launcher e Command Palette
Especificação detalhada e contrato de teclado em `ORCALY_HUB_LAUNCHER_PALETTE.md`.
