import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function AparelhosPage() {
  return <OperationModulePage definition={operationPages['aparelhos']} />
}
