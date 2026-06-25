'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { siteTemplates } from '@/lib/orcaly-site-templates'
import { getAccessTokenClient } from '@/lib/current-company-client'

type Tab = 'template' | 'visual' | 'conteudo' | 'secoes' | 'comercial' | 'seo' | 'preview'

type ItemText = {
  titulo?: string
  texto?: string
  pergunta?: string
  resposta?: string
  nome?: string
  tipo?: string
}

const emptyFeature = () => ({ titulo: '', texto: '' })
const emptyFaq = () => ({ pergunta: '', resposta: '' })
const emptyTestimonial = () => ({ nome: '', texto: '' })
const emptyGallery = () => ({ titulo: '', texto: '', tipo: 'card' })

function fieldHelp(title: string, text: string) {
  return (
    <div className="mb-2">
      <p className="text-sm font-black text-[#071b3a]">{title}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{text}</p>
    </div>
  )
}

function TabButton({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.25rem] border p-4 text-left transition hover:-translate-y-0.5 ${
        active ? 'border-[#05245c] bg-[#05245c] text-white shadow-xl shadow-blue-950/15' : 'border-blue-100 bg-white text-[#071b3a]'
      }`}
    >
      <p className="font-black">{title}</p>
      <p className={`mt-1 text-xs font-bold leading-5 ${active ? 'text-white/75' : 'text-slate-500'}`}>{desc}</p>
    </button>
  )
}

function Input({ label, help, value, onChange, placeholder }: { label: string; help: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      {fieldHelp(label, help)}
      <input
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold text-[#071b3a] outline-none transition focus:border-[#05245c]"
      />
    </label>
  )
}

function TextArea({ label, help, value, onChange, placeholder, rows = 4 }: { label: string; help: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="block">
      {fieldHelp(label, help)}
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold leading-7 text-[#071b3a] outline-none transition focus:border-[#05245c]"
      />
    </label>
  )
}

function Toggle({ checked, label, help, onChange }: { checked: boolean; label: string; help: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-2xl border p-4 text-left transition ${checked ? 'border-[#05245c] bg-blue-50' : 'border-slate-200 bg-white'}`}
    >
      <p className="font-black text-[#071b3a]">{label}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{help}</p>
      <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black ${checked ? 'bg-[#05245c] text-white' : 'bg-slate-100 text-slate-500'}`}>
        {checked ? 'Ativo' : 'Oculto'}
      </p>
    </button>
  )
}

function ArtPreview({ style, primary, accent }: { style: string; primary: string; accent: string }) {
  return (
    <div
      className="relative min-h-[240px] overflow-hidden rounded-[2rem] border border-white/70 p-5 text-white shadow-2xl shadow-blue-950/15"
      style={{
        background: `radial-gradient(circle at 15% 20%, ${accent}aa, transparent 30%), linear-gradient(135deg, ${primary}, #020617)`,
      }}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute bottom-6 right-6 grid grid-cols-3 gap-2 opacity-70">
        {Array.from({ length: 9 }).map((_, index) => <span key={index} className="h-10 w-10 rounded-2xl bg-white/20" />)}
      </div>
      <p className="relative text-xs font-black uppercase tracking-[0.2em] text-white/70">Arte pré-pronta</p>
      <h3 className="relative mt-4 text-3xl font-black tracking-[-0.04em]">{style}</h3>
      <p className="relative mt-3 max-w-sm text-sm font-bold leading-6 text-white/75">
        Visual automático para o segmento. Não é imagem pesada, é layout dinâmico com cara de site pronto.
      </p>
    </div>
  )
}

export default function PainelSitePremiumPage() {
  const [tab, setTab] = useState<Tab>('template')
  const [token, setToken] = useState('')
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [erro, setErro] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('grafica')

  const [form, setForm] = useState<any>({
    site_publico_ativo: true,
    site_template: 'grafica',
    site_layout: 'moderno',
    site_art_style: 'profissional',
    site_font_style: 'inter',
    site_button_style: 'arredondado',
    site_hero_alignment: 'esquerda',
    site_primary_color: '#05245c',
    site_accent_color: '#22c55e',
    site_background_color: '#f5f8ff',
    site_text_color: '#071b3a',
    site_card_color: '#ffffff',
    site_badge_text: '',
    site_headline: '',
    site_subheadline: '',
    site_cta_text: 'Pedir orçamento',
    site_secondary_cta_text: 'Ver catálogo',
    site_banner_url: '',
    site_whatsapp_message: '',
    site_about_title: '',
    site_about_text: '',
    site_services_title: '',
    site_contact_title: '',
    site_show_store: true,
    site_show_about: true,
    site_show_contact: true,
    site_show_featured: true,
    site_show_faq: true,
    site_show_testimonials: true,
    site_show_gallery: true,
    site_show_benefits: true,
    site_features: [],
    site_benefits: [],
    site_faq: [],
    site_testimonials: [],
    site_gallery: [],
    site_custom_sections: [],
    site_seo_title: '',
    site_seo_description: '',
    site_keywords: [],
    site_promo_title: '',
    site_promo_text: '',
    site_promo_active: false,
    site_promo_button_text: 'Aproveitar oferta',
    site_payment_methods: [],
    site_delivery_options: [],
    marketplace_endereco: '',
    marketplace_mapa_url: '',
    atendimento_horario: '',
    atendimento_observacao: '',
    instagram: '',
    whatsapp: '',
    cidade: '',
    estado: '',
  })

  function update(field: string, value: any) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  const publicUrl = useMemo(() => {
    if (!company?.slug) return ''
    return `/site/${company.slug}`
  }, [company])

  async function load() {
    setLoading(true)
    setErro('')
    setMessage('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch('/api/site/settings', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json()

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar site.')

      const data = payload.company || {}
      setCompany(data)
      setSelectedTemplate(data.site_template || data.modelo_negocio || 'grafica')
      setForm((current: any) => ({ ...current, ...data }))
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar configurações.')
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function applyTemplate(templateId: string) {
    setSaving(true)
    setErro('')
    setMessage('')

    const response = await fetch('/api/site/settings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ template: templateId }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setErro(payload.error || 'Erro ao aplicar template.')
      setSaving(false)
      return
    }

    setCompany(payload.company)
    setForm((current: any) => ({ ...current, ...payload.company }))
    setSelectedTemplate(templateId)
    setMessage('Site pré-desenhado aplicado. Agora você pode personalizar sem começar do zero.')
    setSaving(false)
  }

  async function save(event?: FormEvent) {
    event?.preventDefault()
    setSaving(true)
    setErro('')
    setMessage('')

    const response = await fetch('/api/site/settings', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    })

    const payload = await response.json()

    if (!response.ok) {
      setErro(payload.error || 'Erro ao salvar site.')
      setSaving(false)
      return
    }

    setCompany(payload.company)
    setForm((current: any) => ({ ...current, ...payload.company }))
    setMessage('Site salvo com sucesso.')
    setSaving(false)
  }

  function updateArray(field: string, index: number, key: string, value: string) {
    const list = Array.isArray(form[field]) ? [...form[field]] : []
    list[index] = { ...(list[index] || {}), [key]: value }
    update(field, list)
  }

  function addArray(field: string, item: any) {
    update(field, [...(Array.isArray(form[field]) ? form[field] : []), item])
  }

  function removeArray(field: string, index: number) {
    update(field, (Array.isArray(form[field]) ? form[field] : []).filter((_: any, i: number) => i !== index))
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando configuração do site...</div></main>
  }

  const templateAtual = siteTemplates.find((template) => template.id === selectedTemplate) || siteTemplates[0]

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Site da empresa</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Escolha um site pré-desenhado por ramo, personalize cores, textos, seções, promoções e SEO. Aqui o cliente não começa do zero, porque isso seria crueldade digital.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {publicUrl && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-white px-5 py-3 text-sm font-black text-[#05245c]">
                  Abrir site
                </a>
              )}
              <button onClick={() => save()} disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar site'}
              </button>
            </div>
          </div>
        </header>

        {message && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {erro && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="grid gap-6 xl:grid-cols-[310px_1fr]">
          <aside className="rounded-[2rem] border border-blue-100 bg-white p-4 shadow-xl shadow-blue-950/5 xl:sticky xl:top-6 xl:self-start">
            <div className="mb-4 rounded-[1.5rem] bg-[#f5f8ff] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Editor premium</p>
              <p className="mt-2 text-lg font-black">Configuração guiada</p>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-500">Cada aba mexe em uma parte do site. Menos caos, mais controle.</p>
            </div>

            <div className="grid gap-3">
              <TabButton active={tab === 'template'} onClick={() => setTab('template')} title="Templates" desc="Sites prontos por ramo" />
              <TabButton active={tab === 'visual'} onClick={() => setTab('visual')} title="Visual" desc="Cores, arte e estilo" />
              <TabButton active={tab === 'conteudo'} onClick={() => setTab('conteudo')} title="Textos" desc="Hero, sobre e CTA" />
              <TabButton active={tab === 'secoes'} onClick={() => setTab('secoes')} title="Seções" desc="Benefícios, FAQ e provas" />
              <TabButton active={tab === 'comercial'} onClick={() => setTab('comercial')} title="Comercial" desc="Contato, oferta e formas" />
              <TabButton active={tab === 'seo'} onClick={() => setTab('seo')} title="SEO" desc="Google e descrição" />
              <TabButton active={tab === 'preview'} onClick={() => setTab('preview')} title="Prévia" desc="Resumo antes de salvar" />
            </div>
          </aside>

          <form onSubmit={save} className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5 sm:p-6">
            {tab === 'template' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Sites pré-desenhados</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Escolha o ramo do cliente</h2>
                  <p className="mt-2 max-w-3xl font-bold leading-7 text-slate-500">
                    O Orçaly aplica textos, paleta, seções, artes visuais, perguntas e estrutura comercial. Depois o usuário edita o que quiser.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {siteTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`rounded-[1.6rem] border p-4 text-left transition hover:-translate-y-1 ${
                        selectedTemplate === template.id ? 'border-[#05245c] bg-blue-50 shadow-xl shadow-blue-950/10' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="h-28 rounded-[1.2rem]" style={{ background: `linear-gradient(135deg, ${template.paleta.primary}, ${template.paleta.accent})` }} />
                      <p className="mt-4 text-lg font-black">{template.nome}</p>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{template.descricao}</p>
                    </button>
                  ))}
                </div>

                <div className="rounded-[1.8rem] bg-[#f5f8ff] p-5">
                  <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                    <div>
                      <h3 className="text-2xl font-black">{templateAtual.nome}</h3>
                      <p className="mt-2 font-bold leading-7 text-slate-500">{templateAtual.descricao}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {templateAtual.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#05245c]">{keyword}</span>)}
                      </div>
                      <button type="button" onClick={() => applyTemplate(selectedTemplate)} disabled={saving} className="mt-5 rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white disabled:opacity-60">
                        Aplicar este site pré-desenhado
                      </button>
                    </div>
                    <ArtPreview style={templateAtual.arte} primary={templateAtual.paleta.primary} accent={templateAtual.paleta.accent} />
                  </div>
                </div>
              </div>
            )}

            {tab === 'visual' && (
              <div className="grid gap-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Identidade visual</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Como o site deve parecer?</h2>
                  <p className="mt-2 font-bold leading-7 text-slate-500">Aqui o usuário controla a aparência sem abrir Figma, Canva ou outro calvário moderno.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Cor principal" help="Usada no topo, botões e áreas fortes do site." value={form.site_primary_color} onChange={(v) => update('site_primary_color', v)} />
                  <Input label="Cor de destaque" help="Usada em detalhes, selos, ícones e chamadas." value={form.site_accent_color} onChange={(v) => update('site_accent_color', v)} />
                  <Input label="Cor de fundo" help="Define a sensação geral da página." value={form.site_background_color} onChange={(v) => update('site_background_color', v)} />
                  <Input label="Cor do texto" help="Use uma cor escura para facilitar leitura." value={form.site_text_color} onChange={(v) => update('site_text_color', v)} />
                  <Input label="URL do banner" help="Imagem principal opcional. Se deixar vazio, o Orçaly usa arte automática do template." value={form.site_banner_url} onChange={(v) => update('site_banner_url', v)} />
                  <label>
                    {fieldHelp('Estilo da arte automática', 'Controla a arte pré-pronta exibida quando não há banner.')}
                    <select value={form.site_art_style || 'profissional'} onChange={(e) => update('site_art_style', e.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none">
                      <option value="profissional">Profissional</option>
                      <option value="print-grid">Gráfica moderna</option>
                      <option value="food-warm">Alimentício quente</option>
                      <option value="real-estate">Imobiliário premium</option>
                      <option value="creative">Criativo</option>
                      <option value="tech">Tecnologia</option>
                      <option value="beauty">Beleza</option>
                      <option value="auto">Automotivo</option>
                    </select>
                  </label>
                </div>

                <ArtPreview style={form.site_art_style || 'profissional'} primary={form.site_primary_color} accent={form.site_accent_color} />
              </div>
            )}

            {tab === 'conteudo' && (
              <div className="grid gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Textos principais</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">O que o cliente vê primeiro</h2>
                  <p className="mt-2 font-bold leading-7 text-slate-500">Essa parte vende. Texto ruim aqui é como placa torta na fachada: todo mundo vê e finge que não.</p>
                </div>

                <Input label="Selo acima do título" help="Frase curta para posicionar a empresa. Ex: Gráfica rápida e profissional." value={form.site_badge_text} onChange={(v) => update('site_badge_text', v)} />
                <Input label="Título principal" help="A promessa principal da empresa. Seja claro, direto e específico." value={form.site_headline} onChange={(v) => update('site_headline', v)} />
                <TextArea label="Subtítulo" help="Explique o que a empresa faz, para quem e como o cliente deve seguir." value={form.site_subheadline} onChange={(v) => update('site_subheadline', v)} />
                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="Botão principal" help="Chamada de ação mais importante. Ex: Pedir orçamento." value={form.site_cta_text} onChange={(v) => update('site_cta_text', v)} />
                  <Input label="Botão secundário" help="Ação alternativa. Ex: Ver catálogo." value={form.site_secondary_cta_text} onChange={(v) => update('site_secondary_cta_text', v)} />
                </div>
                <Input label="Título do Sobre" help="Nome da seção que explica a empresa." value={form.site_about_title} onChange={(v) => update('site_about_title', v)} />
                <TextArea label="Texto do Sobre" help="Conte o que a empresa faz, diferenciais, atendimento e região." value={form.site_about_text} onChange={(v) => update('site_about_text', v)} />
              </div>
            )}

            {tab === 'secoes' && (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Seções do site</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Conteúdo editável</h2>
                  <p className="mt-2 font-bold leading-7 text-slate-500">Benefícios, perguntas frequentes, depoimentos e galeria. Tudo editável, porque cada negócio inventa sua própria novela.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Toggle checked={!!form.site_show_benefits} label="Benefícios" help="Mostra vantagens e diferenciais." onChange={(v) => update('site_show_benefits', v)} />
                  <Toggle checked={!!form.site_show_gallery} label="Galeria" help="Mostra artes pré-prontas e serviços." onChange={(v) => update('site_show_gallery', v)} />
                  <Toggle checked={!!form.site_show_faq} label="FAQ" help="Responde dúvidas comuns." onChange={(v) => update('site_show_faq', v)} />
                  <Toggle checked={!!form.site_show_testimonials} label="Depoimentos" help="Prova social e confiança." onChange={(v) => update('site_show_testimonials', v)} />
                </div>

                {[
                  ['site_features', 'Diferenciais', emptyFeature(), ['titulo', 'texto']],
                  ['site_benefits', 'Benefícios', emptyFeature(), ['titulo', 'texto']],
                  ['site_gallery', 'Galeria / artes pré-prontas', emptyGallery(), ['titulo', 'texto', 'tipo']],
                  ['site_faq', 'Perguntas frequentes', emptyFaq(), ['pergunta', 'resposta']],
                  ['site_testimonials', 'Depoimentos', emptyTestimonial(), ['nome', 'texto']],
                ].map(([field, title, empty, keys]) => (
                  <div key={field as string} className="rounded-[1.8rem] bg-[#f5f8ff] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-black">{title as string}</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">Edite, adicione ou remova blocos dessa seção.</p>
                      </div>
                      <button type="button" onClick={() => addArray(field as string, empty)} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#05245c]">
                        Adicionar
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {(Array.isArray(form[field as string]) ? form[field as string] : []).map((item: ItemText, index: number) => (
                        <div key={index} className="rounded-2xl bg-white p-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            {(keys as string[]).map((key) => (
                              <input
                                key={key}
                                value={String((item as any)[key] || '')}
                                onChange={(event) => updateArray(field as string, index, key, event.target.value)}
                                placeholder={key}
                                className="rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none"
                              />
                            ))}
                          </div>
                          <button type="button" onClick={() => removeArray(field as string, index)} className="mt-3 text-sm font-black text-red-600">
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'comercial' && (
              <div className="grid gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Conversão</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Contato, promoção e atendimento</h2>
                  <p className="mt-2 font-bold leading-7 text-slate-500">Configurações que fazem o cliente sair do “só olhando” para “vou chamar agora”. Teoricamente.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input label="WhatsApp" help="Número usado nos botões do site." value={form.whatsapp} onChange={(v) => update('whatsapp', v)} />
                  <Input label="Instagram" help="Perfil público exibido no rodapé/contato." value={form.instagram} onChange={(v) => update('instagram', v)} />
                  <Input label="Cidade" help="Ajuda o cliente local a entender a região." value={form.cidade} onChange={(v) => update('cidade', v)} />
                  <Input label="Estado" help="UF ou estado da empresa." value={form.estado} onChange={(v) => update('estado', v)} />
                </div>

                <TextArea label="Mensagem pronta do WhatsApp" help="Texto que será aberto automaticamente quando o cliente clicar para chamar." value={form.site_whatsapp_message} onChange={(v) => update('site_whatsapp_message', v)} />
                <Input label="Endereço" help="Endereço físico, loja, escritório ou ponto de retirada." value={form.marketplace_endereco} onChange={(v) => update('marketplace_endereco', v)} />
                <Input label="Link do mapa" help="Cole o link do Google Maps para facilitar localização." value={form.marketplace_mapa_url} onChange={(v) => update('marketplace_mapa_url', v)} />
                <Input label="Horário de atendimento" help="Ex: Segunda a sexta, 8h às 18h." value={form.atendimento_horario} onChange={(v) => update('atendimento_horario', v)} />

                <div className="rounded-[1.8rem] bg-[#f5f8ff] p-5">
                  <Toggle checked={!!form.site_promo_active} label="Ativar faixa promocional" help="Mostra uma chamada de oferta no site." onChange={(v) => update('site_promo_active', v)} />
                  <div className="mt-4 grid gap-4">
                    <Input label="Título da promoção" help="Ex: Combo especial da semana." value={form.site_promo_title} onChange={(v) => update('site_promo_title', v)} />
                    <TextArea label="Texto da promoção" help="Explique a condição, benefício ou urgência." value={form.site_promo_text} onChange={(v) => update('site_promo_text', v)} />
                    <Input label="Botão da promoção" help="Texto do botão promocional." value={form.site_promo_button_text} onChange={(v) => update('site_promo_button_text', v)} />
                  </div>
                </div>
              </div>
            )}

            {tab === 'seo' && (
              <div className="grid gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">SEO básico</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Como o site aparece no Google</h2>
                  <p className="mt-2 font-bold leading-7 text-slate-500">Não é magia, mas ajuda. SEO também não salva empresa sem produto, infelizmente.</p>
                </div>

                <Input label="Título SEO" help="Título que aparece em buscas e abas do navegador." value={form.site_seo_title} onChange={(v) => update('site_seo_title', v)} />
                <TextArea label="Descrição SEO" help="Resumo da empresa em até 160 caracteres, de preferência." value={form.site_seo_description} onChange={(v) => update('site_seo_description', v)} />
                <TextArea label="Palavras-chave" help="Separe por vírgula. Ex: gráfica, adesivo, banner, Maceió." value={(form.site_keywords || []).join(', ')} onChange={(v) => update('site_keywords', v.split(',').map((item) => item.trim()).filter(Boolean))} />
              </div>
            )}

            {tab === 'preview' && (
              <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#05245c]">Prévia resumida</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">{form.site_headline || 'Título do site'}</h2>
                  <p className="mt-3 font-bold leading-7 text-slate-500">{form.site_subheadline || 'Subtítulo do site aparecerá aqui.'}</p>
                  <div className="mt-5 rounded-[1.8rem] bg-[#f5f8ff] p-5">
                    <p className="font-black">{form.site_about_title || 'Sobre a empresa'}</p>
                    <p className="mt-2 font-bold leading-7 text-slate-500">{form.site_about_text || 'Texto institucional aparecerá aqui.'}</p>
                  </div>
                </div>
                <ArtPreview style={form.site_art_style || 'profissional'} primary={form.site_primary_color} accent={form.site_accent_color} />
              </div>
            )}

            <div className="mt-8 flex justify-end">
              <button type="submit" disabled={saving} className="rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white shadow-xl shadow-blue-950/10 disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
