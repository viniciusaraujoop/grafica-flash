import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function PacotesPage() {
  return <OperationModulePage definition={operationPages['pacotes']} />
}
