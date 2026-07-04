import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function OrdensServicoPage() {
  return <OperationModulePage definition={operationPages['ordens-servico']} />
}
