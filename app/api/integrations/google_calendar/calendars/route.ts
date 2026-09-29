import { NextResponse } from 'next/server'
import { getGrantedGoogleCalendarScopes, listGoogleCalendars } from '@/lib/integrations/google/calendar'
import { googleCalendarRouteError, resolveGoogleCalendarContext } from '@/lib/integrations/google/calendar-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const context = await resolveGoogleCalendarContext('integrations.read')
    if (!context.runtime || !context.connection) throw new Error('Runtime do Calendar indisponível.')
    const [calendars, scopes] = await Promise.all([
      listGoogleCalendars(context.runtime),
      getGrantedGoogleCalendarScopes(context.runtime),
    ])
    return NextResponse.json({
      calendars,
      scopes,
      config: {
        default_calendar_id: typeof context.connection.config.default_calendar_id === 'string' ? context.connection.config.default_calendar_id : null,
        delete_policy: typeof context.connection.config.delete_policy === 'string' ? context.connection.config.delete_policy : 'unlink',
        watch_enabled: context.connection.config.watch_enabled === true,
      },
    })
  } catch (error) {
    const mapped = googleCalendarRouteError(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}
