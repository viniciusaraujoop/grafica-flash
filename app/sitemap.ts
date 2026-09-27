// quality-hardening-ci-trigger
import type { MetadataRoute } from 'next'
import { marketingSolutions } from '@/lib/marketing/main-site'
import { products } from '@/lib/ecosystem/products'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    ...products.map((product) => ({ url: `${appUrl}${product.href}`, changeFrequency: 'monthly' as const, priority: 0.7 })),
    { url: `${appUrl}/business`, changeFrequency: 'monthly', priority: 0.9 },
    {
      url: appUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...marketingSolutions.map((solution) => ({
      url: `${appUrl}/solucoes/${solution.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    {
      url: `${appUrl}/cadastro`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${appUrl}/parceiros`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${appUrl}/suporte`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
