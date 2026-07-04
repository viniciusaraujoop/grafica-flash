import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function EventosPage() {
  return <OperationModulePage definition={operationPages['eventos']} />
}
