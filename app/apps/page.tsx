import HubHome from '@/components/orcaly-next/hub/HubHome'
import { productRegistry } from '@/lib/orcaly-next/product-registry'
import { getCurrentHubSnapshots } from '@/lib/orcaly-next/runtime/hub-snapshots'

export default async function AppHubPage() {
  const snapshots = await getCurrentHubSnapshots()
  return <HubHome registry={productRegistry} snapshots={snapshots} />
}
