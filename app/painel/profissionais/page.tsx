import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function ProfissionaisPage() {
  return <OperationModulePage definition={operationPages['profissionais']} />
}
