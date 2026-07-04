import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function HorariosPage() {
  return <OperationModulePage definition={operationPages['horarios']} />
}
