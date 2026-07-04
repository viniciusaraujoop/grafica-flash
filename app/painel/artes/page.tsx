import OperationModulePage from '@/components/painel/OperationModulePage'
import { operationPages } from '@/lib/operation-pages'

export default function ArtesPage() {
  return <OperationModulePage definition={operationPages['artes']} />
}
