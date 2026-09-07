'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'

function publicCode(digest?: string) {
  const clean = String(digest || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()
  return clean ? `ORC-${clean}` : 'ORC-GLOBAL'
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const code = useMemo(() => publicCode(error.digest), [error.digest])

  useEffect(() => {
    console.error(JSON.stringify({ event: 'client_global_error', errorId: code, digest: error.digest || null }))
  }, [code, error.digest])

  return (
    <html lang="pt-BR">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f6f9', color: '#14243b', fontFamily: 'Arial, sans-serif' }}>
          <section style={{ width: 'min(100%, 560px)', border: '1px solid #e2e8f0', borderRadius: 24, background: '#fff', padding: 28, boxShadow: '0 18px 60px rgba(15,23,42,.08)' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#94a3b8' }}>Falha global</p>
            <h1 style={{ margin: '8px 0 0', fontSize: 28, color: '#0b2e63' }}>O Orçaly encontrou um erro inesperado.</h1>
            <p style={{ margin: '14px 0 0', lineHeight: 1.6, color: '#64748b' }}>Nenhum dado sensível é exibido nesta tela. Use o código abaixo para correlacionar o incidente com os logs.</p>
            <code style={{ display: 'inline-block', marginTop: 16, padding: '7px 10px', borderRadius: 8, background: '#f1f5f9', fontWeight: 700 }}>{code}</code>
            <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={reset} style={{ minHeight: 44, border: 0, borderRadius: 12, background: '#0b2e63', color: '#fff', padding: '10px 16px', fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
              <Link href="/" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, color: '#475569', padding: '10px 16px', fontWeight: 700, textDecoration: 'none' }}>Ir para o início</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
