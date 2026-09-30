import { FoundationRoot, foundationStyles as f } from '@/components/orcaly-next/foundation/primitives'

export default function AppsLoading() {
  return (
    <FoundationRoot theme="light">
      <div className={f.container} role="status" aria-label="Carregando App Hub" style={{ paddingBlock: 48 }}>
        <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ox-accent-text)' }}>Seu espaço Orçaly</p>
        <div aria-hidden="true" style={{ display: 'grid', gap: 16, marginTop: 16 }}>
          <div style={{ width: 'min(680px, 88%)', height: 58, borderRadius: 10, background: 'var(--ox-surface-muted)' }} />
          <div style={{ width: 'min(520px, 74%)', height: 20, borderRadius: 8, background: 'var(--ox-surface-muted)' }} />
          <div style={{ height: 168, marginTop: 24, borderRadius: 14, background: 'var(--ox-accent-surface)' }} />
        </div>
      </div>
    </FoundationRoot>
  )
}
