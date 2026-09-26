import { getPersonalProductAccess } from '@/lib/ecosystem/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { assertExportSize, entriesCsv, exportRowLimit, parseWealthFilters } from '@/lib/wealth/records'
import { ownedEntriesQuery } from '@/lib/wealth/records-server'
import type { WealthEntry } from '@/lib/wealth/core'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }

export async function GET(request: Request) {
  const [read, exported] = await Promise.all([getPersonalProductAccess('wealth', 'wealth.read'), getPersonalProductAccess('wealth', 'wealth.export')])
  if (!read.allowed || !read.identity || !exported.allowed) return Response.json({ error: 'Sua sessão ou permissão não permite exportar estes registros.' }, { status: 403, headers })
  const params = new URL(request.url).searchParams
  let filters
  try {
    if (['kind', 'month', 'page'].some(key => params.getAll(key).length > 1)) throw new Error('Use apenas um valor por filtro.')
    filters = parseWealthFilters(Object.fromEntries(params))
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Filtro inválido.' }, { status: 400, headers }) }
  // User-session RLS is mandatory for reads; the service client below only records the audit event.
  const result = await ownedEntriesQuery(read.identity.db, read.identity.user.id, filters).limit(exportRowLimit)
  if (result.error || result.count === null) return Response.json({ error: 'Não foi possível consultar seus registros.' }, { status: 503, headers })
  try { assertExportSize(result.count) }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Quantidade inválida.' }, { status: 413, headers }) }
  if (result.data.length !== result.count) return Response.json({ error: 'A consulta retornou um resultado incompleto. Reduza os filtros e tente novamente.' }, { status: 503, headers })
  let csv: string
  try { csv = entriesCsv(result.data as WealthEntry[]) }
  catch { return Response.json({ error: 'Não foi possível confirmar os valores para exportação.' }, { status: 503, headers }) }
  try {
    const audit = await getSupabaseAdmin().from('ecosystem_audit_events').insert({ actor_id: read.identity.user.id, event_type: 'wealth_entries.export', entity_id: read.identity.user.id })
    if (audit.error) throw new Error('export_audit_unavailable')
  } catch { return Response.json({ error: 'Não foi possível registrar a exportação. Tente novamente.' }, { status: 503, headers }) }
  return new Response(csv, { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="orcaly-wealth-lancamentos.csv"' } })
}
