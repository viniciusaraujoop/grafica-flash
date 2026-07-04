import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function EquipamentosPage() {
  return <OperationModulePage definition={operationPages['equipamentos']} />
}
