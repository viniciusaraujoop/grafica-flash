# Academy — Rotas futuras (NÃO publicadas)

Nenhum arquivo em `app/**` foi criado ou alterado. As views de página já existem em `components/orcaly-next/academy/` e só precisam ser montadas quando a integração for autorizada.

| Rota futura | View pronta | Observações |
| --- | --- | --- |
| `/apps/academy` | `AcademyHome` | Continuar → Trilhas em andamento → Biblioteca → Notas recentes → Descobrir |
| `/apps/academy/biblioteca` | `AcademyLibraryPage` | `?categoria=<id>` (links de "Descobrir") deve virar `initialFilter.category` — validar com `isSafeId` |
| `/apps/academy/trilhas/[id]` | `AcademyTrackPage` | `id` validado (`trackHref` só gera ids seguros); trilha não publicada → estado "não encontrada" |
| `/apps/academy/ler/[id]` | `AcademyReadPage` | `?trilha=<id>` opcional → `trackId` (navegação de lição); âncora `#secao` para retomar |
| `/apps/academy/notas` | `AcademyNotesPage` | `#nota-<id>` — só id, nunca texto |
| `/apps/academy/favoritos` | `AcademyBookmarksPage` | |

## Requisitos antes de publicar
1. Layout server-side com `requireEcosystemIdentity` **preservando deep link** (achado A21 da Foundation).
2. Entitlement `product.academy` + permissões (ver `ACADEMY_ENTITLEMENT_CONTRACT.md`); sem entitlement → landing, nunca rota interna.
3. Dados vindos da camada de API (`ACADEMY_API_CONTRACT.md`) no lugar de `demo-data.ts`; remover `demoLabel` quando os dados forem reais.
4. `ReaderView`, `AcademyLibrary`, `NotesPanel`, `NoteEditor`, `BookmarksPanel`, `ReadingControls`, `AcademySearch`, `LibraryFilters` são `'use client'`; o resto é server-safe.
5. Registrar a navegação do Academy no registry (`navItems`) só depois que as rotas existirem, para a Command Palette não expor destino inexistente.
