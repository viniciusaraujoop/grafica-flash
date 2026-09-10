import { registerJobHandler } from '@/lib/jobs/registry'
import { integrationSyncJobHandler } from '@/lib/jobs/handlers/integration-sync'

let bootstrapped = false

export function bootstrapJobHandlers() {
  if (bootstrapped) return
  registerJobHandler(integrationSyncJobHandler)
  bootstrapped = true
}
