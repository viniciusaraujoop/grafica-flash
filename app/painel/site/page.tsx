'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Feature = { titulo: string; texto: string }
type FAQ = { pergunta: string; resposta: string }
type Testimonial = { nome: string; texto: string }

function emptyFeature(): Feature {
  return { titulo: '', texto: '' }
}

function emptyFaq(): FAQ {
  return { pergunta: '', resposta: '' }
}

function emptyTestimonial(): Testimonial {
  return { nome: '', texto: '' }
}

export default function PainelSitePublicoPage() {
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'visual' | 'conteudo' | 'loja' | 'contato'>('visual')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [form, setForm] = useState({
    site_publico_ativo: true,
    site_template: 'moderno',
    site_primary_color: '#05245c',
    site_accent_color: '#22c55e',
    site_background_color: '#f5f8ff',
    site_headline: '',
    site_subheadline: '',
    site_cta_text: 'Ver loja',
    site_banner_url: '',
    site_about_title: '',
    site_about_text: '',
    site_services_title: '',
    site_contact_title: '',
    site_show_store: true,
    site_show_about: true,
    site_show_contact: true,
    site_show_featured: true,
    marketplace_ativo: true,
    marketplace_titulo: '',
    marketplace_subtitulo: '',
    marketplace_texto_botao: 'Comprar agora',
    marketplace_endereco: '',
    marketplace_mapa_url: '',
    marketplace_termos: '',
    instagram: '',
    atendimento_horario: '',
    atendimento_observacao: '',
  })

  const [features, setFeatures] = useState<Feature[]>([])
  const [faq, setFaq] = useState<FAQ[]>([])
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])

  function update(field: string, value: any) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function carregarEmpresa(userId: string) {
    const { data: ownCompany, error: ownError } = await supabase
      .from('companies')
      .select('*')
      .or(`owner_id.eq.${userId},tester_id.eq.${userId}`)
      .maybeSingle()

    if (ownError) throw ownError
    if (ownCompany) return ownCompany

    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('company_id,cargo,status')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .maybeSingle()

    if (memberError) throw memberError
    if (!member?.company_id) return null

    const { data: memberCompany, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', member.company_id)
      .maybeSingle()

    if (companyError) throw companyError
    return memberCompany
  }

  async function carregar() {
    setLoading(true)
    setErro('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user

      if (!user) {
        window.location.href = '/login'
        return
      }

      const empresa = await carregarEmpresa(user.id)

      if (!empresa) {
        setErro('Empresa não encontrada.')
        setLoading(false)
        return
      }

      setCompany(empresa)
      setForm({
        site_publico_ativo: empresa.site_publico_ativo !== false,
        site_template: empresa.site_template || 'moderno',
        site_primary_color: empresa.site_primary_color || empresa.cor_principal || '#05245c',
        site_accent_color: empresa.site_accent_color || '#22c55e',
        site_background_color: empresa.site_background_color || '#f5f8ff',
        site_headline: empresa.site_headline || '',
        site_subheadline: empresa.site_subheadline || '',
        site_cta_text: empresa.site_cta_text || 'Ver loja',
        site_banner_url: empresa.site_banner_url || empresa.marketplace_banner_url || '',
        site_about_title: empresa.site_about_title || '',
        site_about_text: empresa.site_about_text || empresa.marketplace_sobre || '',
        site_services_title: empresa.site_services_title || '',
        site_contact_title: empresa.site_contact_title || '',
        site_show_store: empresa.site_show_store !== false,
        site_show_about: empresa.site_show_about !== false,
        site_show_contact: empresa.site_show_contact !== false,
        site_show_featured: empresa.site_show_featured !== false,
        marketplace_ativo: empresa.marketplace_ativo !== false,
        marketplace_titulo: empresa.marketplace_titulo || '',
        marketplace_subtitulo: empresa.marketplace_subtitulo || '',
        marketplace_texto_botao: empresa.marketplace_texto_botao || 'Comprar agora',
        marketplace_endereco: empresa.marketplace_endereco || '',
        marketplace_mapa_url: empresa.marketplace_mapa_url || '',
        marketplace_termos: empresa.marketplace_termos || '',
        instagram: empresa.instagram || '',
        atendimento_horario: empresa.atendimento_horario || '',
        atendimento_observacao: empresa.atendimento_observacao || '',
      })

      setFeatures(Array.isArray(empresa.site_features) ? empresa.site_features : [])
      setFaq(Array.isArray(empresa.site_faq) ? empresa.site_faq : [])
      setTestimonials(Array.isArray(empresa.site_testimonials) ? empresa.site_testimonials : [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar site.')
    }

    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function uploadBanner(file: File) {
    if (!company) return

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${company.id}/site/banner-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('site-assets')
      .upload(path, file, { upsert: true })

    if (error) {
      setErro(error.message)
      return
    }

    const { data } = supabase.storage.from('site-assets').getPublicUrl(path)
    update('site_banner_url', data.publicUrl)
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!company) return

    setSaving(true)
    setErro('')
    setMessage('')

    const payload = {
      ...form,
      site_features: features.filter((item) => item.titulo || item.texto),
      site_faq: faq.filter((item) => item.pergunta || item.resposta),
      site_testimonials: testimonials.filter((item) => item.nome || item.texto),
      site_updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', company.id)

    if (error) {
      setErro(error.message)
    } else {
      setMessage('Site público atualizado.')
      await carregar()
    }

    setSaving(false)
  }

  const previewUrl = company ? `/site/${company.slug}` : '#'

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando editor do site...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl">
        <header className="mb-6 overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white shadow-2xl shadow-blue-950/8">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 right-36 h-48 w-48 rounded-full bg-emerald-100 blur-3xl" />

            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link>
                <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[#071b3a] sm:text-5xl">
                  Site público
                </h1>
                <p className="mt-3 max-w-2xl font-bold leading-7 text-slate-500">
                  Edite visual, textos, seções, contato e a loja integrada da empresa.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[400px]">
                <a href={previewUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">
                  Ver site
                </a>
                <Link href="/painel/catalogo" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center font-black text-[#05245c]">
                  Editar catálogo
                </Link>
              </div>
            </div>
          </div>
        </header>

        {message && <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div>}
        {erro && <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 font-bold text-red-700">{erro}</div>}

        <div className="mb-5 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-blue-100 bg-white p-2 shadow-lg shadow-blue-950/5">
          {[
            ['visual', 'Visual'],
            ['conteudo', 'Conteúdo'],
            ['loja', 'Loja'],
            ['contato', 'Contato'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as any)}
              className={`whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-black transition ${
                activeTab === id ? 'bg-[#05245c] text-white shadow-lg shadow-[#05245c]/20' : 'text-slate-500 hover:bg-blue-50 hover:text-[#05245c]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={salvar} className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            {activeTab === 'visual' && (
              <div className="grid gap-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Aparência</p>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Visual do site</h2>
                </div>

                <label className="flex items-center gap-3 rounded-2xl bg-[#f5f8ff] p-4 font-black text-slate-700">
                  <input type="checkbox" checked={form.site_publico_ativo} onChange={(e) => update('site_publico_ativo', e.target.checked)} />
                  Site público ativo
                </label>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Cor principal</span>
                    <input type="color" value={form.site_primary_color} onChange={(e) => update('site_primary_color', e.target.value)} className="h-14 rounded-2xl border border-slate-200 bg-slate-50 p-2" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Cor de destaque</span>
                    <input type="color" value={form.site_accent_color} onChange={(e) => update('site_accent_color', e.target.value)} className="h-14 rounded-2xl border border-slate-200 bg-slate-50 p-2" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Fundo</span>
                    <input type="color" value={form.site_background_color} onChange={(e) => update('site_background_color', e.target.value)} className="h-14 rounded-2xl border border-slate-200 bg-slate-50 p-2" />
                  </label>
                </div>

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadBanner(e.target.files?.[0] as File)} />

                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <p className="font-black">Banner principal</p>
                  <p className="mt-1 text-sm font-bold text-slate-500">Use uma imagem horizontal para o topo do site.</p>

                  {form.site_banner_url && <img src={form.site_banner_url} alt="Banner" className="mt-4 aspect-video w-full rounded-2xl object-cover" />}

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input value={form.site_banner_url} onChange={(e) => update('site_banner_url', e.target.value)} placeholder="URL do banner" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-bold outline-none" />
                    <button type="button" onClick={() => fileRef.current?.click()} className="rounded-2xl bg-blue-50 px-5 py-4 font-black text-[#05245c]">
                      Enviar imagem
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-2xl bg-[#f5f8ff] p-4 font-black text-slate-700">
                    <input type="checkbox" checked={form.site_show_store} onChange={(e) => update('site_show_store', e.target.checked)} />
                    Mostrar aba Loja
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl bg-[#f5f8ff] p-4 font-black text-slate-700">
                    <input type="checkbox" checked={form.site_show_about} onChange={(e) => update('site_show_about', e.target.checked)} />
                    Mostrar aba Sobre
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl bg-[#f5f8ff] p-4 font-black text-slate-700">
                    <input type="checkbox" checked={form.site_show_contact} onChange={(e) => update('site_show_contact', e.target.checked)} />
                    Mostrar aba Contato
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl bg-[#f5f8ff] p-4 font-black text-slate-700">
                    <input type="checkbox" checked={form.site_show_featured} onChange={(e) => update('site_show_featured', e.target.checked)} />
                    Mostrar destaques na home
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'conteudo' && (
              <div className="grid gap-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Conteúdo</p>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Textos e seções</h2>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Título principal</span>
                  <input value={form.site_headline} onChange={(e) => update('site_headline', e.target.value)} placeholder={`Ex.: ${company?.nome} online`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Subtítulo</span>
                  <textarea value={form.site_subheadline} onChange={(e) => update('site_subheadline', e.target.value)} rows={3} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Texto do botão principal</span>
                  <input value={form.site_cta_text} onChange={(e) => update('site_cta_text', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Título Sobre</span>
                    <input value={form.site_about_title} onChange={(e) => update('site_about_title', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Título Contato</span>
                    <input value={form.site_contact_title} onChange={(e) => update('site_contact_title', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Texto Sobre</span>
                  <textarea value={form.site_about_text} onChange={(e) => update('site_about_text', e.target.value)} rows={6} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <div className="rounded-2xl bg-[#f5f8ff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black">Destaques da empresa</p>
                    <button type="button" onClick={() => setFeatures((v) => [...v, emptyFeature()])} className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#05245c]">+ Adicionar</button>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {features.map((feature, index) => (
                      <div key={index} className="grid gap-2 rounded-2xl bg-white p-3">
                        <input value={feature.titulo} onChange={(e) => setFeatures((v) => v.map((item, i) => i === index ? { ...item, titulo: e.target.value } : item))} placeholder="Título" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold outline-none" />
                        <textarea value={feature.texto} onChange={(e) => setFeatures((v) => v.map((item, i) => i === index ? { ...item, texto: e.target.value } : item))} placeholder="Texto" rows={2} className="resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-bold outline-none" />
                        <button type="button" onClick={() => setFeatures((v) => v.filter((_, i) => i !== index))} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">Remover</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'loja' && (
              <div className="grid gap-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Loja integrada</p>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Configurações da loja</h2>
                </div>

                <label className="flex items-center gap-3 rounded-2xl bg-[#f5f8ff] p-4 font-black text-slate-700">
                  <input type="checkbox" checked={form.marketplace_ativo} onChange={(e) => update('marketplace_ativo', e.target.checked)} />
                  Loja ativa dentro do site
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Título da loja</span>
                  <input value={form.marketplace_titulo} onChange={(e) => update('marketplace_titulo', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Subtítulo da loja</span>
                  <textarea value={form.marketplace_subtitulo} onChange={(e) => update('marketplace_subtitulo', e.target.value)} rows={3} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Texto do botão da loja</span>
                  <input value={form.marketplace_texto_botao} onChange={(e) => update('marketplace_texto_botao', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="font-black text-[#05245c]">Produtos, fotos, materiais, sabores, tecidos e opcionais</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                    Isso é editado no Catálogo, para não misturar visual do site com cadastro de produto. Uma rara decisão sensata no caos.
                  </p>
                  <Link href="/painel/catalogo" className="mt-4 inline-flex rounded-2xl bg-[#05245c] px-5 py-3 font-black text-white">
                    Editar catálogo
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'contato' && (
              <div className="grid gap-5">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Contato</p>
                  <h2 className="mt-1 text-3xl font-black tracking-[-0.04em]">Dados públicos</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Instagram</span>
                    <input value={form.instagram} onChange={(e) => update('instagram', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-black text-slate-700">Horário</span>
                    <input value={form.atendimento_horario} onChange={(e) => update('atendimento_horario', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Endereço/localização</span>
                  <input value={form.marketplace_endereco} onChange={(e) => update('marketplace_endereco', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Link do Google Maps</span>
                  <input value={form.marketplace_mapa_url} onChange={(e) => update('marketplace_mapa_url', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Observações de atendimento</span>
                  <textarea value={form.atendimento_observacao} onChange={(e) => update('atendimento_observacao', e.target.value)} rows={4} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-slate-700">Termos da loja</span>
                  <textarea value={form.marketplace_termos} onChange={(e) => update('marketplace_termos', e.target.value)} rows={4} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold outline-none" />
                </label>
              </div>
            )}
          </section>

          <aside className="grid gap-5">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Prévia</p>

              <div className="mt-4 overflow-hidden rounded-[2rem] border border-slate-200" style={{ background: form.site_background_color }}>
                {form.site_banner_url && <img src={form.site_banner_url} alt="Banner" className="aspect-video w-full object-cover opacity-80" />}
                <div className="p-5">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black" style={{ color: form.site_primary_color }}>Site oficial</span>
                  <h3 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#071b3a]">{form.site_headline || `${company?.nome} online`}</h3>
                  <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{form.site_subheadline || 'Texto de apresentação do site público.'}</p>
                  <button type="button" className="mt-4 rounded-2xl px-4 py-3 font-black text-white" style={{ background: form.site_primary_color }}>{form.site_cta_text}</button>
                </div>
              </div>
            </section>

            <button disabled={saving} className="rounded-2xl bg-[#05245c] px-5 py-5 font-black text-white disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar site público'}
            </button>
          </aside>
        </form>
      </section>
    </main>
  )
}
