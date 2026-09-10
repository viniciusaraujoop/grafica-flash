import { registerIntegrationAdapter } from '@/lib/integrations/core/registry'

let bootstrapped = false

export function bootstrapIntegrationAdapters() {
  if (bootstrapped) return
  bootstrapped = true
  // Provider adapters are registered here as they become implementation-complete.
  // Keeping registration centralized makes workers/routes deterministic without a giant switch.
  void registerIntegrationAdapter
}
