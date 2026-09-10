import { NextResponse } from 'next/server'
import { updateIntegrationConnection } from '@/lib/integrations/core/connections'
import { listGoogleCalendars } from '@/lib/integrations/google/calendar'
import { normalizeCalendarDeletePolicy } from '@/lib/integrations/google/calendar-contract'
import { googleCalendarRouteError, resolveGoogleCalendarContext } from '@/lib/integrations/google/calendar-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request) {
  try {
    const context = await resolveGoogleCalendarContext('integrations.manage')
    if (!context.runtime || !context.connection) throw new Error('Runtime do Calendar indisponível.')
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Configuração inválida.', code: 'INVALID_DATA' }, { status: 400 })
    }
    const row = body as Record<string, unknown>
    const defaultCalendarId = typeof row.default_calendar_id === 'string' ? row.default_calendar_id.trim() : ''
    if (!defaultCalendarId || defaultCalendarId.length > 1024) {
      return NextResponse.json({ error: 'Selecione um calendário válido.', code: 'INVALID_DATA' }, { status: 400 })
    }
    const calendars = await listGoogleCalendars(context.runtime)
    const selected = calendars.find((calendar) => calendar.id === defaultCalendarId)
    if (!selected) return NextResponse.json({ error: 'Calendário não encontrado na conta conectada.', code: 'INVALID_DATA' }, { status: 400 })
    if (!selected.writable) return NextResponse.json({ error: 'O calendário selecionado não permite escrita.', code: 'INSUFFICIENT_SCOPE' }, { status: 403 })

    const config = {
      ...context.connection.config,
      default_calendar_id: selected.id,
      default_calendar_name: selected.summary,
      delete_policy: normalizeCalendarDeletePolicy(row.delete_policy),
      watch_enabled: row.watch_enabled === true,
    }
    const connection = await updateIntegrationConnection(context.admin, {
      companyId: context.companyId,
      provider: 'google_calendar',
      patch: { config, status: 'CONNECTED', last_error_code: null, last_error_at: null },
    })
    return NextResponse.json({ ok: true, config: connection?.config || config })
  } catch (error) {
    const mapped = googleCalendarRouteError(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}
