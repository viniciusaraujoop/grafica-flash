'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = any
type Secao = any

const TIPOS = [
  { id: 'hero', nome: 'Topo principal' },
  { id: 'services', nome: 'Serviços/produtos' },
  { id: 'trust', nome: 'Diferenciais' },
  { id: 'about', nome: 'Sobre' },
  { id: 'cta', nome: 'Chamada para ação' },
  { id: 'custom', nome: 'Bloco livre' },
]

function dominioPreview(empresa: Empresa | null) {
  if (!empresa) return ''
  const base = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'
  const sub = empresa.subdomain_slug || String(empresa.slug || '').replace(/[^a-z0-9]/g, '')
  return `https://${sub}.${base}`
}

export default function SiteBuilderPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [selecionada, setSelecionada] = useState<Secao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) throw new Error('Você precisa estar logado.')

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .select('id, nome, slug, subdomain_slug, site_primary_color, site_accent_color, site_status, site_template')
        .or(`owner_id.eq.${user.id},tester_id.eq.${user.id}`)
        .maybeSingle()

      if (empresaError) throw empresaError
      if (!empresaData) throw new Error('Empresa não encontrada.')

      setEmpresa(empresaData)

      const { data: secoesData, error: secoesError } = await supabase
        .from('site_sections')
        .select('*')
        .eq('company_id', empresaData.id)
        .order('sort_order', { ascending: true })

      if (secoesError) throw secoesError

      setSecoes(secoesData || [])
      setSelecionada((secoesData || [])[0] || null)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar editor.')
    }
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvarEmpresa(campo: string, valor: string) {
    if (!empresa) return
    setEmpresa({ ...empresa, [campo]: valor })
    await supabase.from('companies').update({ [campo]: valor, site_updated_at: new Date().toISOString() }).eq('id', empresa.id)
  }

  async function salvarSecao(secao: Secao) {
    setMensagem('Salvando...')
    const { error } = await supabase.from('site_sections').update({
      type: secao.type,
      title: secao.title,
      subtitle: secao.subtitle,
      content: secao.content,
      image_url: secao.image_url,
      button_label: secao.button_label,
      button_url: secao.button_url,
      sort_order: secao.sort_order,
      active: secao.active,
      config: secao.config || {},
      updated_at: new Date().toISOString(),
    }).eq('id', secao.id)

    if (error) setMensagem(error.message)
    else {
      setMensagem('Seção salva.')
      setSecoes((lista) => lista.map((item) => item.id === secao.id ? secao : item))
    }
  }

  async function adicionarSecao() {
    if (!empresa) return
    const { data, error } = await supabase.from('site_sections').insert({
      company_id: empresa.id,
      type: 'custom',
      title: 'Nova seção',
      subtitle: 'Subtítulo da seção',
      content: 'Escreva aqui o conteúdo desta seção.',
      sort_order: secoes.length + 1,
      active: true,
      config: {},
    }).select('*').single()

    if (error) return setMensagem(error.message)
    setSecoes((lista) => [...lista, data])
    setSelecionada(data)
  }

  async function excluirSecao(id: string) {
    if (!confirm('Remover esta seção?')) return
    const { error } = await supabase.from('site_sections').delete().eq('id', id)
    if (error) return setMensagem(error.message)
    const novas = secoes.filter((s) => s.id !== id)
    setSecoes(novas)
    setSelecionada(novas[0] || null)
  }

  async function mover(secao: Secao, direcao: 'cima' | 'baixo') {
    const ordenadas = [...secoes].sort((a, b) => a.sort_order - b.sort_order)
    const i = ordenadas.findIndex((s) => s.id === secao.id)
    const j = direcao === 'cima' ? i - 1 : i + 1
    if (j < 0 || j >= ordenadas.length) return
    const outro = ordenadas[j]
    await supabase.from('site_sections').update({ sort_order: outro.sort_order }).eq('id', secao.id)
    await supabase.from('site_sections').update({ sort_order: secao.sort_order }).eq('id', outro.id)
    carregar()
  }

  const secoesOrdenadas = useMemo(() => [...secoes].sort((a, b) => a.sort_order - b.sort_order), [secoes])

  if (carregando) return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando editor...</div></main>
  if (erro || !empresa) return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4"><div className="rounded-[2rem] bg-white p-8 text-center shadow-xl"><p className="text-3xl font-black">Erro</p><p className="mt-3 font-bold text-red-600">{erro}</p></div></main>

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-5 text-slate-950">
      <section className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><Link href="/painel" className="text-sm font-black text-[#05245c]">← Voltar ao painel</Link><h1 className="mt-2 text-4xl font-black text-[#071b3a]">Editor do site</h1><p className="mt-2 font-bold text-slate-500">Monte o site sem abrir código.</p></div>
          <a href={dominioPreview(empresa)} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#05245c] px-5 py-4 text-center font-black text-white">Ver site publicado</a>
        </div>

        {mensagem && <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 font-bold text-[#05245c]">{mensagem}</div>}

        <div className="grid gap-5 lg:grid-cols-[330px_1fr_420px]">
          <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Estrutura</p>
            <button onClick={adicionarSecao} className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white">Adicionar seção</button>
            <div className="mt-5 grid gap-3">{secoesOrdenadas.map((secao) => <button key={secao.id} onClick={() => setSelecionada(secao)} className={`rounded-2xl border p-4 text-left ${selecionada?.id === secao.id ? 'border-[#05245c] bg-blue-50' : 'border-slate-200 bg-white'}`}><p className="font-black text-[#071b3a]">{secao.title || 'Sem título'}</p><p className="mt-1 text-xs font-bold text-slate-500">{TIPOS.find((t) => t.id === secao.type)?.nome || secao.type}</p><p className={`mt-2 text-xs font-black ${secao.active ? 'text-emerald-600' : 'text-red-600'}`}>{secao.active ? 'Visível' : 'Oculta'}</p></button>)}</div>
          </aside>

          <section className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Personalização global</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2"><span className="text-sm font-black">Cor principal</span><input value={empresa.site_primary_color || '#05245c'} onChange={(e) => salvarEmpresa('site_primary_color', e.target.value)} type="color" className="h-14 w-full rounded-2xl border border-slate-200 bg-white p-2" /></label>
              <label className="grid gap-2"><span className="text-sm font-black">Cor de destaque</span><input value={empresa.site_accent_color || '#22c55e'} onChange={(e) => salvarEmpresa('site_accent_color', e.target.value)} type="color" className="h-14 w-full rounded-2xl border border-slate-200 bg-white p-2" /></label>
              <label className="grid gap-2"><span className="text-sm font-black">Status</span><select value={empresa.site_status || 'publicado'} onChange={(e) => salvarEmpresa('site_status', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold"><option value="publicado">Publicado</option><option value="rascunho">Rascunho</option></select></label>
              <label className="grid gap-2"><span className="text-sm font-black">Template</span><select value={empresa.site_template || 'auto'} onChange={(e) => salvarEmpresa('site_template', e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold"><option value="auto">Automático</option><option value="premium">Premium</option><option value="minimal">Minimalista</option><option value="catalog">Catálogo forte</option></select></label>
            </div>

            {selecionada && <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-3xl font-black text-[#071b3a]">Editar seção</h2><div className="flex gap-2"><button onClick={() => mover(selecionada, 'cima')} className="rounded-2xl bg-slate-100 px-4 py-3 font-black">Subir</button><button onClick={() => mover(selecionada, 'baixo')} className="rounded-2xl bg-slate-100 px-4 py-3 font-black">Descer</button></div></div>
              <div className="mt-5 grid gap-4">
                <select value={selecionada.type} onChange={(e) => setSelecionada({ ...selecionada, type: e.target.value })} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold">{TIPOS.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}</select>
                <input value={selecionada.title || ''} onChange={(e) => setSelecionada({ ...selecionada, title: e.target.value })} placeholder="Título" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold" />
                <input value={selecionada.subtitle || ''} onChange={(e) => setSelecionada({ ...selecionada, subtitle: e.target.value })} placeholder="Subtítulo" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold" />
                <textarea value={selecionada.content || ''} onChange={(e) => setSelecionada({ ...selecionada, content: e.target.value })} placeholder="Texto" rows={5} className="resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold" />
                <input value={selecionada.image_url || ''} onChange={(e) => setSelecionada({ ...selecionada, image_url: e.target.value })} placeholder="URL da imagem" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold" />
                <div className="grid gap-4 md:grid-cols-2"><input value={selecionada.button_label || ''} onChange={(e) => setSelecionada({ ...selecionada, button_label: e.target.value })} placeholder="Texto do botão" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold" /><input value={selecionada.button_url || ''} onChange={(e) => setSelecionada({ ...selecionada, button_url: e.target.value })} placeholder="Link do botão" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-bold" /></div>
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 font-black"><input type="checkbox" checked={selecionada.active} onChange={(e) => setSelecionada({ ...selecionada, active: e.target.checked })} /> Exibir seção</label>
                <div className="grid gap-3 sm:grid-cols-2"><button onClick={() => salvarSecao(selecionada)} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Salvar seção</button><button onClick={() => excluirSecao(selecionada.id)} className="rounded-2xl bg-red-600 px-5 py-4 font-black text-white">Remover seção</button></div>
              </div>
            </div>}
          </section>

          <aside className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Prévia rápida</p>
            <div className="mt-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-[#f6f8fb]">
              <div className="p-5" style={{ background: empresa.site_primary_color || '#05245c', color: '#fff' }}><p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Site oficial</p><p className="mt-3 text-3xl font-black">{empresa.nome}</p><p className="mt-2 font-bold opacity-80">{selecionada?.title || 'Seu site profissional'}</p></div>
              <div className="grid gap-3 p-4">{secoesOrdenadas.filter((s) => s.active).slice(0, 5).map((s) => <div key={s.id} className="rounded-2xl bg-white p-4 shadow-sm"><p className="font-black">{s.title}</p><p className="mt-1 line-clamp-2 text-sm font-bold text-slate-500">{s.subtitle || s.content}</p></div>)}</div>
            </div>
            <div className="mt-5 rounded-2xl bg-blue-50 p-4"><p className="text-sm font-black text-[#05245c]">Domínio</p><p className="mt-2 break-all text-sm font-bold text-slate-600">{dominioPreview(empresa)}</p></div>
          </aside>
        </div>
      </section>
    </main>
  )
}
