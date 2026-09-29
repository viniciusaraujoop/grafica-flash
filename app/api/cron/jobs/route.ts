import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'
import { secureBearerMatches } from '@/lib/jobs/core'
import { runBackgroundJobWorker } from '@/lib/jobs/worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const cronSecret = String(process.env.CRON_SECRET || '')
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'Cron indisponível.' }, { status: 503 })
  }
  if (!secureBearerMatches(request.headers.get('authorization'), cronSecret)) {
    return NextResponse.json({ ok: false, error: 'Não autorizado.' }, { status: 401 })
  }

  const db = getSupabaseAdmin()
  const summary = await runBackgroundJobWorker(db, { limit: 10, maxDurationMs: 45_000, staleSeconds: 300 })
  return NextResponse.json({
    ok: true,
    claimed: summary.claimed,
    completed: summary.completed,
    failed: summary.failed,
    retrying: summary.retrying,
    needs_attention: summary.needsAttention,
    stale_recovered: summary.staleRecovered,
    stopped_by_deadline: summary.stoppedByDeadline,
  })
}
