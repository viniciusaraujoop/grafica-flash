import RepurchaseOpportunitiesPanel from '@/components/painel/RepurchaseOpportunitiesPanel'
import TodayOperationsCenter from '@/components/painel/TodayOperationsCenter'

export default function InicioPage() {
  return (
    <div className="grid gap-4">
      <TodayOperationsCenter />
      <RepurchaseOpportunitiesPanel />
    </div>
  )
}
