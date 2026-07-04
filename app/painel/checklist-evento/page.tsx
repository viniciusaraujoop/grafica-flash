import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function ChecklistEventoPage() {
  return <OperationModulePage definition={operationPages['checklist-evento']} />
}
