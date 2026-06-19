import type { Metadata } from "next";
import "./globals.css";
import AuthSessionKeeper from '@/components/AuthSessionKeeper'

export const metadata: Metadata = {
  title: "Orçaly",
  description: "Sites, catálogos, pedidos e propostas para empresas.",
};

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
