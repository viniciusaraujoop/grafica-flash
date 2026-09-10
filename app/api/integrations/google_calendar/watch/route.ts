import { NextResponse } from 'next/server'
import { ensureGoogleCalendarWatch, stopGoogleCalendarWatches } from '@/lib/integrations/google/calendar'
import { googleCalendarRouteError, resolveGoogleCalendarContext } from '@/lib/integrations/google/calendar-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const context = await resolveGoogleCalendarContext('integrations.manage')
    if (!context.runtime) throw new Error('Runtime do Calendar indisponível.')
    const watch = await ensureGoogleCalendarWatch(context.runtime)
    return NextResponse.json({ ok: true, watch })
  } catch (error) {
    const mapped = googleCalendarRouteError(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}

export async function DELETE() {
  try {
    const context = await resolveGoogleCalendarContext('integrations.manage')
    if (!context.runtime) throw new Error('Runtime do Calendar indisponível.')
    await stopGoogleCalendarWatches(context.runtime)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const mapped = googleCalendarRouteError(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}
