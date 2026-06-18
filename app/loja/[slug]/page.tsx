import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function LojaRedirectPage({ params }: PageProps) {
  const { slug } = await params
  redirect(`/site/${slug}`)
}
