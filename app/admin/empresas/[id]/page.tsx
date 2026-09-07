import AdminCompany360 from '@/components/admin/AdminCompany360'

type PageProps = { params: Promise<{ id: string }> }

export default async function AdminCompanyPage({ params }: PageProps) {
  const { id } = await params
  return <AdminCompany360 companyId={id} />
}
