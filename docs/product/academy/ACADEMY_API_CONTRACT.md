# Academy — API Contract (proposta; nenhum route handler criado)

Nenhuma rota `app/**` foi criada. Este contrato descreve as operações que a camada de dados deve expor (Server Actions ou funções RPC). Toda operação: autenticação → entitlement `product.academy` ativo → permissão → validação de domínio (mesmas funções de `lib/orcaly-next/academy/**`) → CAS/idempotência → resposta. Erros usam códigos estáveis; mensagens em pt-BR sem dados pessoais.

| Código | Quando |
| --- | --- |
| `UNAUTHENTICATED` 401 | sem sessão |
| `NOT_ENTITLED` 403 | sem `product.academy` |
| `FORBIDDEN` 403 | sem a permissão da operação |
| `NOT_FOUND` 404 | item inexistente **ou** de outro usuário (não revelar existência) |
| `VERSION_CONFLICT` 409 | `expected_version` ≠ atual |
| `INVALID_INPUT` 422 | validação de domínio (com `field`) |
| `NOT_ALLOWED` 422 | regra de negócio (ex.: concluir abaixo do limiar, conteúdo bloqueado) |
| `LICENSE_BLOCKED` 451 | corpo pedido sem direito de exibição |

## Catálogo (permissão `academy.read`)
- **listContent** `({ filter: LibraryFilter, cursor?, limit ≤ 50 })` → `{ rows: LibraryRow[] (metadados + availability + status do próprio usuário), nextCursor }`. Nunca retorna `DRAFT`. Ordenação estável (`filterLibrary`).
- **getContent** `({ id })` → metadados + `availability` + `permittedActions` + `sections` **somente se** `renderFullContent`; caso contrário `sections: null` e `availability` explicativa. Nunca 200 com corpo de item bloqueado.
- **search** `({ query ≤ 100 chars, ≤ 8 tokens, limit ≤ 100 })` → `SearchHit[]` (metadados; `searchLibrary`, determinística). Sem IA, sem provedor.
- **getTrack** `({ id })` → trilha publicada + itens em ordem + `TrackItemView` do usuário + `TrackProgressSummary`.

## Pessoais
| Operação | Permissão | Entrada | Regras |
| --- | --- | --- | --- |
| **enrollTrack** | `academy.progress` | `{ trackId, idempotencyKey }` | só PUBLISHED; idempotente |
| **getProgress** | `academy.progress` | `{ contentId }` | retorna `emptyProgress` (UNKNOWN) se inexistente — nunca 0% |
| **updateProgress** | `academy.progress` | `{ contentId, expectedVersion, progressBps?, position?, idempotencyKey }` | `updateProgress`; **nunca conclui** |
| **completeContent** | `academy.progress` | `{ contentId, expectedVersion, idempotencyKey }` | `completeContent` no servidor com disponibilidade recalculada; grava evento |
| **recordLearningSession** | `academy.progress` | `{ contentId, startedAt, endedAt?, activeSeconds?, resume?, idempotencyKey }` | `activeSeconds` só se medido; senão NULL |
| **listNotes** | `academy.notes` | `{ contentId?, cursor?, limit ≤ 50 }` | só do próprio usuário |
| **createNote** | `academy.notes` | `{ contentId, text, anchor?, seconds?, idempotencyKey }` | `createNote` (1–4000, sem controle/bidi, alvo válido) |
| **updateNote** | `academy.notes` | `{ id, text, expectedVersion }` | `updateNote` (dono + CAS) |
| **deleteNote** | `academy.notes` | `{ id, expectedVersion }` | soft delete; não toca progresso/favoritos |
| **listBookmarks** | `academy.bookmarks` | `{ cursor?, limit ≤ 50 }` | só do próprio usuário |
| **createBookmark** | `academy.bookmarks` | `{ contentId, target }` | idempotente (`addBookmark`) — replay retorna o existente com `created:false` |
| **deleteBookmark** | `academy.bookmarks` | `{ id }` | remove só o favorito (`removeBookmark`) |

## Editorial (futuro; `academy.manage_content`, não usuário comum)
`upsertContent`, `setLicense`, `publishContent`, `upsertTrack`, `publishTrack` (valida `validateTrack`; recusa ciclo, trilha vazia, posição duplicada/negativa). Toda mudança de licença é auditada.

## Proibições
- Texto de nota nunca em query string, path ou log. URLs carregam só ids (`noteHref`).
- Nenhuma operação aceita `user_id` do cliente: sempre `auth.uid()`.
- Nenhuma operação retorna dados pessoais de outro usuário, nem de outro produto.
