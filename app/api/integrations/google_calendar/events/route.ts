import { NextResponse } from 'next/server'
import { createGoogleCalendarEvent, deleteGoogleCalendarEvent, updateGoogleCalendarEvent } from '@/lib/integrations/google/calendar'
import { GoogleCalendarContractError, isGoogleCalendarEntityType, parseCalendarEventDTO } from '@/lib/integrations/google/calendar-contract'
import { googleCalendarRouteError, resolveGoogleCalendarContext } from '@/lib/integrations/google/calendar-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function invalid(error: unknown) {
  return error instanceof GoogleCalendarContractError
    ? NextResponse.json({ error: error.message, code: 'INVALID_DATA' }, { status: 400 })
    : null
}

export async function POST(request: Request) {
  try {
    const context = await resolveGoogleCalendarContext('integrations.manage')
    if (!context.runtime) throw new Error('Runtime do Calendar indisponível.')
    const dto = parseCalendarEventDTO(await request.json().catch(() => null))
    const result = await createGoogleCalendarEvent(context.runtime, dto)
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    const validation = invalid(error)
    if (validation) return validation
    const mapped = googleCalendarRouteError(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await resolveGoogleCalendarContext('integrations.manage')
    if (!context.runtime) throw new Error('Runtime do Calendar indisponível.')
    const dto = parseCalendarEventDTO(await request.json().catch(() => null))
    const event = await updateGoogleCalendarEvent(context.runtime, dto)
    return NextResponse.json({ ok: true, event })
  } catch (error) {
    const validation = invalid(error)
    if (validation) return validation
    const mapped = googleCalendarRouteError(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await resolveGoogleCalendarContext('integrations.manage')
    if (!context.runtime) throw new Error('Runtime do Calendar indisponível.')
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 })
    const row = body as Record<string, unknown>
    if (!isGoogleCalendarEntityType(row.entityType) || typeof row.entityId !== 'string' || !row.entityId.trim()) {
      return NextResponse.json({ error: 'Entidade de calendário inválida.' }, { status: 400 })
    }
    const result = await deleteGoogleCalendarEvent(context.runtime, row.entityType, row.entityId.trim(), row.policy)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const mapped = googleCalendarRouteError(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
}
