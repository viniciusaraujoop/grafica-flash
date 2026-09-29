import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Orçaly',
    short_name: 'Orçaly',
    id: '/apps',
    description: 'Um Orçaly. Várias possibilidades.',
    start_url: '/apps',
    scope: '/',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#0b3b78',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icone-orcaly.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
