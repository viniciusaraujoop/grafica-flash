'use client'

import { FoundationRoot, foundationStyles as f } from '@/components/orcaly-next/foundation/primitives'

export default function AppsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <FoundationRoot theme="light">
      <section className={f.container} role="alert" style={{ display: 'grid', gap: 16, paddingBlock: 48 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ox-danger)' }}>App Hub indisponível</p>
          <h1 style={{ marginTop: 8, fontSize: 32 }}>Não conseguimos carregar seu espaço Orçaly.</h1>
          <p style={{ marginTop: 10, maxWidth: 620, color: 'var(--ox-ink-muted)' }}>Tente novamente. Nenhum detalhe interno do erro é exibido nesta tela.</p>
        </div>
        <button className={`${f.button} ${f.buttonPrimary}`} type="button" onClick={reset} style={{ justifySelf: 'start' }}>Tentar novamente</button>
      </section>
    </FoundationRoot>
  )
}
