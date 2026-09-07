import FounderInvitesClient from '@/components/admin/FounderInvitesClient'

export default async function FounderInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>
}) {
  const params = await searchParams

  return (
    <FounderInvitesClient
      initialLeadId={
        typeof params.lead === 'string'
          ? params.lead
          : undefined
      }
    />
  )
}
