# Orçaly Academy MVP — Relatório

Branch `claude/orcaly-academy-mvp`, base `claude/orcaly-growth-mvp@d89657b6745ff67b9dcb498a6dd8d20293497a8d`.
Sem persistência, sem migration, sem rota publicada, sem provider, sem dependência nova, sem alteração de runtime existente, Foundation ou Growth.

## 1. Arquitetura

```
lib/orcaly-next/academy/          domínio puro (TypeScript, sem React)
  types.ts        tipos: ContentItem, Track, TrackItem, Enrollment, Progress, LearningSession,
                  Note, Bookmark, CompletionEvent, Source, License, Author, Category, SearchDocument
  core.ts         basis points, Known<T> (KNOWN/UNKNOWN/NOT_APPLICABLE), URL/âncora/id seguros,
                  permittedActions (licença fail-closed), deriveAvailability
  tracks.ts       validação de trilha (posição, duplicidade, ciclos, vazia publicada), progresso
                  que exclui itens indisponíveis, próxima unidade
  progress.ts     posição de retomada, CAS, conclusão explícita com evento, sessão (UNKNOWN sem medição)
  notes.ts        notas privadas (1–4000 code points, sem controle/bidi, CAS, dono), favoritos idempotentes
  search.ts       busca local determinística só em metadados
  continue.ts     "Continuar" por regra fixa + sugestões com rule_id/reason/source
  library.ts      filtros/ordenação, rotas futuras
  reading.ts      preferências de leitura limitadas (14–24px, 1,4–2,0), formatadores determinísticos
  demo-data.ts    DEMO / SAMPLE DATA escrita para o protótipo
components/orcaly-next/academy/   22 componentes + AcademyPages + academy.module.css (escopado)
docs/product/academy/             contratos + evidência
scripts/test-orcaly-academy-{domain,mutation,visual}.mjs
```

UI usa `FoundationRoot skin="academy"`, `StatusPill`, `StateBlock`, `DemoBanner` e tokens `--ox-*`. Serifada (pilha Georgia, conforme contrato da skin Academy) **somente** no corpo e título do leitor; toda a UI estrutural continua na Foundation. Nenhum CSS global.

Componentes: AcademyShell, AcademyHome, ContinueLearning, AcademyLibrary, LibraryFilters, LibraryCard, AcademySearch, TrackCard, TrackDetail, TrackProgress, ReaderView, LessonView, MediaLessonPlaceholder, ReadingControls, ProgressIndicator, NotesPanel, NoteEditor, BookmarksPanel (+ BookmarksManager), SourceAttribution, LicenseBadge, AcademyEmptyState, AcademyBlockedState. Páginas prontas: `AcademyPages.tsx` (ver `ACADEMY_ROUTES.md`).

## 2. Testes de domínio — 16/16 PASS
`node --test scripts/test-orcaly-academy-domain.mjs`

Cobre: progresso 0 × UNKNOWN × NOT_APPLICABLE; bps inválidos (float, negativo, >10000, NaN, string); limiar 8999/9000 + conclusão explícita + CAS; nenhuma conclusão ao abrir/atualizar/100%; retomada (negativa, além da duração, âncora inexistente, página); trilha (item/posição duplicados, posição negativa, ciclos de 2 e 3, auto-pré-requisito, pré-requisito externo, vazia publicada, conteúdo desconhecido, sem obrigatórios); licença fail-closed (UNKNOWN, NOT_VERIFIED, EXPIRED, expires_at passado, EXTERNAL_LINK) e item bloqueado fora do cálculo da trilha; URLs inseguras (http, credenciais, javascript:, espaços, sem domínio); nada inventado na demo; notas (limites em code points, emoji, controle/bidi, HTML literal, alvo, CAS, dono, URL sem texto, notas demo `sample`); favoritos idempotentes e remoção isolada; busca (caixa/acento, limites, só metadados, ranking determinístico, duplicatas); prioridade do Continuar, exclusão de indisponíveis e de outros usuários; sugestões; sessão (UNKNOWN sem medição); filtros da biblioteca; preferências de leitura limitadas.

## 3. Mutation testing — 24/24 mutantes mortos
`node scripts/test-orcaly-academy-mutation.mjs` (injeta, roda a suíte, **sempre restaura**; sai com 1 se algum sobreviver)

| # | Mutante | Resultado |
| --- | --- | --- |
| M01 | progresso desconhecido vira 0 | KILLED |
| M02 | UNKNOWN exibido como "0%" | KILLED |
| M03 | 8999 conclui (limiar −1) | KILLED |
| M04 | abrir conclui | KILLED |
| M05 | URL `http:` aceita | KILLED |
| M06 | URL com credenciais aceita | KILLED |
| M07 | BLOCKED mantém status COMPLETED na trilha | KILLED |
| M08 | BLOCKED contável na trilha | KILLED |
| M09 | trilha fecha ignorando bloqueados | KILLED |
| M10 | versão da nota ignorada | KILLED |
| M11 | dono da nota ignorado | KILLED |
| M12 | nota sem limite | KILLED |
| M13 | CAS de progresso ignorado | KILLED (sobreviveu na 1ª rodada → teste adicionado) |
| M14 | ranking sem desempate (não determinístico) | KILLED |
| M15 | busca sensível a acento | KILLED |
| M16 | busca sem limite de tokens | KILLED |
| M17 | licença UNKNOWN renderiza | KILLED |
| M18 | licença expirada ignorada | KILLED |
| M19 | favorito não idempotente | KILLED |
| M20 | Continuar vaza dados de outro usuário | KILLED |
| M21 | tempo de aba vira tempo de estudo | KILLED |
| M22 | limiar 0 aceito | KILLED |
| M23 | duração desconhecida ordenada como 0 | KILLED |
| M24 | preferências de leitura sem limite | KILLED |

## 4. QA visual — 521 PASS · 0 FAIL · 45 NOT_RUN
`scripts/test-orcaly-academy-visual.mjs` (esbuild + Playwright, fora do Next; nenhuma rota criada). Resultado bruto: `evidence/ACADEMY_VISUAL_QA.json`.

- **20 views × 6 larguras** (320/390/768/1024/1440/1920): sem overflow horizontal, alvos ≥ 44px, sem erro de runtime; lint estático de a11y em 390 e 1440.
  Views: home, home vazia, biblioteca, biblioteca vazia, busca, sem resultados, trilha (inscrita com item bloqueado), trilha (não inscrita), leitor (artigo em trilha), lição manual, documento, vídeo, áudio, bloqueado LICENSED, bloqueado UNKNOWN, externo, notas, notas vazias, favoritos, favoritos vazios.
- **Comportamento:** ordem da Home; sem métricas de vaidade; ids de regra visíveis; notas demo rotuladas "Exemplo" e somente leitura; filtros E, ordenação por duração com desconhecidas no fim; busca sem acento/caixa com contagem anunciada; trilha com item bloqueado que não conta e não fecha; item travado sem link; leitor: serifada só no conteúdo, abrir não conclui, motivo do bloqueio da conclusão em texto, controles 14–24px e 1,4–2,0 com limites, largura, tema de leitura escopado, conclusão explícita após registrar leitura; nota criada a partir da seção com foco no editor; nota vazia rejeitada com alerta; **HTML em nota fica literal (nenhum elemento, nenhum script executa)**; texto da nota nunca na URL; edição com CAS; favorito alterna sem tocar progresso/notas; **nenhuma escrita em localStorage/sessionStorage**.
- **Mídia:** placeholder honesto (sem `<video>`, `<audio>`, `<iframe>`, `autoplay`), transcrição/legendas declaradas, conclusão desabilitada sem reprodução medida.
- **Licença:** bloqueados sem corpo, sem progresso de leitura, sem conclusão; conclusão antiga de item hoje bloqueado aparece como "Conclusão anterior · não conta"; link externo `https` + `noopener noreferrer` + aviso de nova aba.
- **Teclado/foco:** primeiro Tab = skip link visível; Enter leva foco ao `main`; anel de foco visível; todos os 13 cartões da biblioteca alcançáveis por teclado a 390px.
- **Layout:** notas empilhadas abaixo do artigo no mobile; painel lateral sticky no desktop; medida de leitura ≤ 40em; controles inline (nunca cobrem o texto).
- **Reduced motion:** transições de progresso colapsam.
- **Reflow/zoom:** 320px (≈ 400% de 1280) com texto do leitor em 24px, sem rolagem horizontal.
- **Dark:** Home, biblioteca, trilha, leitor e notas em dark do SO e dark forçado (fundo `rgb(14,22,32)`, superfícies de destaque escuras) + lint a11y no dark.
- **Axe:** `axe-core` não pôde ser instalado (registry npm bloqueado neste ambiente). O hook está pronto (`ORCALY_QA_AXE=<pacote axe-core>`); as 45 verificações ficam **NOT_RUN**, nunca contadas como PASS.

### Defeitos encontrados pelo QA e corrigidos
1. Pílula de licença longa (`nowrap` da Foundation) estourava a 320px → quebra permitida só dentro do Academy (`.badgeWrap`).
2. Nome acessível dos botões por seção saía "aqui : Limites" (span sr-only fora do fluxo) → `aria-label` igual ao texto visível + seção.
3. Item bloqueado com conclusão antiga aparecia como "Concluído" no leitor e na biblioteca → exibido como "Conclusão anterior · não conta"; registro preservado.
4. Leitor de item bloqueado mostrava "Leitura: 100%" → progresso de leitura só aparece para conteúdo legível.
5. Botão de conclusão desabilitado parecia habilitado (Foundation não estiliza `:disabled`) → estilo escopado ao Academy.
6. "Não" quebrava em "Nã/o" na lista de permissões a 390px → `flex: none`.
7. Busca exibia trilhas antes de conteúdos mais relevantes → ordem do ranqueador preservada.
8. Motivo de bloqueio da conclusão em jargão ("8200 bps") → "leitura registrada em 82%, abaixo do limiar de 90%".

### Capturas (evidence/)
`home-1440`, `home-390`, `home-dark-1440`, `empty-1024`, `library-1440`, `library-390`, `search-1024`, `noresults-390`, `track-experimentos-fundamentos-1440/390`, `read-boa-hipotese--experimentos-fundamentos-1440/390/dark-1440`, `reader-interacted-1440`, `reflow-320-font24`, `read-reserva-emergencia--financas-pessoais-768`, `read-metricas-basicas-1024`, `read-rotina-operacional-390`, `read-manual-indicadores-1024`, `read-guia-externo-golpes-390`, `notes-1440`, `bookmarks-390`, `notes-empty-768`.

## 5. Regressão
| Suíte | Resultado |
| --- | --- |
| Registry/Foundation domínio (`test-orcaly-next-registry.mjs`) | 17/17 PASS |
| Foundation visual (`orcaly-next-visual-qa.mjs`) | 112/112 PASS |
| Growth domínio (`test-orcaly-growth-domain.mjs`) | 14/14 PASS |
| Growth visual (`test-orcaly-growth-visual.mjs`) | 259/259 PASS |
| Ecosystem (`test-ecosystem.mjs`) | 51/51 PASS |

## 6. Typecheck / lint / build
- Typecheck local: `tsc` estrito (target ES2017 do projeto) sobre `lib/orcaly-next/academy/**` e `components/orcaly-next/academy/**` com shim de tipos React/Next (sem `node_modules`: registry bloqueado) → PASS.
- Typecheck real: build do Vercel Preview (`next build`, sem `ignoreBuildErrors`) — ver handoff.
- ESLint: NOT_RUN (dependências não instaláveis aqui).

## 7. Acessibilidade (resumo)
`article` semântico com `h1` único, hierarquia sem saltos, landmarks (`header`, `nav` rotulada, `main`, `aside` rotulado), skip link, sumário "Nesta leitura", foco visível, alvos ≥ 44px, nomes acessíveis, `aria-pressed` em favoritos, `role="status"`/`alert` para feedback, estados nunca só por cor (texto em todas as pílulas), sem autoplay, status de transcrição/legendas explícito, controles de fonte no leitor, reduced motion e reflow a 320px.

## 8. Limitações conhecidas
- Tudo em estado de componente: recarregar descarta notas, favoritos, progresso e preferências (intencional — sem persistência).
- Inscrição em trilha exibida como "não disponível" (depende da API).
- Link `?categoria=` de "Descobrir" ainda não pré-filtra (a rota não existe).
- Painel lateral do leitor rola internamente no desktop quando há muitas notas.
- Sem axe-core e sem ESLint neste ambiente.
- Nenhum teste com leitor de tela real (NVDA/VoiceOver) — recomendado antes de publicar.

## 9. Fronteira de copyright/licença
Nenhum conteúdo integral de terceiros. Todo texto foi escrito para a demo e marcado `sample: true` sob "DEMO / SAMPLE DATA". Itens de terceiro fictícios existem só para demonstrar bloqueio e não têm corpo. Link externo usa `example.org`. Busca indexa só metadados. IA desligada para todas as licenças. Detalhes: `ACADEMY_CONTENT_LICENSE_CONTRACT.md`.

## 10. Contratos
`ACADEMY_PERSISTENCE_CONTRACT.md` · `ACADEMY_CONTENT_LICENSE_CONTRACT.md` · `ACADEMY_API_CONTRACT.md` · `ACADEMY_ENTITLEMENT_CONTRACT.md` · `ACADEMY_PRIVACY_CONTRACT.md` · `ACADEMY_INTELLIGENCE_BOUNDARY.md` · `ACADEMY_OFFLINE_CONTRACT.md` · `ACADEMY_ROUTES.md`.

## 11. Bloqueios
1. Schema/owner das migrations e padrão de funções privadas (persistence contract).
2. Retenção de sessões/notas, exportação e consentimento para Intelligence — validação jurídica (LGPD).
3. Correção do deep link em `requireEcosystemIdentity` (A21) antes de publicar rotas.
4. axe-core/ESLint e leitor de tela real em ambiente com acesso ao registry.
5. Processo editorial de verificação de licença (quem pode marcar VERIFIED) — `academy.manage_content`.

## 12. Ordem de integração recomendada
1. Revisar/mergear Foundation → Growth → Academy (branches isoladas, sem conflito com runtime).
2. Migrations do catálogo (`academy_content_items`, `academy_content_bodies`, `academy_tracks`, `academy_track_items`) com função `academy_get_body` que reaplica a licença no servidor.
3. Migrations pessoais (`academy_progress`, `academy_notes`, `academy_bookmarks`, `academy_enrollments`, `academy_completion_events`, `academy_learning_sessions`) com RLS `user_id = auth.uid()`, CAS e idempotência.
4. Camada de API conforme `ACADEMY_API_CONTRACT.md`, reaproveitando as funções de domínio.
5. Entitlement `product.academy` + permissões; corrigir A21.
6. Montar rotas `/apps/academy/**` com as views prontas; remover `demoLabel`; registrar `navItems`.
7. Editorial: `academy.manage_content` e fluxo de verificação de licença.
8. Offline/PWA e Intelligence somente depois, pelos contratos.
