import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function GarantiasPage() {
  return <OperationModulePage definition={operationPages['garantias']} />
}
