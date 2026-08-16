import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Acompanhar pedido | Orçaly',
  description: 'Área privada para acompanhar um pedido.',
  referrer: 'no-referrer',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function CustomerPortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
