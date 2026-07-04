import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function ComissoesPage() {
  return <OperationModulePage definition={operationPages['comissoes']} />
}
