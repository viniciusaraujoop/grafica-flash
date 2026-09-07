import CrmWorkspaceV2 from '@/components/crm/CrmWorkspaceV2'
import RepurchaseOpportunitiesPanel from '@/components/painel/RepurchaseOpportunitiesPanel'

export default function CrmPage() {
  return (
    <div className="grid gap-4">
      <CrmWorkspaceV2 />
      <RepurchaseOpportunitiesPanel compact />
    </div>
  )
}
