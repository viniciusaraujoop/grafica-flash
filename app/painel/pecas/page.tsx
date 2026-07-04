import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function PecasPage() {
  return <OperationModulePage definition={operationPages['pecas']} />
}
