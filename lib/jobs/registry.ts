import type { SupabaseClient } from '@supabase/supabase-js'
import type { BackgroundJob, JobPayloadResult } from '@/lib/jobs/core'

export type JobExecutionContext = {
  db: SupabaseClient
  job: BackgroundJob
  workerId: string
  deadlineMs: number
}

export type JobHandler<T> = {
  readonly type: string
  validate(payload: unknown): JobPayloadResult<T>
  execute(context: JobExecutionContext, payload: T): Promise<Record<string, unknown> | void>
}

const handlers = new Map<string, JobHandler<unknown>>()

export function registerJobHandler<T>(handler: JobHandler<T>) {
  if (!handler.type.trim()) throw new Error('Job handler type is required.')
  handlers.set(handler.type, handler as JobHandler<unknown>)
}

export function getJobHandler(type: string): JobHandler<unknown> | null {
  return handlers.get(type) || null
}

export function listJobHandlerTypes(): string[] {
  return Array.from(handlers.keys()).sort()
}
