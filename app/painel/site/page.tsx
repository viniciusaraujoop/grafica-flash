'use client'

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SitePreview from '@/components/site-builder/SitePreview'
import LogoUploader from '@/components/site-builder/LogoUploader'
import ColorPalettePicker from '@/components/site-builder/ColorPalettePicker'
import BenefitsEditor, { cleanBenefits, type BenefitEditorItem } from '@/components/site-builder/BenefitsEditor'
import FaqEditor, { cleanFaq, type FaqEditorItem } from '@/components/site-builder/FaqEditor'
import SiteSectionToggles from '@/components/site-builder/SiteSectionToggles'
import { getDefaultSiteSettingsForBusiness, getSiteTemplateByBusinessType, siteTemplates, type SiteSectionConfig } from '@/lib/site-templates'
import { type PublicSiteCompany, type PublicSiteProduct } from '@/components/public-site/PublicSiteRenderer'
import { getCompanyLocalSitePath, getCompanyPublicUrl } from '@/lib/company-url'

type Tab = 'identidade' | 'segmento' | 'capa' | 'cores' | 'secoes' | 'conteudo' | 'catalogo' | 'checkout' | 'preview' | 'publicacao'
type PreviewMode = 'desktop' | 'mobile'

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'identidade', label: 'Identidade' },
  { id: 'segmento', label: 'Segmento' },
  { id: 'capa', label: 'Capa' },
  { id: 'cores', label: 'Cores' },
  { id: 'secoes', label: 'Seções' },
  { id: 'conteudo', label: 'Conteúdo' },
  { id: 'catalogo', label: 'Catálogo' },
  { id: 'checkout', label: 'Checkout' },
  { id: 'preview', label: 'Prévia' },
  { id: 'publicacao', label: 'Publicação' },
]

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function publicLink(company: PublicSiteCompany | null) {
  return getCompanyPublicUrl(company?.subdomain_slug || company?.slug)
}

function localSitePath(company: PublicSiteCompany | null) {
  return getCompanyLocalSitePath(company?.subdomain_slug || company?.slug)
}

function normalizeBenefits(value: unknown, fallback: BenefitEditorItem[]): BenefitEditorItem[] {
  const items = asArray<{ title?: string; titulo?: string; text?: string; texto?: string }>(value)
    .map((item) => ({
      title: item.title || item.titulo || '',
      text: item.text || item.texto || '',
    }))
    .filter((item) => item.title || item.text)

  return items.length ? items : fallback
}

function normalizeFaq(value: unknown, fallback: FaqEditorItem[]): FaqEditorItem[] {
  const items = asArray<{ question?: string; pergunta?: string; answer?: string; resposta?: string }>(value)
    .map((item) => ({
      question: item.question || item.pergunta || '',
      answer: item.answer || item.resposta || '',
    }))
    .filter((item) => item.question || item.answer)

  return items.length ? items : fallback
}

function normalizeSections(value: unknown, fallback: SiteSectionConfig[]): SiteSectionConfig[] {
  const items = asArray<Partial<SiteSectionConfig>>(value)
    .filter((item) => item.id)
    .map((item, index) => ({
      id: item.id as SiteSectionConfig['id'],
      enabled: item.enabled !== false,
      order: Number(item.order || index + 1),
    }))
    .sort((a, b) => a.order - b.order)

  return items.length ? items : fallback
}

function sanitizeWhatsApp(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function whatsappShareLink(company: PublicSiteCompany | null) {
  const link = publicLink(company)
  const phone = sanitizeWhatsApp(company?.whatsapp)
  const message = link ? `Conheça nosso site: ${link}` : 'Conheça nosso site no Orçaly.'

  if (phone.length >= 10) {
    const normalized = phone.startsWith('55') ? phone : `55${phone}`
    return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
  }

  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

export default function SiteBuilderPage() {
  const [tab, setTab] = useState<Tab>('identidade')
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop')
  const [company, setCompany] = useState<PublicSiteCompany | null>(null)
  const [products, setProducts] = useState<PublicSiteProduct[]>([])
  const [sections, setSections] = useState<SiteSectionConfig[]>([])
  const [benefits, setBenefits] = useState<BenefitEditorItem[]>([])
  const [faq, setFaq] = useState<FaqEditorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)

  const template = useMemo(() => getSiteTemplateByBusinessType(company?.business_type || company?.site_template), [company?.business_type, company?.site_template])
  const defaults = useMemo(() => getDefaultSiteSettingsForBusiness(company?.business_type || company?.site_template), [company?.business_type, company?.site_template])

  const previewCompany: PublicSiteCompany = useMemo(() => ({
    ...(company || {}),
    site_sections: sections,
    site_benefits: cleanBenefits(benefits),
    site_faq: cleanFaq(faq),
  }), [company, sections, benefits, faq])

  const checklist = useMemo(() => ([
    { label: 'Logo adicionada', done: Boolean(company?.logo_url) },
    { label: 'Cores escolhidas', done: Boolean(company?.site_primary_color && company?.site_accent_color) },
    { label: 'Título preenchido', done: Boolean(company?.site_headline) },
    { label: 'Subtítulo preenchido', done: Boolean(company?.site_subheadline) },
    { label: 'WhatsApp informado', done: Boolean(company?.whatsapp) },
    { label: 'Pelo menos 1 produto/serviço cadastrado', done: products.length > 0 },
    { label: 'FAQ configurado', done: cleanFaq(faq).length > 0 },
    { label: 'Link público pronto', done: Boolean(company?.subdomain_slug || company?.slug) },
  ]), [company, products.length, faq])

  const completion = useMemo(() => {
    const done = checklist.filter((item) => item.done).length
    return Math.round((done / checklist.length) * 100)
  }, [checklist])

  function markDirty() {
    setDirty(true)
    setMessage('')
  }

  function update<K extends keyof PublicSiteCompany>(key: K, value: PublicSiteCompany[K]) {
    setCompany((current) => ({ ...(current || {}), [key]: value }))
    markDirty()
  }

  function updateSections(next: SiteSectionConfig[]) {
    setSections(next)
    setCompany((current) => ({ ...(current || {}), site_sections: next }))
    markDirty()
  }

  function updateBenefits(next: BenefitEditorItem[]) {
    setBenefits(next)
    setCompany((current) => ({ ...(current || {}), site_benefits: next }))
    markDirty()
  }

  function updateFaq(next: FaqEditorItem[]) {
    setFaq(next)
    setCompany((current) => ({ ...(current || {}), site_faq: next }))
    markDirty()
  }

  async function load() {
    setLoading(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        window.location.href = '/login'
        return
      }

      const response = await fetch('/api/site/settings', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar site.')

      const loadedCompany = payload.company as PublicSiteCompany
      const loadedTemplate = getSiteTemplateByBusinessType(loadedCompany.business_type || loadedCompany.site_template)
      const loadedDefaults = getDefaultSiteSettingsForBusiness(loadedCompany.business_type || loadedCompany.site_template)

      setCompany(loadedCompany)
      setSections(normalizeSections(loadedCompany.site_sections, loadedTemplate.sections))
      setBenefits(normalizeBenefits(loadedCompany.site_benefits, loadedDefaults.site_benefits))
      setFaq(normalizeFaq(loadedCompany.site_faq, loadedDefaults.site_faq))

      if (loadedCompany.id) {
        const { data } = await supabase
          .from('products')
          .select('*')
          .eq('company_id', loadedCompany.id)
          .order('created_at', { ascending: false })
          .limit(12)

        setProducts((data || []) as PublicSiteProduct[])
      }

      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar site.')
    }

    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function save() {
    if (!company) return

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('Sessão expirada.')

      const payload = {
        logo_url: company.logo_url || null,
        business_type: company.business_type || template.businessType,
        site_template: company.site_template || template.templateId,
        site_theme: company.site_theme || template.suggestedColors.theme,
        site_primary_color: company.site_primary_color || template.suggestedColors.primary,
        site_accent_color: company.site_accent_color || template.suggestedColors.accent,
        site_headline: company.site_headline || defaults.site_headline,
        site_subheadline: company.site_subheadline || defaults.site_subheadline,
        site_cta_label: company.site_cta_label || company.site_cta_text || template.ctaLabel,
        site_about_title: company.site_about_title || defaults.site_about_title,
        site_about_text: company.site_about_text || defaults.site_about_text,
        site_sections: sections,
        site_benefits: cleanBenefits(benefits),
        site_faq: cleanFaq(faq),
        site_gallery: asArray(company.site_gallery),
        site_testimonials: asArray(company.site_testimonials),
      }

      const response = await fetch('/api/site/settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(result.error || 'Erro ao salvar site.')

      const savedCompany = result.company as PublicSiteCompany
      setCompany(savedCompany)
      setSections(normalizeSections(savedCompany.site_sections, sections))
      setBenefits(normalizeBenefits(savedCompany.site_benefits, cleanBenefits(benefits)))
      setFaq(normalizeFaq(savedCompany.site_faq, cleanFaq(faq)))
      setMessage('Alterações salvas.')
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar site. Tente novamente.')
    }

    setSaving(false)
  }

  async function applyTemplate(mode: 'empty' | 'replace') {
    if (!company) return

    if (mode === 'replace') {
      const confirmed = window.confirm('Deseja substituir textos, benefícios, FAQ, seções e cores pelo modelo recomendado? Logo, produtos, galeria e link público não serão apagados.')
      if (!confirmed) return
    }

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) throw new Error('Sessão expirada.')

      const response = await fetch('/api/site/settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_type: company.business_type || template.businessType,
          mode,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(result.error || 'Erro ao aplicar modelo.')

      const updatedCompany = result.company as PublicSiteCompany
      const nextTemplate = getSiteTemplateByBusinessType(updatedCompany.business_type || updatedCompany.site_template)
      const nextDefaults = getDefaultSiteSettingsForBusiness(updatedCompany.business_type || updatedCompany.site_template)

      setCompany(updatedCompany)
      setSections(normalizeSections(updatedCompany.site_sections, nextTemplate.sections))
      setBenefits(normalizeBenefits(updatedCompany.site_benefits, nextDefaults.site_benefits))
      setFaq(normalizeFaq(updatedCompany.site_faq, nextDefaults.site_faq))
      setMessage(mode === 'replace' ? 'Modelo recomendado aplicado.' : 'Campos vazios preenchidos com o modelo recomendado.')
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar modelo.')
    }

    setSaving(false)
  }

  async function copyLink() {
    const link = publicLink(company)
    if (!link) return

    await navigator.clipboard.writeText(link)
    setMessage('Link copiado.')
    window.setTimeout(() => setMessage(''), 1800)
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f8ff] font-black text-[#05245c]">Carregando editor visual...</main>
  }

  if (!company) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f8ff] font-black text-[#05245c]">Empresa não encontrada.</main>
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-[1500px] space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="min-w-0">
              <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
              <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Editor visual do site</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.06em] sm:text-5xl">Configure sem mexer em código</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                O usuário configura visualmente. O sistema salva tecnicamente por baixo.
              </p>
            </div>

            <div className="rounded-[1.7rem] bg-[#05245c] p-5 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/55">Seu site está</p>
              <p className="mt-2 text-4xl font-black">{completion}% completo</p>
              <div className="mt-4 h-3 rounded-full bg-white/15">
                <div className="h-3 rounded-full bg-white" style={{ width: `${completion}%` }} />
              </div>
              <p className="mt-3 text-sm font-bold text-white/65">
                {completion >= 85 ? 'Site pronto para compartilhar.' : 'Complete os pontos principais antes de divulgar.'}
              </p>
            </div>
          </div>
        </header>

        {dirty ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 font-bold text-amber-700">
            Você tem alterações não salvas.
          </div>
        ) : null}
        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
          <section className="min-w-0 rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5 sm:p-6">
            <div className="flex gap-2 overflow-x-auto rounded-[1.5rem] bg-[#f5f8ff] p-2">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-black transition ${
                    tab === item.id ? 'bg-[#05245c] text-white shadow-lg shadow-blue-950/15' : 'text-slate-500 hover:bg-white hover:text-[#05245c]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-6 min-w-0">
              {tab === 'identidade' ? (
                <div className="grid gap-5">
                  <LogoUploader
                    companyId={company.id}
                    value={company.logo_url}
                    disabled={saving}
                    onChange={(url) => update('logo_url', url)}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[1.5rem] bg-[#f8fbff] p-5">
                      <p className="text-sm font-black text-slate-500">Nome exibido</p>
                      <p className="mt-2 text-2xl font-black tracking-[-0.04em]">{company.nome || 'Sua empresa'}</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">Para mudar o nome, use as configurações da empresa.</p>
                    </div>

                    <div className="rounded-[1.5rem] bg-[#f8fbff] p-5">
                      <p className="text-sm font-black text-slate-500">WhatsApp</p>
                      <p className="mt-2 text-2xl font-black tracking-[-0.04em]">{company.whatsapp || 'Não informado'}</p>
                      <Link href="/painel/configuracoes" className="mt-3 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c] ring-1 ring-blue-100">
                        Editar dados da empresa
                      </Link>
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-600">Tipo de negócio</span>
                    <select
                      value={template.businessType}
                      onChange={(event) => {
                        update('business_type', event.target.value)
                        const nextTemplate = getSiteTemplateByBusinessType(event.target.value)
                        update('site_template', nextTemplate.templateId)
                      }}
                      className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 font-black outline-none focus:border-[#05245c] focus:bg-white"
                    >
                      {siteTemplates.map((item) => <option key={item.businessType} value={item.businessType}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}


              {tab === 'segmento' ? (
                <div className="grid gap-5">
                  <div className="rounded-[1.7rem] border border-blue-100 bg-[#f8fbff] p-5">
                    <p className="text-sm font-black text-[#05245c]">Experiência do site por segmento</p>
                    <h3 className="mt-2 text-3xl font-black tracking-[-0.05em]">{template.label}</h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      O segmento define textos, cards, fluxo do catálogo, formulário de solicitação e checkout exibido para o cliente.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      { title: 'Food', text: 'Cardápio, carrinho, adicionais, cupom, entrega/retirada e pagamento.' },
                      { title: 'Loja / Comércio', text: 'Vitrine de produtos, carrinho simples, cupom e pedido estruturado.' },
                      { title: 'Gráfica / Personalizados', text: 'Orçamento com medidas, quantidade, briefing e observações.' },
                      { title: 'Beauty / Barbearia', text: 'Serviços, preferência de horário, cupom e solicitação/agendamento.' },
                      { title: 'Auto / Assistência', text: 'Diagnóstico, dados do veículo/aparelho, defeito e análise técnica.' },
                      { title: 'Eventos / Serviços', text: 'Pacotes, datas, prazo, local e proposta estruturada.' },
                    ].map((item) => (
                      <article key={item.title} className="rounded-[1.5rem] border border-blue-100 bg-white p-5 shadow-lg shadow-blue-950/5">
                        <p className="font-black text-[#071b3a]">{item.title}</p>
                        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{item.text}</p>
                      </article>
                    ))}
                  </div>

                  <div className="rounded-[1.7rem] bg-blue-50 p-5">
                    <p className="font-black text-[#05245c]">Trocar segmento</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Se trocar o segmento, use “Preencher apenas campos vazios” na aba Capa para aplicar textos e seções recomendadas sem apagar o que já foi configurado.
                    </p>
                  </div>
                </div>
              ) : null}

              {tab === 'capa' ? (
                <div className="grid gap-5">
                  <div className="rounded-[1.7rem] border border-blue-100 bg-[#f8fbff] p-5">
                    <p className="font-black text-[#05245c]">Modelo recomendado para {template.label}</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      O Orçaly pode preencher textos, benefícios, FAQ e seções com base no seu tipo de negócio.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button type="button" onClick={() => applyTemplate('empty')} disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">
                        Preencher apenas campos vazios
                      </button>
                      <button type="button" onClick={() => applyTemplate('replace')} disabled={saving} className="rounded-2xl border border-blue-100 bg-white px-5 py-4 font-black text-[#05245c] disabled:opacity-60">
                        Substituir textos atuais
                      </button>
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-black">Título principal</span>
                    <textarea
                      value={company.site_headline || defaults.site_headline}
                      onChange={(event) => update('site_headline', event.target.value)}
                      rows={3}
                      className="resize-none rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black">Subtítulo</span>
                    <textarea
                      value={company.site_subheadline || defaults.site_subheadline}
                      onChange={(event) => update('site_subheadline', event.target.value)}
                      rows={4}
                      className="resize-none rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black">Texto do botão principal</span>
                    <input
                      value={company.site_cta_label || company.site_cta_text || defaults.site_cta_label}
                      onChange={(event) => update('site_cta_label', event.target.value)}
                      className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white"
                    />
                  </label>
                </div>
              ) : null}

              {tab === 'cores' ? (
                <ColorPalettePicker
                  businessType={template.businessType}
                  primary={company.site_primary_color || template.suggestedColors.primary}
                  accent={company.site_accent_color || template.suggestedColors.accent}
                  onChange={(colors) => {
                    update('site_primary_color', colors.primary)
                    update('site_accent_color', colors.accent)
                    if (colors.theme) update('site_theme', colors.theme)
                  }}
                />
              ) : null}

              {tab === 'secoes' ? (
                <SiteSectionToggles value={sections} onChange={updateSections} />
              ) : null}

              {tab === 'conteudo' ? (
                <div className="grid gap-5">
                  <label className="grid gap-2">
                    <span className="text-sm font-black">Título sobre a empresa</span>
                    <input
                      value={company.site_about_title || defaults.site_about_title}
                      onChange={(event) => update('site_about_title', event.target.value)}
                      className="rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-black">Texto sobre a empresa</span>
                    <textarea
                      value={company.site_about_text || defaults.site_about_text}
                      onChange={(event) => update('site_about_text', event.target.value)}
                      rows={5}
                      className="resize-none rounded-2xl border border-blue-100 bg-[#f8fbff] px-4 py-4 font-bold outline-none focus:border-[#05245c] focus:bg-white"
                    />
                  </label>

                  <BenefitsEditor value={benefits} businessType={template.businessType} onChange={updateBenefits} />
                  <FaqEditor value={faq} businessType={template.businessType} onChange={updateFaq} />
                </div>
              ) : null}

              {tab === 'catalogo' ? (
                <div className="grid gap-5">
                  <div className="rounded-[1.7rem] bg-[#f8fbff] p-5">
                    <p className="text-sm font-black text-[#05245c]">Nome da seção</p>
                    <p className="mt-1 text-3xl font-black tracking-[-0.05em]">{template.catalogLabel}</p>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      Os produtos, serviços ou itens do cardápio são editados na área de Produtos/Marketplace.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      'Mostrar preço quando existir',
                      'WhatsApp como apoio',
                      'Cupom no checkout',
                      'Pedido real no painel',
                      'Mostrar vídeo do produto',
                      'Mostrar selo de destaque',
                      'Mostrar categorias',
                      'Ocultar produtos indisponíveis',
                    ].map((item) => (
                      <div key={item} className="rounded-2xl border border-blue-100 bg-white p-4 font-black text-[#05245c]">
                        ✓ {item}
                      </div>
                    ))}
                  </div>

                  <Link href="/painel/produtos" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">
                    Editar produtos e serviços
                  </Link>
                </div>
              ) : null}


              {tab === 'checkout' ? (
                <div className="grid gap-5">
                  <div className="rounded-[1.7rem] border border-blue-100 bg-[#f8fbff] p-5">
                    <p className="text-sm font-black text-[#05245c]">Marketplace e finalização</p>
                    <h3 className="mt-2 text-3xl font-black tracking-[-0.05em]">Carrinho, cupom, pagamento e pedido real</h3>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                      As funções aparecem no site conforme o segmento e as configurações operacionais da empresa.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      { title: 'Carrinho e pedido real', text: template.businessType === 'food' ? 'Food usa carrinho completo com adicionais e variações.' : 'Demais segmentos usam solicitação estruturada ou carrinho simples quando aplicável.', href: '/painel/produtos' },
                      { title: 'Cupons', text: 'Cupons ativos são validados no checkout e recalculados no servidor.', href: '/painel/cupons' },
                      { title: 'Taxas de entrega', text: 'Food e Loja podem usar regiões, pedido mínimo e taxa automática.', href: '/painel/taxas-entrega' },
                      { title: 'Formas de pagamento', text: 'Pix manual, dinheiro, cartão local e link ficam na central de pagamentos.', href: '/painel/pagamentos?tab=formas' },
                      { title: 'Mercado Pago', text: 'Se conectado, o checkout exibe Pix/cartão online com status automático.', href: '/painel/pagamentos?tab=mercado-pago' },
                      { title: 'Horários', text: 'Food pode exibir aberto/fechado com base na operação configurada.', href: '/painel/horarios' },
                    ].map((item) => (
                      <Link key={item.title} href={item.href} className="rounded-[1.5rem] border border-blue-100 bg-white p-5 shadow-lg shadow-blue-950/5 transition hover:-translate-y-0.5 hover:shadow-xl">
                        <p className="font-black text-[#071b3a]">{item.title}</p>
                        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{item.text}</p>
                        <span className="mt-4 inline-flex rounded-2xl bg-[#05245c] px-4 py-2 text-sm font-black text-white">Configurar</span>
                      </Link>
                    ))}
                  </div>

                  <div className="rounded-[1.7rem] bg-emerald-50 p-5 text-emerald-800">
                    <p className="font-black">WhatsApp continua como apoio</p>
                    <p className="mt-2 text-sm font-bold leading-6">
                      O cliente pode tirar dúvidas pelo WhatsApp, mas o site agora prioriza checkout, solicitação estruturada e pedido salvo no painel.
                    </p>
                  </div>
                </div>
              ) : null}

              {tab === 'preview' ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-[#f8fbff] p-3">
                    <p className="font-black text-[#05245c]">Prévia em tempo real</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPreviewMode('desktop')} className={`rounded-2xl px-4 py-2 text-sm font-black ${previewMode === 'desktop' ? 'bg-[#05245c] text-white' : 'bg-white text-[#05245c]'}`}>Desktop</button>
                      <button type="button" onClick={() => setPreviewMode('mobile')} className={`rounded-2xl px-4 py-2 text-sm font-black ${previewMode === 'mobile' ? 'bg-[#05245c] text-white' : 'bg-white text-[#05245c]'}`}>Mobile</button>
                    </div>
                  </div>

                  <SitePreview company={previewCompany} products={products} mode={previewMode} />

                  <a href={localSitePath(company)} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">
                    Abrir site completo
                  </a>
                </div>
              ) : null}

              {tab === 'publicacao' ? (
                <div className="grid gap-5">
                  <div className="rounded-[1.7rem] bg-[#f8fbff] p-5">
                    <p className="text-sm font-black text-[#05245c]">Seu site está publicado</p>
                    <p className="mt-2 break-all text-2xl font-black">{publicLink(company) || 'Configure o link público da empresa'}</p>
                    <p className="mt-2 text-sm font-bold text-slate-500">
                      Seu site já pode ser acessado. Complete os itens abaixo para deixá-lo mais profissional.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <button type="button" onClick={copyLink} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Copiar link</button>
                    <a href={localSitePath(company)} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-4 text-center font-black text-[#05245c]">Abrir site</a>
                    <a href={whatsappShareLink(company)} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-center font-black text-emerald-700">Compartilhar no WhatsApp</a>
                  </div>

                  <div className="rounded-[1.7rem] bg-blue-50 p-5">
                    <p className="font-black text-[#05245c]">Checklist de qualidade</p>
                    <div className="mt-3 grid gap-2">
                      {checklist.map((item) => (
                        <p key={item.label} className="font-bold text-[#071b3a]">{item.done ? '✓' : '○'} {item.label}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {tab !== 'preview' ? (
                <div className="mt-7 flex flex-wrap gap-3">
                  <button type="button" onClick={save} disabled={saving} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
                    {saving ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                  <a href={localSitePath(company)} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-6 py-4 font-black text-[#05245c]">
                    Ver como cliente
                  </a>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="hidden min-w-0 xl:block">
            <div className="sticky top-6 min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-[#05245c]">Prévia em tempo real</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPreviewMode('desktop')} className={`rounded-full px-3 py-1 text-xs font-black ${previewMode === 'desktop' ? 'bg-[#05245c] text-white' : 'bg-white text-[#05245c]'}`}>Desktop</button>
                  <button type="button" onClick={() => setPreviewMode('mobile')} className={`rounded-full px-3 py-1 text-xs font-black ${previewMode === 'mobile' ? 'bg-[#05245c] text-white' : 'bg-white text-[#05245c]'}`}>Mobile</button>
                </div>
              </div>

              <div className="w-full max-w-full overflow-hidden">
                <SitePreview company={previewCompany} products={products} compact mode={previewMode} />
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
