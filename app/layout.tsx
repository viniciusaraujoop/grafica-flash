import type { Metadata } from "next";
import "./globals.css";
import AuthSessionKeeper from '@/components/AuthSessionKeeper'

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://orcaly.com.br').replace(/\/$/, '')

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Orçaly',
    template: '%s | Orçaly',
  },
  description:
    'Orçaly é um ecossistema de produtos especializados para negócios, vida financeira, aprendizado e novas possibilidades.',
  applicationName: 'Orçaly',
  authors: [{ name: 'Orçaly' }],
  creator: 'Orçaly',
  publisher: 'Orçaly',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/apple-icon.png', type: 'image/png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'Orçaly',
    description:
      'Um Orçaly. Várias possibilidades. Produtos especializados conectados por uma identidade.',
    url: appUrl,
    siteName: 'Orçaly',
    images: [
      {
        url: '/og-orcaly.png',
        width: 1200,
        height: 630,
        alt: 'Orçaly — Um ecossistema de possibilidades',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Orçaly',
    description: 'Produtos para seu negócio, seu futuro e suas próximas possibilidades.',
    images: ['/og-orcaly.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthSessionKeeper />
        {children}
      </body>
    </html>
  );
}
