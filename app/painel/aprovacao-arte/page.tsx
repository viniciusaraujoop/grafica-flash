import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function AprovacaoArtePage() {
  return <OperationModulePage definition={operationPages['aprovacao-arte']} />
}
