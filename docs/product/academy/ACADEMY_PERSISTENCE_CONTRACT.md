# Academy — Persistence Contract (proposta; NADA aplicado)

**Nenhuma migration, tabela, função, policy ou bucket foi criado.** Este documento é o handoff para o owner de migrations. Tipos de origem: `lib/orcaly-next/academy/types.ts`. Regras de domínio que o banco precisa espelhar: `core.ts`, `tracks.ts`, `progress.ts`, `notes.ts`.

## Separação fundamental: catálogo × dados pessoais

| Camada | Tabelas | Dono | Quem escreve | Quem lê |
| --- | --- | --- | --- | --- |
| **Catálogo editorial** | `academy_content_items`, `academy_tracks`, `academy_track_items` (+ `academy_content_bodies`) | Orçaly (editorial/publisher) | só `academy.manage_content` (admin editorial, **nunca** usuário comum) | qualquer usuário com `product.academy` + `academy.read`, apenas linhas `PUBLISHED`/`REVIEW-as-coming-soon` |
| **Dados pessoais** | `academy_enrollments`, `academy_progress`, `academy_learning_sessions`, `academy_notes`, `academy_bookmarks`, `academy_completion_events` | o próprio usuário (`user_id`) | o próprio usuário, via funções | **somente** o próprio usuário. Nem admin editorial, nem empresa, nem outro produto |

Scope do produto: `personal`. Não existe `company_id` em dado pessoal do Academy — Academy não é company-scoped e **não** herda visibilidade de Business/Growth.

## Princípios comuns
- **RLS habilitada em todas.** Padrão Wealth: `public` INVOKER → `private` DEFINER com `search_path` fixo → auth → entitlement `product.academy` ativo → permissão (`academy.read` / `academy.progress` / `academy.notes` / `academy.bookmarks`) → CAS → recibo idempotente.
- **Dados pessoais:** policy `user_id = auth.uid()` em SELECT/INSERT/UPDATE/DELETE; sem exceção para admin. Suporte técnico só por procedimento auditado fora do app (não definido — **bloqueio de produto/jurídico**).
- **Sem `service_role` no caminho do usuário.** Cross-product: **DENY BY DEFAULT** (Intelligence só com consentimento explícito — ver `ACADEMY_INTELLIGENCE_BOUNDARY.md`).
- **CAS:** `version bigint not null default 1`; mutações enviam `expected_version`; conflito → `PT409` (espelha `updateProgress`, `completeContent`, `updateNote`).
- **Idempotência:** mutações recebem `idempotency_key uuid`; `academy_idempotency_receipts (user_id, key, operation, response_hash, created_at)` unique `(user_id, key)`; retenção 7 dias.
- **Percentuais:** `integer` em basis points `check (between 0 and 10000)`. **NULL = desconhecido** (nunca 0 como substituto). Nada de `numeric`/`double` como fonte de verdade.
- **Texto do usuário:** `text` puro. Nunca HTML renderizado; validação de tamanho em code points e rejeição de caracteres de controle/bidi na função (espelha `normalizeNoteText`).
- **Audit:** `academy_audit (id, actor_id, entity, entity_id, action, before_version, after_version, at, request_id)` — **sem conteúdo de notas** no log; catálogo audita diffs de metadados e licença.
- **Deleção de conta:** apaga todos os dados pessoais do Academy em cascata (hard delete) e o cache offline é invalidado no próximo login (ver `ACADEMY_OFFLINE_CONTRACT.md`).

---

## academy_content_items (catálogo)
| Campo | Tipo | Regra |
| --- | --- | --- |
| id | text pk | `^[a-z0-9][a-z0-9-]{0,63}$` (slug estável, usado em rota) |
| type | text | check in (ARTICLE, LESSON, VIDEO, AUDIO, DOCUMENT, COURSE) |
| title | text not null | 3–160 |
| subtitle | text null | ≤ 240 |
| author_id | uuid null fk academy_authors | NULL = autoria não informada (nunca inventar) |
| source_type | text | check in (ORCALY_ORIGINAL, PUBLISHER, USER, EXTERNAL) |
| source_label | text not null | |
| canonical_url | text null | check `^https://` + validação de função (sem credenciais) |
| license_type | text not null | check in (ORIGINAL, PUBLIC_DOMAIN, LICENSED, USER_PROVIDED, EXTERNAL_LINK, UNKNOWN) |
| license_status | text not null | check in (VERIFIED, DECLARED, NOT_VERIFIED, EXPIRED, NOT_APPLICABLE) |
| rights_holder | text null | |
| license_verified_at / license_expires_at | timestamptz null | |
| license_evidence | text null | referência a contrato/prova — nunca o contrato em si |
| publication | text not null | check in (DRAFT, REVIEW, PUBLISHED, ARCHIVED, BLOCKED_LICENSE) |
| duration_value | integer null check (> 0) | segundos (mídia) ou minutos (leitura); NULL = não declarada |
| pages | integer null check (> 0) | documentos |
| language | text not null | BCP-47 |
| categories | text[] | ≤ 5 |
| tags | text[] | ≤ 12 |
| completion_kind | text | check in (MANUAL, READING_THRESHOLD, PLAYBACK_THRESHOLD, ALL_REQUIRED_ITEMS) |
| completion_threshold_bps | integer null | obrigatório (check) para *_THRESHOLD, `between 1 and 10000` (0 proibido: equivaleria a concluir ao abrir) |
| media_state / transcript_status / captions_status | text null | enums de `MediaInfo` |
| published_at | timestamptz null | |
| sample | boolean not null default false | conteúdo de demonstração; **nunca** em produção |
| version, created_by, updated_by, created_at, updated_at | | |

Índices: `(publication, published_at desc)`, GIN em `categories`, `tags`; índice de busca em metadados (`tsvector` gerado de title/subtitle/author/categorias/tags — **nunca** do corpo protegido). RLS: SELECT para `academy.read` quando `publication in ('PUBLISHED','REVIEW','ARCHIVED','BLOCKED_LICENSE')` (metadados); `DRAFT` só para `academy.manage_content`. Escrita só `academy.manage_content`.

## academy_content_bodies (corpo — separado dos metadados)
`content_id text pk fk`, `sections jsonb` (array `{anchor, heading, paragraphs[]}`, anchors únicos `^[a-z][a-z0-9-]{0,63}$`), `version`, `updated_at`. **SELECT só via função** `private.academy_get_body(content_id)` que reaplica `permittedActions` no servidor: sem `render_full_content` → retorna `BLOCKED_LICENSE` e nenhum texto. Isso impede que um cliente leia o corpo de conteúdo bloqueado direto da tabela.

## academy_tracks / academy_track_items (catálogo)
`academy_tracks`: `id text pk`, `title`, `description`, `estimated_minutes integer null` (NULL = não informada), `publication`, `categories text[]`, `sample`, `version`, timestamps.
`academy_track_items`: `track_id fk`, `content_id fk`, `position smallint check (>= 0)`, `required boolean`, `prerequisites text[]`. PK `(track_id, content_id)`; unique `(track_id, position)`. Máx. 100 itens (trigger). Publicar trilha exige: ≥ 1 item obrigatório, pré-requisitos dentro da trilha, **sem ciclo** (função de validação espelhando `validateTrack`/`findPrerequisiteCycle`, chamada no trigger de `publication → PUBLISHED`).

## academy_enrollments (pessoal)
`user_id uuid`, `track_id text fk`, `status text check in (ACTIVE, PAUSED, COMPLETED)`, `enrolled_at`, `version`. PK `(user_id, track_id)`. Idempotente (inscrever de novo = no-op). Retenção: vida da conta.

## academy_progress (pessoal)
| Campo | Tipo | Regra |
| --- | --- | --- |
| user_id, content_id | pk composta | |
| status | text | check in (NOT_STARTED, IN_PROGRESS, COMPLETED) |
| started_at, last_seen_at, completed_at | timestamptz null | `completed_at` obrigatório sse COMPLETED (check) |
| position_kind | text null | ANCHOR / SECONDS / PAGE |
| position_anchor / position_seconds / position_page | | um só preenchido (check); validado contra corpo/duração/páginas conhecidas na função |
| progress_bps | integer null check (0..10000) | NULL = desconhecido |
| version | bigint | CAS |

Regras (função `private.academy_update_progress`): nunca muda status para COMPLETED; posição inválida → erro; `progress_bps` só inteiro. **Conclusão só por** `private.academy_complete_content`, que reavalia disponibilidade/licença e política no servidor e grava `academy_completion_events` na mesma transação. Progresso de item hoje bloqueado permanece armazenado, mas **não conta** para trilha (cálculo em leitura, igual a `trackItemViews`).

## academy_learning_sessions (pessoal)
`id uuid pk`, `user_id`, `content_id`, `started_at`, `ended_at null check (>= started_at)`, `active_seconds integer null check (0..86400)` — **NULL salvo medição confiável** (aba aberta não é estudo), `resume jsonb null`, `completion text check in (NONE, COMPLETED)`. Retenção: 180 dias (agregados anônimos não são produzidos no MVP). Sem ranking, sem "horas estudadas" exibidas como métrica de vaidade.

## academy_notes (pessoal)
`id uuid pk`, `user_id`, `content_id`, `anchor text null`, `seconds integer null` (exclusivos; check), `text text not null` (1–4000 code points; validado em função), `version`, `created_at`, `updated_at`, `deleted_at null`. Índices: `(user_id, updated_at desc)`, `(user_id, content_id)`. **Nunca** exposta por URL pública; rotas levam só `id`. Sem compartilhamento no MVP. Retenção: até o usuário apagar; soft delete 30 dias → hard delete.

## academy_bookmarks (pessoal)
`id uuid pk`, `user_id`, `content_id`, `target_kind text check in (CONTENT, ANCHOR, SECONDS)`, `target_anchor`, `target_seconds`, `created_at`. Unique `(user_id, content_id, target_kind, coalesce(target_anchor,''), coalesce(target_seconds,-1))` → **idempotente** (espelha `bookmarkKey`). Deletar favorito não toca progress/notes/events (sem FK em cascata entre eles).

## academy_completion_events (pessoal, append-only)
`id uuid pk`, `user_id`, `content_id`, `policy text`, `evidence text` (regra que permitiu), `at`, `idempotency_key`. Sem UPDATE/DELETE pelo usuário (exceto deleção de conta). É o histórico que sustenta "concluído em".

## Blockers de persistência
1. Owner de migrations precisa decidir o schema (`public` vs `academy`) e o mecanismo de função privada (padrão Wealth).
2. Política de retenção de sessões/notas precisa de validação jurídica (LGPD).
3. Procedimento de suporte a dados pessoais sem violar "admin não lê notas" não está definido.
