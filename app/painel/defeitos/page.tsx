import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function DefeitosPage() {
  return <OperationModulePage definition={operationPages['defeitos']} />
}
