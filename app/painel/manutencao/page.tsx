import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function ManutencaoPage() {
  return <OperationModulePage definition={operationPages['manutencao']} />
}
