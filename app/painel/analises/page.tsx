import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function AnalisesPage() {
  return <OperationModulePage definition={operationPages['analises']} />
}
