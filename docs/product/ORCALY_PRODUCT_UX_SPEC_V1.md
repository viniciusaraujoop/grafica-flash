# Orçaly — Product & UX Specification V1

Branch `claude/orcaly-ux-foundation` · base `codex/orcaly-ecosystem@9d8c0a7` · 2026-09-27

**Como ler.** Cada afirmação é marcada:
- **[REAL]** — existe hoje no código (rota, módulo ou teste citado).
- **[DECIDIDO]** — decisão de produto registrada na bíblia do projeto ou em `docs/architecture/*`.
- **[PROPOSTA]** — desenho desta spec; precisa de aceite do dono do produto antes de implementar.

Regra máxima herdada: código + banco + CI + deploy reais vencem este documento.

Documentos irmãos: `ORCALY_UX_FOUNDATION_V1.md` (o que é compartilhado), `ORCALY_PRODUCT_SKINS_V1.md` (o que varia), `ORCALY_PRODUCT_REGISTRY_SPEC.md` (dados), `ORCALY_ROUTING_INFORMATION_ARCHITECTURE.md` (rotas), `ORCALY_INTELLIGENCE_UX_CONTRACT.md` (IA).

---

## 0. Princípios transversais

1. **Produtos independentes.** Qualquer produto pode ser assinado sozinho; Business não é pré-requisito. One é bundle comercial, não app. [DECIDIDO]
2. **Contextos separados.** `personal`, `company`, `household` nunca se misturam automaticamente. [DECIDIDO]
3. **Entitlement ≠ consent.** Ter acesso a dois produtos não autoriza cruzar dados entre eles. Cross-product = DENY BY DEFAULT. [DECIDIDO, `lib/ecosystem/access.ts#permitsContextTransfer`]
4. **Nada inventado.** Provider ausente = `NOT_CONFIGURED`; dependência externa = `BLOCKED_EXTERNAL`; valor ausente nunca é zero. [DECIDIDO]
5. **Observe → Understand → Act.** Toda home começa pelo estado, depois explica, depois oferece ação. [DECIDIDO]
6. **Foundation + Skins.** Primitivas compartilhadas; personalidade por contrato de skin, não por fork de CSS. [DECIDIDO]

## 1. Matriz resumida

| Produto | Release hoje | Rota app | Scope | Signature | Densidade |
| --- | --- | --- | --- | --- | --- |
| Business | LIVE [REAL] | `/painel/inicio` [REAL] | company | Company Operating Brief | compacta |
| Wealth | EARLY_ACCESS [REAL] | `/apps/wealth` [REAL] | personal (+household por consent) | Briefing explicável | espaçosa |
| Growth | IN_DEVELOPMENT | `/apps/growth` (não construída) | company | Experiment OS | confortável |
| Flow | IN_DEVELOPMENT | `/apps/flow` (não construída) | company | Workflow builder + linguagem natural | confortável |
| Academy | IN_DEVELOPMENT | `/apps/academy` (não construída) | personal | Biblioteca / learning stream | espaçosa |
| Market | IN_DEVELOPMENT | `/apps/market` (não construída) | personal | Busca por problema | confortável |
| Partners | LIVE [REAL] | `/parceiros/painel` [REAL] | personal (perfil de parceiro) | Pipeline + comissões | confortável |
| One | IN_DEVELOPMENT | — (bundle) | — | Comparador individual × One | — |

---

## 2. Orçaly Business

| Campo | Especificação |
| --- | --- |
| Propósito | Operar a empresa do primeiro contato à entrega. [DECIDIDO] |
| Target user | Donos e equipes de pequenos negócios com operação sob encomenda (gráfica, food, serviços, eventos — `lib/business-types.ts`). [REAL] |
| Jobs-to-be-done | "Saber o que exige atenção hoje"; "transformar um pedido de orçamento em pedido pago"; "não perder prazo de entrega"; "entender se o mês fechou no azul". [PROPOSTA] |
| Core problem | Operação espalhada em conversas, planilhas e cadernos. [PROPOSTA] |
| Core value | Um fluxo único contato → proposta → pedido → produção → entrega → financeiro. [REAL: rotas `/painel/propostas`, `/pedidos`, `/producao`, `/entregas`, `/financeiro`] |
| Identity | Operacional + executivo. [DECIDIDO] |
| Visual character | Alta densidade quando necessário; números tabulares; pouca decoração. [PROPOSTA — skin `business`] |
| Navigation | Sidebar agrupada por segmento, gerada por `lib/panel-modules.ts` (1450 linhas) + `segment-modules` + `operations-experience`. Registry declara `legacy-adapter`. [REAL] |
| Information architecture | Hoje (Início) → Vendas (propostas, pedidos, clientes, CRM) → Operação (produção, entregas, agenda, estoque) → Financeiro → Presença (site, loja, cupons) → Configurações. [PROPOSTA de agrupamento sobre módulos REAL] |
| Home | Company Operating Brief: faixa "exige atenção hoje" (prazos, aprovações de arte, pagamentos pendentes), fluxo do dia, resultado do mês com comparação. Evolui `TodayOperationsCenter.tsx` [REAL], não substitui. [PROPOSTA] |
| Signature experience | Operating Brief; linha do tempo do pedido; filtros persistentes. [PROPOSTA] |
| Dashboard philosophy | Pendências antes de métricas; toda métrica com período e comparação; nenhum gráfico sem ação associada. [PROPOSTA] |
| Key routes | `/painel/inicio`, `/painel/pedidos`, `/painel/clientes`, `/painel/propostas`, `/painel/financeiro`, `/painel/catalogo`, `/painel/entregas`, `/painel/relatorios`, `/painel/assistente`, `/painel/configuracoes`. [REAL] |
| Screen hierarchy | Lista → detalhe (drawer em desktop, página em mobile) → ação. Pedido: `/painel/pedidos` → `/painel/pedidos/[id]`. [REAL] |
| Main components | DataTable com modo stack, StatusPill de pedido, PageHeader com ações, Drawer de detalhe, Filters. Adotar `components/panel-ui` + Foundation (ver Consolidation C1–C7). |
| Empty states | "Nenhum pedido ainda" + ação "Criar pedido"; distinguir de "sem permissão" (membro sem papel) e de "módulo indisponível no plano". [PROPOSTA] |
| Loading | Skeleton de tabela para listas; texto `role=status` para ações. Hoje 1 `loading.tsx` para ~110 páginas → adicionar por grupo de rotas. [REAL/PROPOSTA] |
| Error | `app/painel/error.tsx` [REAL] + StateBlock `error` por seção para falhas parciais (uma seção falha, o resto renderiza). |
| Mobile | Bottom bar com 4 atalhos (Hoje, Pedidos, +, Clientes) — já esboçado em `PanelSidebar` (ícones today/orders/plus/customers) [REAL]; tabelas viram cards. |
| Desktop | Sidebar fixa colapsável; conteúdo até 1360px; tabelas completas. |
| Accessibility | Substituir 28 `alert/confirm` nativos por ConfirmDialog; caption em tabelas; foco visível único. [Audit A12–A14] |
| Permissions | Por membro (`app/painel/configuracoes/equipe`, RBAC admin) [REAL]. `business.*`. |
| Entitlements | `product.business`; fontes incluem `legacy` (planos Essencial/Profissional/Premium em `lib/marketing/main-site.ts`) [REAL]. |
| Scope | `company` exclusivamente. |
| AI context | Assistente existente (`/api/ai/business-assistant`, `/painel/assistente`) [REAL]. Domínios: pedidos, clientes, financeiro da empresa ativa. Nunca lê Wealth. |
| Data dependencies | `companies`, pedidos, clientes, financeiro — tabelas existentes. |
| Integration dependencies | Google Agenda, Resend, Mercado Pago [REAL em `lib/integrations`, `lib/mercado-pago.ts`]; NFS-e `NOT_CONFIGURED`; WhatsApp **congelado**. |
| External blockers | NFS-e, marketplaces externos, ERP. |
| MVP | Existente (preservar). |
| V2 | Foundation + Operating Brief + primitives consolidadas + loading/error por grupo. |
| V3 | Navegação via registry (adaptador), rota canônica `/apps/business` com redirect de `/painel/*`, Pulse alimentado por snapshot. |

## 3. Orçaly Wealth

| Campo | Especificação |
| --- | --- |
| Propósito | Clareza patrimonial com dados declarados. [DECIDIDO] |
| Target user | Pessoa física organizando finanças pessoais e patrimônio; opcionalmente com família via consentimento explícito. [DECIDIDO] |
| Jobs-to-be-done | "Quanto eu realmente tenho?"; "o que vence esta semana?"; "estou no ritmo da minha meta?"; "onde estão meus documentos importantes?" [PROPOSTA] |
| Core problem | Informação financeira dispersa e opaca. |
| Core value | Um único livro (`wealth_entries`) projetado em patrimônio, dívidas, carteiras, calendário, metas, impostos — sem saldo duplicado. [DECIDIDO/REAL] |
| Identity | Calmo, sofisticado, seguro. [DECIDIDO] |
| Visual character | Menor densidade, gráficos elegantes com fonte e período, muito espaço em branco. [PROPOSTA — skin `wealth`] |
| Navigation | **Hoje:** pilha de `Link.textButton` em `app/apps/wealth/page.tsx` (Audit A11). **Proposta:** 6 grupos declarados no registry — Hoje · Dinheiro · Patrimônio · Futuro · Proteção · Conexões (`lib/orcaly-next/product-registry.ts`). Top-sections em desktop, sheet em mobile. |
| Information architecture | Hoje (visão geral, briefing) · Dinheiro (lançamentos, recorrências, calendário, dívidas) · Patrimônio (patrimônio líquido, carteiras, tarifas) · Futuro (metas, planejamento, saúde) · Proteção (shield, documentos, impostos) · Conexões (família, automações, timeline). Todas as 18 rotas existem [REAL, testado]. |
| Home | Briefing Morning/Night primeiro (Observe → Understand → Act), depois patrimônio e próximos compromissos. Unidade Morning/Night pertence ao agente principal — esta spec só define o lugar dela na home. |
| Signature experience | Blocos explicáveis (source/period/rule/interpretation/limitation) [REAL em Financial Health]; briefing; cofre privado. |
| Dashboard philosophy | Nenhum score arbitrário; `NOT_AVAILABLE` nunca plotado como zero; toda simulação rotulada como simulação. [DECIDIDO] |
| Key routes | `/apps/wealth`, `/briefing`, `/lancamentos`, `/recorrencias`, `/calendario`, `/dividas`, `/patrimonio`, `/carteiras`, `/tarifas`, `/metas`, `/planejamento`, `/saude`, `/shield`, `/documentos`, `/impostos`, `/familia`, `/automacoes`, `/timeline`. [REAL] |
| Screen hierarchy | Grupo → módulo → registro (`/carteiras/[portfolioId]`, `/dividas/[entryId]`, `/metas/[goalId]`, `/documentos/[id]`). [REAL] |
| Main components | ExplainableBlock, MoneyValue (moeda explícita, BigInt), ValuationBadge, Timeline, PageHeader. |
| Empty states | Distinguir "nenhum registro" / "provider NOT_CONFIGURED" / "sem consentimento". |
| Loading | 12/24 rotas têm `loading.tsx` [REAL]; padronizar com LoadingState; corrigir `impostos/loading.tsx` sem `role=status`. |
| Error | 12 `error.tsx` [REAL]; mensagem padrão já diz "nenhum saldo foi estimado" — manter como padrão de voz. |
| Mobile | Sheet de navegação por grupos; valores monetários nunca truncados (quebram linha). |
| Desktop | Coluna de leitura ≤ 72ch para textos explicativos; gráficos até 960px. |
| Accessibility | Hosted QA já cobre Axe, teclado, reduced motion, 6 larguras [REAL em `docs/qa/ORCALY_WEALTH_*`]. Manter no padrão. |
| Permissions | `wealth.read`, `wealth.write`, export [REAL]. Owner-only por padrão. |
| Entitlements | `product.wealth`; release `preview` + feature flag `ecosystem.wealth` [REAL]. |
| Scope | `personal`; `household` apenas por compartilhamento explícito por registro, bilateral, revogável [REAL: `/familia`]. |
| AI context | Ask Wealth (planejado): modos education/analysis/simulation/planning; regulated_advice/execution OFF. Ver Intelligence UX Contract. |
| Data dependencies | `wealth_entries` (fonte única), `wealth_goals`, holdings, documents, profiles. |
| Integration dependencies | Cotações `NOT_CONFIGURED`; Open Finance `BLOCKED_EXTERNAL`; regras fiscais `NOT_CONFIGURED`. |
| External blockers | Provedor de mercado, Open Finance, regulação para aconselhamento. |
| MVP | Módulos certificados até Tax Center + Morning/Night (em certificação pelo agente principal). |
| V2 | Alerts → Ask Wealth → Portfolio Intelligence (roadmap do agente principal) + ProductShell com navegação do registry. |
| V3 | Market/Radar, Open Finance, Regulatory Mode. |

## 4. Orçaly Growth

| Campo | Especificação |
| --- | --- |
| Propósito | Crescimento guiado por experimentos. [DECIDIDO: "Experiment OS"] |
| Target user | Empresas que investem em aquisição e querem decidir com evidência. [PROPOSTA] |
| Jobs-to-be-done | "Qual canal traz cliente de verdade?"; "esse teste funcionou ou foi sorte?"; "o que já aprendemos?" [PROPOSTA] |
| Core problem | Decisões de marketing sem hipótese nem controle. |
| Core value | Hipótese → teste → aprendizado registrado. |
| Identity / visual | Energético, experimental, data-driven. Tipografia de display mais pesada; cores de estado vivas. |
| Navigation | Top-sections com métricas: Experimentos · Resultados · Aprendizados · Fontes. [PROPOSTA] |
| IA / Home | Home = quadro de experimentos em andamento + "próximo teste sugerido pelo seu histórico". |
| Signature | Cartão de hipótese; leitura controle × variante com intervalo; diário de aprendizados. |
| Dashboard philosophy | Incerteza sempre visível; nunca declarar "vencedor" sem critério pré-registrado. |
| Key routes | `/apps/growth`, `/apps/growth/experimentos`, `/apps/growth/experimentos/[id]`, `/apps/growth/aprendizados`, `/apps/growth/fontes`. [PROPOSTA — nenhuma existe] |
| Components | HypothesisCard, ExperimentBoard (colunas por estado), ResultChart (intervalo), LearningLog. |
| States | Sem fontes conectadas = `BLOCKED_EXTERNAL` com lista do que falta. |
| Mobile / desktop | Mobile: leitura de resultados e registro de aprendizado; criação de experimento é desktop-first. |
| Permissions / entitlements / scope | `growth.*`, `product.growth`, `company`. |
| AI context | Sugerir hipóteses a partir do histórico da própria empresa; nunca inventar benchmark de mercado. |
| Data / integrations | Fontes de mídia e analytics (`NOT_CONFIGURED`). Reaproveitar auditoria de `app/admin/growth` antes de reusar (docs/architecture/ORCALY_PRODUCTS.md). |
| External blockers | Conectores de anúncios/analytics. |
| MVP | Registro manual de experimentos + resultados declarados. |
| V2 | Conectores de fontes; cálculo de intervalo. |
| V3 | Sugestões de IA com Decision Receipts. |

## 5. Orçaly Flow

| Campo | Especificação |
| --- | --- |
| Propósito | Automatizar trabalho repetido com segurança. [DECIDIDO] |
| Target user | Operação de empresas com processos repetitivos (notificações, follow-ups, sincronizações). |
| Jobs-to-be-done | "Quando X acontecer, faça Y"; "quero ver o que a automação fez"; "nada crítico sem minha aprovação". |
| Identity / visual | Técnico, futurista, visual. Rótulos técnicos em caixa alta pequena; mono só para expressões. |
| Navigation | Rail lateral fino + canvas. Seções: Fluxos · Execuções · Aprovações · Conexões. [PROPOSTA] |
| Home | Canvas com entrada em linguagem natural acima ("Descreva o que precisa acontecer"). |
| Signature | Canvas de nós; prompt → rascunho editável; aprovação humana antes de executar. [DECIDIDO: "visual workflow builder + natural language"] |
| Dashboard philosophy | Execuções como timeline; falhas primeiro; custo e tempo por execução visíveis. |
| Key routes | `/apps/flow`, `/apps/flow/fluxos/[id]`, `/apps/flow/execucoes`, `/apps/flow/aprovacoes`. [PROPOSTA] |
| Components | Canvas (fora do padrão formulário/tabela — requer primitive própria), NodeInspector, RunTimeline, ApprovalQueue. |
| States | Execução pendente de aprovação; falha com retry; conector ausente `BLOCKED_EXTERNAL`. |
| Accessibility | Canvas precisa de representação alternativa em lista (teclado + leitor de tela). Requisito de aceite, não opcional. |
| Permissions / scope | `flow.*`, `company`. Aprovação exige papel específico. |
| AI context | Linguagem natural gera rascunho; nunca ativa sem revisão. Decision Receipt por ativação. |
| Data / integrations | Reusar `lib/jobs/*` (worker existente) [REAL] como motor candidato após auditoria. |
| MVP | Fluxos a partir de templates + aprovação. V2 canvas livre. V3 linguagem natural. |

## 6. Orçaly Academy

| Campo | Especificação |
| --- | --- |
| Propósito | Aprender com continuidade. [DECIDIDO] |
| Target user | Pessoa física; opcionalmente membros de empresa (conteúdo corporativo em V3). |
| Jobs-to-be-done | "Continuar de onde parei"; "encontrar um conteúdo sobre X"; "guardar minhas notas". |
| Identity / visual | Editorial, calmo. Contrato de display permite serifada quando ativo aprovado; fallback Georgia. |
| Navigation | Tabs editoriais: Continuar · Trilhas · Biblioteca · Notas. |
| Home | "Continuar lendo" → trilhas em andamento → descobertas. |
| Signature | Biblioteca; learning stream; notas privadas. |
| Key routes | `/apps/academy`, `/apps/academy/biblioteca`, `/apps/academy/trilhas/[id]`, `/apps/academy/ler/[id]`, `/apps/academy/notas`. [PROPOSTA] |
| Components | ReaderView (tipografia de leitura, controles de tamanho), ProgressRing, NoteEditor. |
| Accessibility | Modo leitura com ajuste de fonte/espaçamento; suporte a leitor de tela sem quebrar notas. |
| Scope / privacy | `personal`. Notas e reflexões nunca entram em assistente de empresa (docs/architecture/ORCALY_INTELLIGENCE.md). |
| External blockers | Licenciamento de conteúdo (`NOT_CONFIGURED`). Nenhum livro gerado sem licença. |
| MVP | Biblioteca com conteúdo próprio + progresso. V2 trilhas. V3 IA de resumo com licença. |

## 7. Orçaly Market

| Campo | Especificação |
| --- | --- |
| Propósito | Do problema à solução. **Não é catálogo genérico.** [DECIDIDO] |
| Target user | Pessoas e empresas procurando ferramenta, serviço ou especialista. |
| Jobs-to-be-done | "Preciso resolver X — quais opções existem e qual serve para mim?" |
| Identity / visual | Orientado a solução; título é sempre o problema, nunca o fornecedor. |
| Navigation | Search-first: uma caixa "Qual problema você quer resolver?" + problemas frequentes. |
| Home | Busca por problema → soluções agrupadas por problema → comparador. |
| Signature | Busca por problema; comparador por critérios de adequação; declaração de relação comercial. |
| Key routes | `/apps/market`, `/apps/market/problemas/[slug]`, `/apps/market/comparar`. [PROPOSTA] |
| Rule | Ranking nunca por maior comissão (docs/architecture/ORCALY_INTELLIGENCE.md). Relação comercial sempre visível. |
| Relação com Business | O marketplace de loja existente (`/painel/marketplace`, `/loja/[slug]`) é do tenant e **não** é o Market [REAL — docs/architecture/ORCALY_PRODUCTS.md]. |
| Scope | `personal` hoje no registry vivo; avaliar `company` quando houver compra empresarial. |
| MVP | Problemas curados manualmente + soluções declaradas. V2 comparador. V3 recomendação contextual com consentimento. |

## 8. Orçaly Partners

| Campo | Especificação |
| --- | --- |
| Propósito | Distribuição: parceiros indicam e acompanham comissões. [REAL] |
| Target user | Parceiros/afiliados e consultores comerciais. |
| Jobs-to-be-done | "Qual o status das minhas indicações?"; "quanto tenho a receber e quando?"; "como demonstro o produto?" |
| Identity / visual | Profissional, comercial, performance. |
| Navigation | Portal · Pipeline · Notificações · Demonstrações [REAL rotas `/parceiros/*`]. |
| Home | Desempenho do período → pipeline por etapa → materiais. |
| Signature | Pipeline de indicações; extrato de comissões com status (prevista/aprovada/paga); kit de demo (`/parceiros/demo`) [REAL]. |
| Components | Funnel, CommissionStatement (DataTable), ReferralLink com cópia acessível. |
| States | Perfil inativo; comissões sem pagamento executado (nenhuma mutação de payout nesta frente). |
| Permissions / entitlements | `partners.*`; fontes `partner_grant`, `admin_grant`, `legacy`. |
| Scope | Perfil de parceiro é da pessoa (`personal`) — registry vivo usa contexto `partner`; mapeado para `personal` nesta spec, **a confirmar** com o dono do programa. |
| Data | `affiliate_profiles`, referências e comissões existentes [REAL]. |
| MVP | Existente. V2 Foundation + extrato claro. V3 rota canônica `/apps/partners`. |

## 9. Orçaly One

Bundle comercial. Sem app, sem navegação, sem dados, sem scope. Landing mostra **o que inclui e o que não inclui**; composição e preço `UNDECIDED` até publicação. Um grant de One nunca é consent nem autorização transitiva (`lib/ecosystem/access.ts` já exige grant por produto) [REAL].

---

## 10. Product Landings (arquitetura)

Seções em ordem fixa, implementadas em `components/orcaly-next/product-landing/ProductLanding.tsx`, conteúdo em `lib/orcaly-next/landing-content.ts`:

1. **Hero** — eyebrow (nome + status), título = benefício, lead, CTA primário/secundário.
2. **Proposta de valor** + 3 problemas.
3. **Recursos** — cada um com pill `Disponível` (tem rota real, com `evidence`) ou `Planejado`. Produto IN_DEVELOPMENT só pode ter `Planejado` (teste).
4. **Capturas** — `PLACEHOLDER` até captura de Preview certificado; nunca mockup vendido como tela real.
5. **Como funciona** — 3–4 passos.
6. **Integrações** — só com arquivo de evidência no repo; senão omitidas.
7. **Planos e acesso** — slots Preço / Teste / One com estados honestos (`PUBLISHED_ELSEWHERE`, `NOT_PUBLISHED`, `NOT_CONFIGURED`, `UNDECIDED`).
8. **FAQ** — `<details>` nativo.
9. **Segurança e privacidade** — só afirmações verdadeiras hoje.
10. **CTA final.**

**Mobile:** tudo em 1 coluna ≤ 767px; CTA visível sem scroll em 390×844. **SEO:** `generateMetadata` por produto (já existe em `app/produtos/[slug]`), canonical, `robots: index` só para produtos com landing aprovada; produtos IN_DEVELOPMENT com `noindex` até conteúdo aprovado [PROPOSTA]. **A11y:** uma `h1`, seções com `aria-labelledby`, placeholders com `role=img` + rótulo. **Proibido (testado):** números de clientes, receita, market share, "líder", depoimentos, preços escritos.

Os protótipos **não** foram montados em rota. Integração proposta: substituir o corpo de `app/produtos/[slug]/page.tsx` por `ProductLanding` atrás de feature flag, produto a produto (ver Migration Plan etapa 8).
