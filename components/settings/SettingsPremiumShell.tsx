'use client'

// ORCALY_SETTINGS_PREMIUM_SHELL_V1
import Link from 'next/link'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import styles from './SettingsPremiumShell.module.css'

type UnknownRecord = Record<string, unknown>

type CompanySummary = {
  name: string
  status?: string
  businessType?: string
  plan?: string
  slug?: string
  logoUrl?: string
}

type NavigationItem = {
  id: string
  label: string
  keywords: string[]
}

const NAVIGATION: NavigationItem[] = [
  { id: 'overview', label: 'Visão geral', keywords: [] },
  { id: 'company', label: 'Informações da empresa', keywords: ['empresa', 'dados', 'informa'] },
  { id: 'team', label: 'Equipe e acessos', keywords: ['equipe', 'funcion', 'membro', 'acesso', 'convite'] },
  { id: 'preferences', label: 'Preferências', keywords: ['prefer', 'geral'] },
  { id: 'site', label: 'Site e endereço público', keywords: ['site', 'slug', 'subdom', 'endereço público'] },
  { id: 'notifications', label: 'Notificações', keywords: ['notifica'] },
  { id: 'security', label: 'Segurança', keywords: ['seguran', 'senha', 'sess'] },
  { id: 'integrations', label: 'Integrações', keywords: [] },
  { id: 'privacy', label: 'Dados e privacidade', keywords: ['privacidade', 'export', 'dados'] },
]

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function readString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function unwrapCompany(payload: unknown): UnknownRecord | null {
  const root = asRecord(payload)
  if (!root) return null
  return asRecord(root.company) || asRecord(root.data) || root
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function formatBusinessType(value?: string): string | undefined {
  if (!value) return undefined
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildPublicUrl(slug?: string): string | undefined {
  if (!slug) return undefined
  const clean = slug.trim().toLowerCase()
  if (!clean) return undefined
  return `https://${clean}.orcaly.com.br`
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.icon}>
      <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.summaryIcon}>
      <path d="M4 21V7l8-4 8 4v14M8 10h2m4 0h2M8 14h2m4 0h2M9 21v-3h6v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.inlineIcon}>
      <path d="M6.5 9V6.8a3.5 3.5 0 017 0V9m-8 0h9v7h-9V9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.inlineIcon}>
      <path d="M8.2 11.8l3.6-3.6m-5.2 7.2H5a3 3 0 010-6h2m6-4h2a3 3 0 010 6h-1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SettingsPremiumShell({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const integrationsRef = useRef<HTMLElement>(null)
  const [company, setCompany] = useState<CompanySummary | null>(null)
  const [teamCount, setTeamCount] = useState<number | null>(null)
  const [availableNavigation, setAvailableNavigation] = useState<NavigationItem[]>([
    NAVIGATION[0],
    NAVIGATION[7],
  ])
  const [activeSection, setActiveSection] = useState('overview')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSummary() {
      try {
        const companyResponse = await fetch('/api/company/current', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (companyResponse.ok) {
          const payload: unknown = await companyResponse.json()
          const record = unwrapCompany(payload)
          if (active && record) {
            setCompany({
              name: readString(record, ['nome_fantasia', 'name', 'nome', 'company_name']) || 'Sua empresa',
              status: readString(record, ['status', 'company_status']),
              businessType: readString(record, ['business_type', 'segment', 'segmento']),
              plan: readString(record, ['plan', 'plan_name', 'assinatura_plano', 'subscription_plan']),
              slug: readString(record, ['subdomain_slug', 'slug']),
              logoUrl: readString(record, ['logo_url', 'logo', 'avatar_url']),
            })
          }
        }
      } catch {
        // O resumo e complementar; a pagina funcional permanece disponivel.
      }

      try {
        const teamResponse = await fetch('/api/company/team', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (teamResponse.ok) {
          const payload: unknown = await teamResponse.json()
          const root = asRecord(payload)
          const candidates = [payload, root?.members, root?.team, root?.data, root?.users]
          const list = candidates.find(Array.isArray)
          if (active && Array.isArray(list)) setTeamCount(list.length)
        }
      } catch {
        // A contagem e ocultada quando a API nao estiver disponivel.
      }
    }

    void loadSummary()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const headings = Array.from(
      container.querySelectorAll<HTMLElement>('h1, h2, h3, [data-settings-section]'),
    )

    const firstTitle = headings.find((heading) =>
      normalizeText(heading.textContent || '').includes('configuracoes'),
    )
    if (firstTitle?.tagName === 'H1') {
      firstTitle.dataset.orcalyLegacyTitle = 'true'
    }

    const found: NavigationItem[] = [NAVIGATION[0]]
    const usedElements = new Set<HTMLElement>()

    for (const item of NAVIGATION.slice(1)) {
      if (item.id === 'integrations') {
        found.push(item)
        continue
      }

      const element = headings.find((heading) => {
        if (usedElements.has(heading)) return false
        const text = normalizeText(heading.textContent || '')
        return item.keywords.some((keyword) => text.includes(normalizeText(keyword)))
      })

      if (element) {
        element.id = element.id || `settings-${item.id}`
        element.dataset.orcalySettingsTarget = item.id
        usedElements.add(element)
        found.push(item)
      }
    }

    setAvailableNavigation(found)

    const explicitBusinessInputs = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        '[name="business_type"], [name="businessType"], #business_type, #businessType',
      ),
    )

    for (const field of explicitBusinessInputs) {
      const shouldLock = Boolean(company?.businessType)
      field.disabled = shouldLock
      field.setAttribute('aria-disabled', shouldLock ? 'true' : 'false')
      if (shouldLock) {
        field.title = 'O ramo empresarial so pode ser alterado pelo suporte do Orcaly.'
        field.dataset.orcalyLockedBusinessType = 'true'
      } else {
        field.removeAttribute('title')
        delete field.dataset.orcalyLockedBusinessType
      }
    }
  }, [children, company?.businessType])

  const publicUrl = useMemo(() => buildPublicUrl(company?.slug), [company?.slug])

  function scrollToSection(item: NavigationItem) {
    setActiveSection(item.id)

    if (item.id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (item.id === 'integrations') {
      integrationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const element = contentRef.current?.querySelector<HTMLElement>(
      `[data-orcaly-settings-target="${item.id}"]`,
    )
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function copyPublicUrl() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Central da empresa</span>
          <h1>Configurações</h1>
          <p>Gerencie as informações, os acessos e as preferências da sua empresa.</p>
        </div>
        {publicUrl ? (
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryButton} onClick={copyPublicUrl}>
              <LinkIcon />
              {copied ? 'Endereço copiado' : 'Copiar endereço'}
            </button>
            <a className={styles.primaryButton} href={publicUrl} target="_blank" rel="noreferrer">
              Abrir site
              <ArrowIcon />
            </a>
          </div>
        ) : null}
      </header>

      <section className={styles.summaryCard} aria-label="Resumo da empresa">
        <div className={styles.companyIdentity}>
          <div className={styles.logoBox}>
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" />
            ) : (
              <BuildingIcon />
            )}
          </div>
          <div className={styles.companyText}>
            <span>Empresa</span>
            <strong>{company?.name || 'Carregando informações...'}</strong>
            {publicUrl ? <small>{publicUrl.replace('https://', '')}</small> : null}
          </div>
        </div>

        <div className={styles.summaryGrid}>
          {company?.status ? (
            <div className={styles.summaryItem}>
              <span>Status</span>
              <strong>{company.status}</strong>
            </div>
          ) : null}
          {company?.businessType ? (
            <div className={styles.summaryItem}>
              <span>Ramo empresarial</span>
              <strong className={styles.lockedValue}>
                <LockIcon />
                {formatBusinessType(company.businessType)}
              </strong>
            </div>
          ) : null}
          {company?.plan ? (
            <div className={styles.summaryItem}>
              <span>Plano atual</span>
              <strong>{company.plan}</strong>
            </div>
          ) : null}
          {teamCount !== null ? (
            <div className={styles.summaryItem}>
              <span>Equipe</span>
              <strong>{teamCount} acesso{teamCount === 1 ? '' : 's'}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {company?.businessType ? (
        <section className={styles.lockNotice}>
          <LockIcon />
          <div>
            <strong>Ramo empresarial protegido</strong>
            <p>
              O ramo empresarial define os recursos, menus e operações disponíveis no painel.
              Depois de configurado, somente o suporte do Orçaly poderá realizar uma alteração.
            </p>
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Seções de configurações">
          <div className={styles.sidebarTitle}>Configurações da empresa</div>
          <nav className={styles.navigation}>
            {availableNavigation.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeSection === item.id ? styles.navigationActive : styles.navigationButton}
                onClick={() => scrollToSection(item)}
              >
                <span>{item.label}</span>
                <ArrowIcon />
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.mainColumn}>
          <div ref={contentRef} className={styles.legacyContent}>
            {children}
          </div>

          <section ref={integrationsRef} className={styles.integrationsSection}>
            <div className={styles.sectionHeading}>
              <span>Atalhos</span>
              <h2>Integrações e serviços</h2>
              <p>Acesse as áreas especializadas sem duplicar formulários nesta página.</p>
            </div>

            <div className={styles.integrationGrid}>
              <Link href="/painel/pagamentos" className={styles.integrationCard}>
                <div>
                  <span>Recebimentos</span>
                  <strong>Mercado Pago e pagamentos</strong>
                  <p>Conexão, vendas online e formas presenciais.</p>
                </div>
                <ArrowIcon />
              </Link>

              <Link href="/painel/site" className={styles.integrationCard}>
                <div>
                  <span>Presença digital</span>
                  <strong>Site público</strong>
                  <p>Conteúdo, identidade visual e publicação.</p>
                </div>
                <ArrowIcon />
              </Link>

              <Link href="/painel/assinatura" className={styles.integrationCard}>
                <div>
                  <span>Conta Orçaly</span>
                  <strong>Assinatura e plano</strong>
                  <p>Plano atual, cobranças, teste e cancelamento.</p>
                </div>
                <ArrowIcon />
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}