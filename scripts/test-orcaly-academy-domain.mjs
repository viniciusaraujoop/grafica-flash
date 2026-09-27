import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import path from 'node:path'

const hook = registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('./') && !path.extname(specifier) && context.parentURL?.includes('/lib/orcaly-next/')) return next(new URL(`${specifier}.ts`, context.parentURL).href, context)
    return next(specifier, context)
  },
})
const core = await import('../lib/orcaly-next/academy/core.ts')
const tracks = await import('../lib/orcaly-next/academy/tracks.ts')
const progress = await import('../lib/orcaly-next/academy/progress.ts')
const notes = await import('../lib/orcaly-next/academy/notes.ts')
const search = await import('../lib/orcaly-next/academy/search.ts')
const cont = await import('../lib/orcaly-next/academy/continue.ts')
const library = await import('../lib/orcaly-next/academy/library.ts')
const demo = await import('../lib/orcaly-next/academy/demo-data.ts')
hook.deregister()

const NOW = demo.ACADEMY_DEMO_NOW
const clone = (v) => structuredClone(v)
const byId = (id) => clone(demo.demoItems.find((item) => item.id === id))
const license = (type, status, extra = {}) => ({ type, status, rightsHolder: null, verifiedAt: null, expiresAt: null, evidence: null, ...extra })

test('progress: real 0 vs UNKNOWN vs NOT_APPLICABLE are distinct and never shown as 0%', () => {
  assert.equal(core.formatBpsPercent(core.known(0)), '0%')
  assert.equal(core.formatBpsPercent(core.unknown('x')), 'Progresso desconhecido')
  assert.equal(core.formatBpsPercent(core.NOT_APPLICABLE), 'Não se aplica')
  assert.equal(core.formatBpsPercent(core.known(5000)), '50%'); assert.equal(core.formatBpsPercent(core.known(5050)), '50,5%'); assert.equal(core.formatBpsPercent(core.known(5005)), '50,05%')
  const opened = progress.openContent(progress.emptyProgress('boa-hipotese', 'u'), NOW)
  assert.equal(opened.progress.kind, 'UNKNOWN') // opening measures nothing
  assert.equal(core.formatDuration(core.unknown('x'), 'minutes'), 'Duração não informada')
  assert.equal(core.formatDuration(core.known(600), 'seconds'), '10 min'); assert.equal(core.formatDuration(core.known(95), 'seconds'), '1 min 35 s'); assert.equal(core.formatDuration(core.known(0), 'seconds'), '0 s')
  const empty = tracks.trackProgress([])
  assert.equal(empty.progress.kind, 'UNKNOWN')
  const real0 = tracks.trackProgress(tracks.trackItemViews(demo.demoTracks[1], demo.demoItems, [], NOW))
  assert.deepEqual(real0.progress, { kind: 'KNOWN', value: 0 })
})

test('basis points: only integers 0..10000', () => {
  for (const ok of [0, 1, 8999, 9000, 10000]) assert.equal(core.parseBps('x', ok), ok)
  for (const bad of [-1, 10001, 0.5, 50.5, NaN, Infinity, '5000', null, undefined, 1e20]) assert.throws(() => core.parseBps('x', bad), core.AcademyInputError, String(bad))
  const item = byId('boa-hipotese')
  const r = progress.updateProgress(item, progress.emptyProgress(item.id, 'u'), { expectedVersion: 0, at: NOW, progressBps: 0.9 })
  assert.equal(r.ok, false); assert.equal(r.code, 'INVALID_PROGRESS')
  assert.equal(progress.validateCompletionPolicy({ kind: 'READING_THRESHOLD', thresholdBps: 10001 }) !== null, true)
  assert.equal(progress.validateCompletionPolicy({ kind: 'READING_THRESHOLD', thresholdBps: 0 }) !== null, true)
  assert.equal(progress.validateCompletionPolicy({ kind: 'READING_THRESHOLD', thresholdBps: 9000 }), null)
})

test('completion boundary: 8999 does not complete, 9000 does; completion is explicit', () => {
  const item = byId('boa-hipotese') // READING_THRESHOLD 9000
  const at = (bps) => ({ ...progress.emptyProgress(item.id, 'u'), status: 'IN_PROGRESS', progress: core.known(bps), version: 3 })
  assert.equal(progress.canComplete(item, at(8999), 'AVAILABLE').allowed, false)
  assert.equal(progress.canComplete(item, at(9000), 'AVAILABLE').allowed, true)
  const r1 = progress.completeContent(item, at(8999), { expectedVersion: 3, at: NOW, availability: 'AVAILABLE', eventId: 'e' })
  assert.equal(r1.ok, false); assert.equal(r1.code, 'NOT_ALLOWED')
  const r2 = progress.completeContent(item, at(9000), { expectedVersion: 3, at: NOW, availability: 'AVAILABLE', eventId: 'e' })
  assert.equal(r2.ok, true); assert.equal(r2.progress.status, 'COMPLETED'); assert.equal(r2.event.policy, 'READING_THRESHOLD'); assert.match(r2.event.evidence, /9000/)
  const unknownProgress = { ...at(0), progress: core.unknown('x') }
  assert.equal(progress.canComplete(item, unknownProgress, 'AVAILABLE').allowed, false)
  const video = byId('metricas-basicas') // PLAYBACK 9000
  assert.equal(progress.canComplete(video, { ...at(8999), contentId: video.id }, 'AVAILABLE').allowed, false)
  assert.equal(progress.canComplete(video, { ...at(9000), contentId: video.id }, 'AVAILABLE').allowed, true)
  assert.equal(progress.completeContent(item, at(9500), { expectedVersion: 2, at: NOW, availability: 'AVAILABLE', eventId: 'e' }).code, 'VERSION_CONFLICT')
})

test('no auto-completion on open, on updates, or at 100% measured progress', () => {
  const item = byId('boa-hipotese')
  let p = progress.openContent(progress.emptyProgress(item.id, 'u'), NOW)
  assert.equal(p.status, 'IN_PROGRESS'); assert.equal(p.completedAt, null)
  p = progress.openContent(p, NOW)
  assert.equal(p.status, 'IN_PROGRESS')
  const r = progress.updateProgress(item, p, { expectedVersion: p.version, at: NOW, progressBps: 10000 })
  assert.equal(r.ok, true); assert.equal(r.progress.status, 'IN_PROGRESS'); assert.equal(r.progress.completedAt, null)
  // CAS on progress updates: a stale version (another device) is rejected and nothing changes.
  const stale = progress.updateProgress(item, r.progress, { expectedVersion: p.version, at: NOW, progressBps: 5000 })
  assert.equal(stale.ok, false); assert.equal(stale.code, 'VERSION_CONFLICT')
  assert.equal(r.progress.version, p.version + 1)
  const manual = byId('senhas-duas-etapas')
  assert.equal(progress.openContent(progress.emptyProgress(manual.id, 'u'), NOW).status, 'IN_PROGRESS')
  const done = { ...progress.emptyProgress(manual.id, 'u'), status: 'COMPLETED', completedAt: 'x' }
  assert.equal(progress.openContent(done, NOW).status, 'COMPLETED') // reopening never un-completes either
})

test('resume position: negative, beyond duration/pages, wrong kind and missing anchors are rejected', () => {
  const video = byId('metricas-basicas') // 600 s
  const doc = byId('checklist-seguranca') // 4 pages
  const article = byId('boa-hipotese')
  assert.equal(progress.validatePosition(video, { kind: 'SECONDS', seconds: 0 }), null)
  assert.equal(progress.validatePosition(video, { kind: 'SECONDS', seconds: 600 }), null)
  assert.ok(progress.validatePosition(video, { kind: 'SECONDS', seconds: -1 }))
  assert.ok(progress.validatePosition(video, { kind: 'SECONDS', seconds: 601 }))
  assert.ok(progress.validatePosition(video, { kind: 'SECONDS', seconds: 10.5 }))
  assert.ok(progress.validatePosition(video, { kind: 'ANCHOR', anchor: 'x' }))
  assert.equal(progress.validatePosition(doc, { kind: 'PAGE', page: 4 }), null)
  assert.ok(progress.validatePosition(doc, { kind: 'PAGE', page: 5 })); assert.ok(progress.validatePosition(doc, { kind: 'PAGE', page: 0 }))
  assert.equal(progress.validatePosition(article, { kind: 'ANCHOR', anchor: 'criterio' }), null)
  assert.ok(progress.validatePosition(article, { kind: 'ANCHOR', anchor: 'nao-existe' }))
  for (const bad of ['Criterio', '../x', 'a b', '<script>', 'x'.repeat(65), '#x']) assert.ok(progress.validatePosition(article, { kind: 'ANCHOR', anchor: bad }), bad)
  const unknownDuration = byId('rotina-operacional') // duration UNKNOWN: any non-negative integer is accepted
  assert.equal(progress.validatePosition(unknownDuration, { kind: 'SECONDS', seconds: 99999 }), null)
  const r = progress.updateProgress(video, progress.emptyProgress(video.id, 'u'), { expectedVersion: 0, at: NOW, position: { kind: 'SECONDS', seconds: 700 } })
  assert.equal(r.ok, false); assert.equal(r.code, 'INVALID_POSITION')
})

test('tracks: duplicate items/positions, negative positions, cycles and empty published tracks are rejected', () => {
  const t = clone(demo.demoTracks[1])
  const codes = (mutate) => { const copy = clone(t); mutate(copy); return tracks.validateTrack(copy, demo.demoItems).map((i) => i.code) }
  assert.deepEqual(tracks.validateTrack(t, demo.demoItems), [])
  assert.ok(codes((c) => { c.items[1].position = 0 }).includes('DUPLICATE_POSITION'))
  assert.ok(codes((c) => { c.items.push({ ...c.items[0], position: 9 }) }).includes('DUPLICATE_ITEM'))
  assert.ok(codes((c) => { c.items[0].position = -1 }).includes('NEGATIVE_POSITION'))
  assert.ok(codes((c) => { c.items[0].position = 1.5 }).includes('NEGATIVE_POSITION'))
  assert.ok(codes((c) => { c.items[0].prerequisites = ['controle-variante'] }).includes('PREREQUISITE_CYCLE'))
  assert.ok(codes((c) => { c.items[0].prerequisites = ['metricas-basicas']; c.items[2].prerequisites = ['controle-variante'] }).includes('PREREQUISITE_CYCLE')) // 3-cycle
  assert.ok(codes((c) => { c.items[0].prerequisites = ['boa-hipotese'] }).includes('SELF_PREREQUISITE'))
  assert.ok(codes((c) => { c.items[0].prerequisites = ['senhas-duas-etapas'] }).includes('FOREIGN_PREREQUISITE'))
  assert.ok(codes((c) => { c.items = [] }).includes('EMPTY_PUBLISHED'))
  assert.deepEqual(codes((c) => { c.items = []; c.publication = 'DRAFT' }), [])
  assert.ok(codes((c) => { c.items[0].contentId = 'fantasma' }).includes('UNKNOWN_CONTENT'))
  assert.ok(codes((c) => { c.items.forEach((i) => { i.required = false }) }).includes('NO_REQUIRED_ITEMS'))
  assert.equal(tracks.findPrerequisiteCycle([{ contentId: 'a', position: 0, required: true, prerequisites: ['b'] }, { contentId: 'b', position: 1, required: true, prerequisites: [] }]), null)
  for (const track of demo.demoTracks) assert.deepEqual(tracks.validateTrack(track, demo.demoItems), [], track.id)
})

test('licensing: blocked, unknown and expired licenses fail closed; blocked items never count as completed', () => {
  assert.equal(core.permittedActions(license('UNKNOWN', 'NOT_VERIFIED'), NOW).renderFullContent, false)
  assert.equal(core.permittedActions(license('UNKNOWN', 'VERIFIED'), NOW).renderFullContent, false) // UNKNOWN can never be "verified" into rendering
  assert.equal(core.permittedActions(license('LICENSED', 'DECLARED'), NOW).renderFullContent, false)
  assert.equal(core.permittedActions(license('LICENSED', 'VERIFIED', { expiresAt: '2026-09-01T00:00:00-03:00' }), NOW).renderFullContent, false)
  assert.equal(core.permittedActions(license('LICENSED', 'EXPIRED'), NOW).renderFullContent, false)
  assert.equal(core.permittedActions(license('PUBLIC_DOMAIN', 'DECLARED'), NOW).renderFullContent, false)
  assert.equal(core.permittedActions(license('ORIGINAL', 'NOT_VERIFIED'), NOW).renderFullContent, false)
  assert.equal(core.permittedActions(license('EXTERNAL_LINK', 'NOT_APPLICABLE'), NOW).renderFullContent, false)
  const lic = core.permittedActions(license('LICENSED', 'VERIFIED'), NOW)
  assert.equal(lic.renderFullContent, true); assert.equal(lic.offlineCache, false); assert.equal(lic.summarizeWithAi, false); assert.equal(lic.download, false)
  for (const type of ['ORIGINAL', 'PUBLIC_DOMAIN', 'LICENSED', 'USER_PROVIDED', 'EXTERNAL_LINK', 'UNKNOWN']) for (const status of ['VERIFIED', 'DECLARED', 'NOT_VERIFIED', 'EXPIRED', 'NOT_APPLICABLE']) assert.equal(core.permittedActions(license(type, status), NOW).summarizeWithAi, false, `${type}/${status}`)
  assert.equal(core.deriveAvailability(byId('manual-indicadores'), NOW), 'BLOCKED_LICENSE')
  assert.equal(core.deriveAvailability(byId('apostila-sem-origem'), NOW), 'BLOCKED_LICENSE')
  // stale COMPLETED progress on a blocked required item: excluded, reported, track stays open
  const views = tracks.trackItemViews(demo.demoTracks[1], demo.demoItems, demo.demoProgress, NOW)
  const blocked = views.find((v) => v.item.contentId === 'manual-indicadores')
  assert.equal(blocked.status, 'NOT_STARTED'); assert.equal(blocked.countable, false)
  const all = demo.demoTracks[1].items.map((i) => ({ ...progress.emptyProgress(i.contentId, 'u'), status: 'COMPLETED' }))
  const summary = tracks.trackProgress(tracks.trackItemViews(demo.demoTracks[1], demo.demoItems, all, NOW))
  assert.equal(summary.completedRequired, 3); assert.equal(summary.totalRequired, 3); assert.equal(summary.excludedUnavailable, 1); assert.equal(summary.complete, false)
  assert.equal(progress.canComplete(byId('manual-indicadores'), progress.emptyProgress('manual-indicadores', 'u'), 'BLOCKED_LICENSE').allowed, false)
})

test('unsafe external URLs are rejected; external-only needs a safe canonical link', () => {
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'http://example.org', 'https://u:p@example.org', 'https://localhost/x', '//example.org', 'https://exa mple.org', 'https://example.org/\u0000', 42, null, `https://example.org/${'a'.repeat(2100)}`]) assert.equal(core.safeExternalUrl(bad), null, String(bad))
  assert.equal(core.safeExternalUrl('https://example.org/guia-demo'), 'https://example.org/guia-demo')
  const ext = byId('guia-externo-golpes')
  assert.equal(core.deriveAvailability(ext, NOW), 'EXTERNAL_ONLY')
  ext.source.canonicalUrl = 'javascript:alert(1)'
  assert.equal(core.deriveAvailability(ext, NOW), 'UNAVAILABLE')
  assert.equal(library.readHref('../etc'), null); assert.equal(library.trackHref('Trilha X'), null)
  assert.equal(library.readHref('boa-hipotese', 'criterio'), '/apps/academy/ler/boa-hipotese#criterio')
  assert.equal(library.readHref('boa-hipotese', 'javascript:x'), '/apps/academy/ler/boa-hipotese')
})

test('unknown license, author and duration stay unknown in demo data (nothing invented)', () => {
  const unknownLicense = byId('apostila-sem-origem')
  assert.equal(unknownLicense.license.type, 'UNKNOWN'); assert.equal(unknownLicense.author, null); assert.equal(unknownLicense.pages.kind, 'UNKNOWN')
  assert.equal(byId('rotina-operacional').duration.kind, 'UNKNOWN')
  for (const item of demo.demoItems) {
    assert.equal(item.sample, true, item.id)
    if (item.license.type !== 'ORIGINAL') assert.equal(item.sections, null, `${item.id}: non-original items carry no full text`)
    if (item.sections) for (const section of item.sections) for (const paragraph of section.paragraphs) assert.ok(paragraph.length < 400, 'demo paragraphs are short original text')
  }
})

test('notes: bounds, control characters, raw HTML kept as text, CAS versioning and owner check', () => {
  const item = byId('boa-hipotese')
  const make = (text, extra = {}) => notes.createNote(item, { id: 'n', userId: 'u', text, at: NOW, ...extra })
  assert.equal(make('').code, 'EMPTY'); assert.equal(make('   \n ').code, 'EMPTY')
  assert.equal(make('a'.repeat(4000)).ok, true); assert.equal(make('a'.repeat(4001)).code, 'TOO_LONG')
  assert.equal(make('😀'.repeat(4000)).ok, true) // counted by code points, not UTF-16 units
  assert.equal(make('ok\u0000').code, 'CONTROL_CHARS'); assert.equal(make('ok‮').code, 'CONTROL_CHARS')
  const html = make('<img src=x onerror=alert(1)> <b>negrito</b>')
  assert.equal(html.ok, true); assert.equal(html.note.text, '<img src=x onerror=alert(1)> <b>negrito</b>') // stored literally; rendered as text node
  assert.equal(make('texto', { anchor: 'nao-existe' }).code, 'BAD_TARGET'); assert.equal(make('texto', { anchor: 'criterio', seconds: 3 }).code, 'BAD_TARGET')
  assert.equal(make('texto', { seconds: 10 }).code, 'BAD_TARGET') // seconds only for media
  const created = make('primeira versão', { anchor: 'criterio' }).note
  assert.equal(created.version, 1); assert.equal(created.sample, false)
  const updated = notes.updateNote(created, { userId: 'u', text: 'segunda', expectedVersion: 1, at: NOW })
  assert.equal(updated.ok, true); assert.equal(updated.note.version, 2)
  assert.equal(notes.updateNote(updated.note, { userId: 'u', text: 'stale', expectedVersion: 1, at: NOW }).code, 'VERSION_CONFLICT')
  assert.equal(notes.updateNote(updated.note, { userId: 'other', text: 'x', expectedVersion: 2, at: NOW }).code, 'NOT_OWNER')
  assert.equal(notes.noteHref(updated.note), '/apps/academy/notas#nota-n'); assert.ok(!notes.noteHref(updated.note).includes('segunda'))
  for (const note of demo.demoNotes) { assert.equal(note.sample, true); assert.match(note.text, /^Exemplo de nota:/) }
})

test('bookmarks: idempotent add; removal leaves progress, notes and other bookmarks intact', () => {
  const item = byId('boa-hipotese')
  const base = { id: 'b1', userId: 'u', target: { kind: 'ANCHOR', anchor: 'limites' }, createdAt: NOW }
  const first = notes.addBookmark([], item, base)
  assert.equal(first.created, true)
  const again = notes.addBookmark(first.list, item, { ...base, id: 'b2', createdAt: 'later' })
  assert.equal(again.created, false); assert.equal(again.list.length, 1); assert.equal(again.bookmark.id, 'b1')
  const content = notes.addBookmark(again.list, item, { id: 'b3', userId: 'u', target: { kind: 'CONTENT' }, createdAt: NOW })
  assert.equal(content.list.length, 2)
  assert.equal(notes.addBookmark([], item, { ...base, target: { kind: 'ANCHOR', anchor: 'nao-existe' } }).ok, false)
  assert.equal(notes.addBookmark([], item, { ...base, target: { kind: 'SECONDS', seconds: 5 } }).ok, false)
  const state = clone(demo.demoState)
  const before = { progress: JSON.stringify(state.progress), notes: JSON.stringify(state.notes) }
  const after = notes.removeBookmark(state.bookmarks, 'fav-hipotese-limites', demo.DEMO_USER)
  assert.equal(after.length, 1); assert.equal(JSON.stringify(state.progress), before.progress); assert.equal(JSON.stringify(state.notes), before.notes)
  assert.equal(notes.removeBookmark(state.bookmarks, 'fav-hipotese-limites', 'intruso').length, 2) // cannot remove someone else's
})

test('search: case/accent-insensitive, bounded, metadata-only, deterministic, duplicates handled', () => {
  const docs = search.toSearchDocuments(demo.demoItems, demo.demoTracks, demo.demoCategories)
  const index = search.buildSearchIndex(docs)
  const ids = (q) => search.searchLibrary(index, q).map((h) => h.document.id)
  assert.deepEqual(ids('METRICAS'), ids('métricas')); assert.deepEqual(ids('  Métricas  '), ids('metricas'))
  assert.equal(ids('senha')[0], 'senhas-duas-etapas')
  assert.deepEqual(ids(''), []); assert.deepEqual(ids('!!!'), []); assert.deepEqual(ids('zzzqqq'), [])
  assert.equal(search.normalizeQuery('a'.repeat(500)).join('').length, 100)
  assert.equal(search.normalizeQuery('a b c d e f g h i j k').length, 8)
  assert.deepEqual(search.normalizeQuery('<script>alert(1)</script>'), ['script', 'alert', '1', 'script'])
  // metadata only: words that exist only inside article paragraphs are not searchable
  assert.deepEqual(ids('calendario'), []); assert.deepEqual(ids('precisão excessiva'), [])
  for (const q of ['o', 'segurança', 'experimentos métricas', 'reserva']) assert.deepEqual(search.searchLibrary([...index].reverse(), q).map((h) => h.document.id), ids(q), q)
  assert.deepEqual(ids('experimentos métricas').length > 0, true)
  assert.equal(search.buildSearchIndex([...docs, ...docs]).length, docs.length) // identical duplicates collapse
  const conflicting = [...docs, { ...docs[0], title: 'outro título' }]
  assert.throws(() => search.buildSearchIndex(conflicting), search.DuplicateSearchDocumentError)
})

test('continue learning: priority order, rules explained, unavailable content excluded', () => {
  const list = cont.buildContinueLearning(demo.demoState, NOW)
  assert.deepEqual(list.map((i) => `${i.ruleId}:${i.content.id}`), ['CONTINUE_IN_PROGRESS:boa-hipotese', 'CONTINUE_IN_PROGRESS:reserva-emergencia', 'RESUME_BOOKMARK:checklist-seguranca'])
  for (const item of list) { assert.ok(item.reason.length > 10); assert.ok(item.source) }
  // with no in-progress items, next track units come before bookmarks
  const noProgress = { ...clone(demo.demoState), progress: demo.demoProgress.filter((p) => p.status === 'COMPLETED') }
  assert.deepEqual(cont.buildContinueLearning(noProgress, NOW).map((i) => `${i.ruleId}:${i.content.id}`), ['NEXT_TRACK_ITEM:boa-hipotese', 'NEXT_TRACK_ITEM:reserva-emergencia', 'RESUME_BOOKMARK:checklist-seguranca'])
  // unavailable / blocked / external-bad content never appears, even if in progress or bookmarked
  const hostile = clone(demo.demoState)
  hostile.progress.push({ ...progress.emptyProgress('manual-indicadores', demo.DEMO_USER), status: 'IN_PROGRESS', lastSeenAt: '2026-09-27T11:00:00-03:00' })
  hostile.progress.push({ ...progress.emptyProgress('planilha-antiga', demo.DEMO_USER), status: 'IN_PROGRESS', lastSeenAt: '2026-09-27T11:30:00-03:00' })
  hostile.bookmarks.push({ id: 'x', userId: demo.DEMO_USER, contentId: 'apostila-sem-origem', target: { kind: 'CONTENT' }, createdAt: '2026-09-27T11:59:00-03:00' })
  const ids = cont.buildContinueLearning(hostile, NOW, 20).map((i) => i.content.id)
  for (const blocked of ['manual-indicadores', 'planilha-antiga', 'apostila-sem-origem']) assert.ok(!ids.includes(blocked), blocked)
  // other users' data is ignored
  const other = clone(demo.demoState); other.progress = other.progress.map((p) => ({ ...p, userId: 'someone-else' })); other.bookmarks = []
  assert.ok(cont.buildContinueLearning(other, NOW).every((i) => i.ruleId === 'NEXT_TRACK_ITEM'))
  const suggestions = cont.learningSuggestions(demo.demoState, NOW)
  assert.deepEqual(suggestions.map((s) => s.ruleId), ['COMPLETE_ALMOST_FINISHED', 'CONTINUE_IN_PROGRESS', 'RESUME_BOOKMARK', 'REVIEW_NOTE'])
  for (const s of suggestions) { assert.ok(s.ruleId && s.reason && s.source) }
  assert.deepEqual(cont.learningSuggestions(clone(demo.demoState), NOW), suggestions)
})

test('learning session: tab-open time is not study time; bounded measured seconds', () => {
  const s = progress.recordSession({ id: 's', contentId: 'c', userId: 'u', startedAt: '2026-09-27T10:00:00-03:00', endedAt: '2026-09-27T14:00:00-03:00', resume: null, completed: false })
  assert.equal(s.activeSeconds.kind, 'UNKNOWN')
  assert.equal(progress.recordSession({ id: 's', contentId: 'c', userId: 'u', startedAt: 'a', endedAt: 'b', measuredActiveSeconds: 300, resume: null, completed: true }).activeSeconds.value, 300)
  for (const bad of [-1, 1.5, 86401, '300']) assert.throws(() => progress.recordSession({ id: 's', contentId: 'c', userId: 'u', startedAt: 'a', endedAt: 'b', measuredActiveSeconds: bad, resume: null, completed: false }))
  assert.throws(() => progress.recordSession({ id: 's', contentId: 'c', userId: 'u', startedAt: 'b', endedAt: 'a', resume: null, completed: false }))
})

test('library: filters, drafts hidden, unknown duration sorts last, stable ordering', () => {
  const all = library.filterLibrary(demo.demoItems, demo.demoProgress, library.DEFAULT_FILTER, NOW)
  assert.ok(!all.some((r) => r.item.publication === 'DRAFT'))
  assert.equal(all.length, demo.demoItems.length) // no DRAFT items in demo; REVIEW shows as COMING_SOON
  const blocked = library.filterLibrary(demo.demoItems, demo.demoProgress, { ...library.DEFAULT_FILTER, availability: 'BLOCKED_LICENSE' }, NOW)
  assert.deepEqual(blocked.map((r) => r.item.id).sort(), ['apostila-sem-origem', 'manual-indicadores'])
  assert.deepEqual(library.filterLibrary(demo.demoItems, demo.demoProgress, { ...library.DEFAULT_FILTER, status: 'IN_PROGRESS' }, NOW).map((r) => r.item.id), ['boa-hipotese', 'reserva-emergencia'])
  assert.deepEqual(library.filterLibrary(demo.demoItems, demo.demoProgress, { ...library.DEFAULT_FILTER, type: 'VIDEO' }, NOW).map((r) => r.item.id), ['metricas-basicas'])
  assert.deepEqual(library.filterLibrary(demo.demoItems, demo.demoProgress, { ...library.DEFAULT_FILTER, language: 'en' }, NOW), [])
  const byDuration = library.filterLibrary(demo.demoItems, demo.demoProgress, { ...library.DEFAULT_FILTER, sort: 'duration' }, NOW)
  const firstUnknown = byDuration.findIndex((r) => r.item.duration.kind !== 'KNOWN')
  assert.ok(byDuration.slice(firstUnknown).every((r) => r.item.duration.kind !== 'KNOWN'))
  assert.deepEqual(library.filterLibrary([...demo.demoItems].reverse(), demo.demoProgress, library.DEFAULT_FILTER, NOW).map((r) => r.item.id), all.map((r) => r.item.id))
})
