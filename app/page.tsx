import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import EcosystemHome from '@/components/ecosystem/EcosystemHome'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { products } from '@/lib/ecosystem/products'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Orçaly — Um Orçaly. Várias possibilidades.',
  description:
    'Um ecossistema de produtos para seu negócio, sua vida financeira, seu aprendizado e suas próximas possibilidades.',
  alternates: { canonical: appUrl },
  openGraph: {
    title: 'Um Orçaly. Várias possibilidades.',
    description:
      'Produtos especializados. Uma identidade. Você no centro.',
    url: appUrl,
    type: 'website',
    images: [{ url: '/og-orcaly.png', width: 1200, height: 630, alt: 'Orçaly' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Um Orçaly. Várias possibilidades.',
    description: 'Um ecossistema para seu negócio e suas próximas possibilidades.',
    images: ['/og-orcaly.png'],
  },
}

export default async function HomePage() {
  const cookieStore = await cookies()
  if (cookieStore.getAll().some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'))) {
    const db = await createSupabaseServerClient({ readOnly: true })
    const { data } = await db.auth.getUser()
    if (data.user) redirect('/apps')
  }
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Ecossistema Orçaly',
    url: appUrl,
    description:
      'Produtos especializados para seu negócio, sua vida financeira e seu aprendizado.',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: `${appUrl}${product.href}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <EcosystemHome />
    </>
  )
}
