# Orçaly Product Skins V1 — contratos

Fonte executável: `lib/orcaly-next/skins.ts` (`skinContracts`, `skinStyle()`, `contrastRatio()`).
Testes: `scripts/test-orcaly-next-registry.mjs` garante (a) accent/surface idênticos ao registry vivo `lib/ecosystem/products.ts` — **nenhuma cor de marca foi alterada**; (b) contraste AA do accent sobre branco e sobre a própria surface.

Não são sete temas CSS. Um skin define **9 variáveis** consumidas pela Foundation (`--ox-accent`, `--ox-accent-text`, `--ox-accent-surface`, `--ox-radius-card`, `--ox-density-gap`, `--ox-motion-duration`, `--ox-motion-easing`, `--ox-display-weight`, `--ox-display-tracking`) + regras de composição documentadas abaixo. Tudo o mais vem da Foundation.

## Contraste medido (accent sobre branco / sobre surface / branco sobre accent)

| Skin | Accent | Surface | Branco | Surface | Botão |
| --- | --- | --- | --- | --- | --- |
| business | `#164bc4` | `#edf3ff` | 7.40 | 6.65 | 7.40 |
| wealth | `#146447` | `#eaf5ed` | 7.13 | 6.38 | 7.13 |
| growth | `#a44322` | `#fff1e9` | 6.17 | 5.58 | 6.17 |
| flow | `#6245b0` | `#f1edfc` | 7.01 | 6.09 | 7.01 |
| academy | `#865914` | `#fff7e5` | 6.08 | 5.70 | 6.08 |
| market | `#176572` | `#eaf7f8` | 6.69 | 6.10 | 6.69 |
| partners | `#364996` | `#eef0fa` | 8.23 | 7.25 | 8.23 |
| one | `#24394c` | `#edf2f5` | 11.90 | 10.55 | 11.90 |

Tema escuro: `--ox-accent-text = color-mix(accent 45%, white)` — todos ≥ 6.2:1 sobre as superfícies escuras. Por isso `accentText` é `null` em todos os skins.

## Contratos por produto

| | Business | Wealth | Growth | Flow | Academy | Market | Partners |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Palette role** | Accent só em ação primária e item ativo; estados de pedido usam tokens semânticos | Accent raro; verde reservado para progresso real, nunca "lucro" | Accent em hipóteses e CTAs; estados vivos | Accent nos conectores/nós ativos | Accent em progresso e links | Accent no campo de busca e critérios | Accent em métricas de desempenho |
| **Typography personality** | 600, −0.02em; números tabulares | 500, −0.04em; títulos grandes e arejados | 700, −0.03em; hipótese em destaque | 600, rótulos em caixa alta pequena; mono só p/ expressões | 500; serifada opcional (ativo licenciado) | 600; título = problema do usuário | 600; valores com status sempre |
| **Dashboard density** | compact (12) | spacious (24) | comfortable (16) | comfortable | spacious | comfortable | comfortable |
| **Card behavior** | Cards baixos, clicáveis inteiros, raio crisp (8) | Poucos cards, blocos explicáveis com fonte/período, raio soft (14) | Cartão de hipótese com estado | Nós do canvas; cards só fora do canvas | Capas/listas editoriais em vez de cards | Card de solução com critérios e relação comercial | Cards de KPI + tabela de extrato |
| **Charts** | Barras/linhas finas, comparação com período anterior | Áreas suaves, ≤ 3 séries, fonte+período em todo gráfico, lacuna ≠ zero | Controle × variante com intervalo | Timeline/gantt de execuções | Progresso apenas | Comparativo simples | Funil por etapa |
| **Illustrations** | Nenhuma no app | Mínimas; nada de "enriquecimento rápido" | Diagramas geométricos | Grafos; sem robôs antropomórficos | Capas/tipografia licenciadas | Mínima | Nenhuma no portal |
| **Icon style** | Traço 2px, cantos retos | 1.5px, arredondado | 2px, terminais arredondados | 1.5px geométrico | 1.5px arredondado | 2px | 2px, retos |
| **Motion** | 160ms, funcional | 260ms, sem rebote | 200ms, feedback imediato | 180ms, fluxo de dados entre nós | 240ms, transição editorial | 200ms, respostas em blocos | 180ms |
| **Navigation personality** | Sidebar densa + bottom bar mobile | Top-sections por 6 grupos | Top-sections com métricas | Rail fino + canvas | Tabs editoriais | Search-first | Top-sections com métricas |
| **Home composition** | Operating Brief: pendências → fluxo do dia → resultado do mês | Briefing → patrimônio → próximos compromissos | Experimentos ativos → aprendizados → próximo teste | Canvas + prompt | Continuar → trilhas → biblioteca | Busca por problema → problemas frequentes | Desempenho → pipeline → materiais |
| **Signature UI** | Operating Brief; timeline do pedido | Blocos explicáveis; Morning/Night; cofre | Cartão de hipótese; diário | Canvas; aprovação humana | Leitor; notas | Comparador; transparência | Extrato de comissões |
| **Tonal language** | Direto, executivo, imperativo sem exclamação | Sereno, preciso, explica limitações, nunca recomenda produto | Curioso, orientado a evidência | Preciso, técnico sem jargão | Calmo, convidativo | Objetivo; declara relação comercial | Comercial e transparente |

**One:** sem app; skin só para landing/oferta (institucional, raio soft).

## Anti-padrões (bloqueiam revisão)
- Skin que redefine spacing, tamanho mínimo de fonte, anel de foco ou alvo de toque.
- Dois produtos com a mesma home trocando só a cor ("clone").
- Card soup: > 9 cards equivalentes na primeira dobra.
- Sidebar com > 12 itens de primeiro nível sem agrupamento.
- Accent usado como cor de estado (sucesso/erro).
