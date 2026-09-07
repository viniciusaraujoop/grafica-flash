import type { Metadata } from 'next'
import MainSiteV2 from '@/components/marketing/MainSiteV2'
import { marketingPlans } from '@/lib/marketing/main-site'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Orçaly — Site, pedidos, clientes e operação no mesmo fluxo',
  description:
    'Crie a presença digital da sua empresa, receba vendas e orçamentos e acompanhe pedidos, clientes, propostas e operação em um painel adaptado ao seu negócio.',
  alternates: { canonical: appUrl },
  openGraph: {
    title: 'Orçaly — O sistema que entende como sua empresa trabalha',
    description:
      'Site, pedidos, clientes, propostas e operação em uma plataforma adaptada ao tipo de negócio.',
    url: appUrl,
    type: 'website',
    images: [{ url: '/og-orcaly.png', width: 1200, height: 630, alt: 'Orçaly' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orçaly — Site, pedidos, clientes e operação',
    description: 'Do primeiro contato à entrega, tudo no mesmo fluxo.',
    images: ['/og-orcaly.png'],
  },
}

export default function HomePage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Orçaly',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: appUrl,
    description:
      'Plataforma para empresas criarem presença digital e organizarem pedidos, clientes, propostas e operação.',
    offers: marketingPlans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.price.toFixed(2),
      priceCurrency: 'BRL',
      url: `${appUrl}/cadastro?plano=${encodeURIComponent(plan.id)}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <MainSiteV2 />
    </>
  )
}
