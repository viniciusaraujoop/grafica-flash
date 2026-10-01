import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export type EventFabricHealthStatus = 'Operational' | 'Degraded' | 'Down' | 'Unknown'

type HealthOptions = {
  enabled: boolean
  cadenceSeconds?: number
}

const OUTBOX_UNPROCESSED = ['queued', 'processing', 'retrying', 'failed', 'needs_attention']
const JOB_ACTIVE_OR_BAD = ['queued', 'running', 'retrying', 'failed', 'needs_attention']

async function statusCounts(
  db: SupabaseClient,
  table: string,
  statuses: readonly string[],
  eventFabricJobsOnly = false,
) {
  const entries = await Promise.all(
    statuses.map(async (status) => {
      let query = db
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('status', status)

      if (eventFabricJobsOnly) {
        query = query.not('outbox_event_id', 'is', null)
      }

      const { count, error } = await query
      if (error) throw error
      return [status, count || 0] as const
    }),
  )

  return Object.fromEntries(entries) as Record<string, number>
}

function ageSeconds(value?: string | null) {
  if (!value) return null
  const parsed = new Date(value).getTime()
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000))
}

export async function readEventFabricHealth(db: SupabaseClient, options: HealthOptions) {
  try {
    const cadenceSeconds = Math.max(10, Math.min(Number(options.cadenceSeconds || 60), 3600))
    const warningAge = Math.max(300, 3 * cadenceSeconds)
    const criticalAge = Math.max(1800, 12 * cadenceSeconds)
    const now = new Date().toISOString()

    const [
      outbox,
      jobs,
      oldestOutboxResult,
      oldestJobResult,
      staleJobResult,
    ] = await Promise.all([
      statusCounts(db, 'transactional_outbox', [...OUTBOX_UNPROCESSED, 'completed']),
      statusCounts(db, 'background_jobs', [...JOB_ACTIVE_OR_BAD, 'completed'], true),
      db
        .from('transactional_outbox')
        .select('id,event_type,status,created_at,available_at')
        .in('status', OUTBOX_UNPROCESSED)
        .lte('available_at', now)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from('background_jobs')
        .select('id,job_type,status,created_at,run_after,outbox_event_id')
        .not('outbox_event_id', 'is', null)
        .in('status', ['queued', 'retrying'])
        .lte('run_after', now)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from('background_jobs')
        .select('id,job_type,status,locked_at,outbox_event_id')
        .not('outbox_event_id', 'is', null)
        .eq('status', 'running')
        .not('locked_at', 'is', null)
        .order('locked_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    for (const result of [oldestOutboxResult, oldestJobResult, staleJobResult]) {
      if (result.error) throw result.error
    }

    const unprocessedOutbox = OUTBOX_UNPROCESSED.reduce(
      (sum, status) => sum + Number(outbox[status] || 0),
      0,
    )
    const oldestOutbox = oldestOutboxResult.data || null
    const oldestJob = oldestJobResult.data || null
    const staleJob = staleJobResult.data || null
    const oldestOutboxAge = ageSeconds(oldestOutbox?.created_at)
    const oldestJobAge = ageSeconds(oldestJob?.created_at)
    const staleLockAge = ageSeconds(staleJob?.locked_at)

    let status: EventFabricHealthStatus = 'Operational'
    let detail = options.enabled
      ? 'Event Fabric habilitado; sem backlog fora dos limites observados.'
      : 'Event Fabric desabilitado e sem backlog pendente.'

    if (!options.enabled && unprocessedOutbox > 0) {
      status = 'Degraded'
      detail =
        'RELAY_DISABLED_WITH_BACKLOG · ' +
        unprocessedOutbox +
        ' evento(s) não processado(s).'
    } else if (options.enabled) {
      if (Number(outbox.processing || 0) > 0) {
        status = 'Down'
        detail =
          'Outbox possui estado processing persistido; dispatch atômico exige investigação.'
      } else if (
        (oldestOutboxAge != null && oldestOutboxAge > criticalAge) ||
        (oldestJobAge != null && oldestJobAge > criticalAge)
      ) {
        status = 'Down'
        detail = 'Backlog Event Fabric ultrapassou o limite crítico de idade.'
      } else if (
        Number(outbox.needs_attention || 0) > 0 ||
        Number(outbox.failed || 0) > 0 ||
        Number(jobs.needs_attention || 0) > 0 ||
        Number(jobs.failed || 0) > 0 ||
        (staleLockAge != null && staleLockAge > 300) ||
        (oldestOutboxAge != null && oldestOutboxAge > warningAge) ||
        (oldestJobAge != null && oldestJobAge > warningAge)
      ) {
        status = 'Degraded'
        detail =
          'Event Fabric apresenta backlog, dead-letter ou lease acima do limite operacional.'
      }
    }

    return {
      status,
      detail,
      observedAt: new Date().toISOString(),
      metrics: {
        enabled: options.enabled,
        cadenceSeconds,
        warningAgeSeconds: warningAge,
        criticalAgeSeconds: criticalAge,
        outbox,
        jobs,
        unprocessedOutbox,
        oldestOutbox: oldestOutbox
          ? {
              id: oldestOutbox.id,
              eventType: oldestOutbox.event_type,
              status: oldestOutbox.status,
              ageSeconds: oldestOutboxAge,
            }
          : null,
        oldestEventFabricJob: oldestJob
          ? {
              id: oldestJob.id,
              jobType: oldestJob.job_type,
              status: oldestJob.status,
              ageSeconds: oldestJobAge,
            }
          : null,
        staleEventFabricJob: staleJob
          ? {
              id: staleJob.id,
              jobType: staleJob.job_type,
              lockedAgeSeconds: staleLockAge,
            }
          : null,
      },
    }
  } catch {
    return {
      status: 'Unknown' as const,
      detail:
        'Não foi possível ler a telemetria do Event Fabric; nenhuma saúde foi inferida.',
      observedAt: new Date().toISOString(),
      metrics: null,
    }
  }
}
