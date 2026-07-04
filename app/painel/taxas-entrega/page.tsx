import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function TaxasEntregaPage() {
  return <OperationModulePage definition={operationPages['taxas-entrega']} />
}
