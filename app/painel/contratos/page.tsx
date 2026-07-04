import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function ContratosPage() {
  return <OperationModulePage definition={operationPages['contratos']} />
}
