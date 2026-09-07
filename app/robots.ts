import type { MetadataRoute } from 'next'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/checkout/',
        '/painel/',
        '/cliente/',
        '/pedido/',
        '/proposta/',
        '/arte/',
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  }
}
