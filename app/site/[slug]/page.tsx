import PublicSiteClient from '@/components/public-site/PublicSiteClient'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function PublicCompanySitePage({ params }: PageProps) {
  const { slug } = await params
  return <PublicSiteClient slug={slug} />
}
