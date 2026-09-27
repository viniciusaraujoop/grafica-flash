# Hub 2.0, Universal Launcher e Command Palette — contratos de UX

Protótipos isolados (nenhuma rota nova, nada substituído):
- `components/orcaly-next/hub/Hub2Prototype.tsx` (server component; launcher e palette são ilhas client)
- `components/orcaly-next/launcher/UniversalLauncher.tsx`
- `components/orcaly-next/command-palette/CommandPalette.tsx`
- modelo: `lib/orcaly-next/hub-model.ts`, `command-index.ts`; dados demo: `demo-data.ts`

## 1. Hub 2.0

### Estrutura
1. **Seus apps** — produtos com vínculo: ACTIVE, TRIAL, PAYMENT_PENDING, SUSPENDED, BLOCKED_EXTERNAL.
2. **Continue** — último ponto por produto; só aceita href **dentro** do produto que a conta pode abrir (teste rejeita `/admin` vindo do Wealth).
3. **Pulse** — fatos publicados por cada produto, com **fonte obrigatória** (produto · módulo · período). Nada cruzado entre produtos sem consent.
4. **Atividade** — lista cronológica curta.
5. **Outros produtos** — AVAILABLE, NOT_SUBSCRIBED, COMING_SOON + slot do One (bundle, "composição e preço ainda não publicados").

### Read model
O Hub atual (`app/apps/page.tsx`) consulta `companies` e `affiliate_profiles` diretamente (Audit A19). Proposta: cada produto publica `HubProductSnapshot { productId, status, continueItem }` já autorizado no servidor; o Hub só organiza. Pulse/Activity idem (`PulseItem`, `ActivityItem`).

### Layout
| Largura | Seus apps / Outros | Continue + Pulse |
| --- | --- | --- |
| < 560 | 1 coluna | empilhados |
| 560–1023 | 2 colunas | empilhados |
| ≥ 1024 | 3 colunas | 3fr / 2fr |

Topbar sticky com marca, palette e launcher. Um `h1`. Cada seção `aria-labelledby`.

### Honestidade de dados
`demoLabel` renderiza `DemoBanner` (`role=note`). Dados demo derivam status com a função real (`deriveHubStatus`), então o demo **não consegue** mostrar produto não lançado como abrível (teste). A galeria de estados usa nomes fictícios "Exemplo A–H".

## 2. Universal Launcher

| Aspecto | Contrato (verificado no harness) |
| --- | --- |
| Gatilho | `button` com `aria-expanded`, `aria-controls`, `aria-haspopup="dialog"`, nome acessível "Produtos Orçaly" |
| Painel | `role="dialog"` não modal, `aria-labelledby` |
| Colunas | 3 em ≥ 768px (desktop/tablet), 2 abaixo (lidas do CSS em tempo real) |
| Abrir | foco no primeiro tile |
| Setas | ←/→ ±1; ↑/↓ ± nº de colunas; Home/End extremos; Tab sai normalmente |
| Esc | fecha e devolve foco ao gatilho |
| Clique fora | fecha (pointerdown) sem roubar foco |
| Tile | marca, nome, status textual; texto oculto "abre o aplicativo" / "abre a página do produto" |
| Destino | subscribed → app; unsubscribed → landing (`resolveProductDestination`) |
| Touch | tiles ≥ 104px de altura; gatilho 44×44 |
| Mobile | painel `position: fixed` com 16px de margem, rolável, `overscroll-behavior: contain` |
| Motion | entrada 200ms opacity/translate; `prefers-reduced-motion` → 0.01ms (verificado) |
| One | nunca aparece (não é app) |

## 3. Command Palette

| Aspecto | Contrato (verificado no harness) |
| --- | --- |
| Abrir/fechar | `Ctrl/⌘+K` alterna; botão com dica `Ctrl K` (oculta em mobile) |
| Estrutura | `<dialog>` nativo `showModal()`; input `role=combobox` + `aria-controls` + `aria-activedescendant`; `listbox` > `group` > `option` |
| Teclado | ↑/↓ circular; Ctrl+Home/End; Enter abre; Esc fecha (nativo) e foco volta ao gatilho |
| Mouse | hover seleciona; clique abre; clique no backdrop fecha |
| Conteúdo | Produtos (abrir/conhecer), Navegação (só de produtos ACTIVE/TRIAL), Ações globais (App Hub, Privacidade) |
| Ranking | determinístico, sem IA: título exato 120 · prefixo 100 · prefixo de palavra 80 · substring 60 · keyword prefixo 40 · keyword substring 25 · subsequência 10; AND entre termos; desempate grupo → título normalizado → id; insensível a acento |
| Vazio | "Nenhum resultado para “…”" + contagem `aria-live` ("0 resultados") |
| Segurança | nunca indexa dados de produtos; nunca expõe rotas internas de produto sem direito (teste + harness) |
| Mobile | dialog em tela cheia |
| Integração | `onNavigate` recebe `router.push`; padrão faz navegação completa |

## 4. Estados visuais dos 8 status
| Status | Pill | Ação | Destino |
| --- | --- | --- | --- |
| ACTIVE | Ativo (success) | Abrir | app |
| TRIAL | Em teste (info) | Abrir | app |
| AVAILABLE | Disponível (accent) | Conhecer | landing |
| NOT_SUBSCRIBED | Sem assinatura (neutral) | Ver opções | landing |
| PAYMENT_PENDING | Pagamento pendente (warning) | Ver pagamento | landing* |
| SUSPENDED | Suspenso (danger) — "seus dados não foram apagados" | Entender | landing* |
| COMING_SOON | Em breve (neutral) | Saiba mais | landing |
| BLOCKED_EXTERNAL | Aguardando integração (warning) | Detalhes | app (se LIVE) |

\* quando existir página de billing por produto, PAYMENT_PENDING/SUSPENDED apontam para ela (depende do Billing multi-produto, fora desta frente).

## 5. Evidência
`docs/product/evidence/orcaly-next/ORCALY_NEXT_VISUAL_QA.json` + capturas. Reproduzir: ver cabeçalho de `scripts/orcaly-next-visual-qa.mjs`.
