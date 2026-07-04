import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function AgendaPage() {
  return <OperationModulePage definition={operationPages['agenda']} />
}
