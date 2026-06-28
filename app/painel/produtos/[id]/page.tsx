'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getAccessTokenClient } from '@/lib/current-company-client'

function parseLines(value: unknown) {
  if (Array.isArray(value)) return value.join('\n')
  return ''
}

function linesToArray(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

export default function ProdutoDetalhePage() {
  const params = useParams()
  const id = String(params?.id || '')
  const [token, setToken] = useState('')
  const [product, setProduct] = useState<any>(null)
  const [imageLines, setImageLines] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const accessToken = await getAccessTokenClient()
      setToken(accessToken)

      const response = await fetch(`/api/products/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao carregar produto.')

      setProduct(payload.product)
      setImageLines(parseLines(payload.product?.image_urls))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produto.')
    }

    setLoading(false)
  }

  useEffect(() => {
    if (id) load()
  }, [id])

  function update(field: string, value: any) {
    setProduct((current: any) => ({ ...(current || {}), [field]: value }))
  }

  async function save() {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...product,
          image_urls: linesToArray(imageLines),
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao salvar produto.')

      setProduct(payload.product)
      setMessage('Produto atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto.')
    }

    setSaving(false)
  }

  async function generateAi(event: FormEvent) {
    event.preventDefault()
    setError('')
    setAiAnswer('')

    try {
      const response = await fetch('/api/ai/product-helper', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: product.nome,
          categoria: product.categoria,
          tipo: product.tipo,
          objetivo: 'descricao',
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(payload.error || 'Erro ao gerar IA.')

      setAiAnswer(payload.answer || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar IA.')
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Carregando produto...</div></main>
  }

  if (!product) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="rounded-[2rem] bg-white p-8 font-black shadow-xl">Produto não encontrado.</div></main>
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-[#071b3a]">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <Link href="/painel/produtos" className="text-sm font-black text-[#05245c]">← Voltar ao catálogo</Link>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#05245c]">Produto avançado</p>
              <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-5xl">{product.nome || 'Produto'}</h1>
              <p className="mt-3 max-w-3xl font-bold leading-7 text-slate-500">
                Configure preço, categoria, variações, imagens, destaque, promoção e textos comerciais.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-[#05245c] p-5 text-white">
              <p className="text-sm font-black text-white/60">Preço</p>
              <p className="mt-2 text-4xl font-black">
                {product.preco_sob_consulta ? 'Sob consulta' : Number(product.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="mt-2 text-sm font-bold text-white/70">{product.categoria || 'Sem categoria'}</p>
            </div>
          </div>
        </header>

        {message ? <div className="rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h2 className="text-2xl font-black tracking-[-0.04em]">Dados principais</h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black">Nome</span>
                <input value={product.nome || ''} onChange={(event) => update('nome', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">Tipo</span>
                <select value={product.tipo || 'produto'} onChange={(event) => update('tipo', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none">
                  <option value="produto">Produto</option>
                  <option value="servico">Serviço</option>
                  <option value="pacote">Pacote</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">Categoria</span>
                <input value={product.categoria || ''} onChange={(event) => update('categoria', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">Subcategoria</span>
                <input value={product.subcategoria || ''} onChange={(event) => update('subcategoria', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">Preço</span>
                <input type="number" value={product.preco || 0} onChange={(event) => update('preco', Number(event.target.value || 0))} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">Unidade de preço</span>
                <select value={product.unidade_preco || 'unidade'} onChange={(event) => update('unidade_preco', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none">
                  <option value="unidade">Unidade</option>
                  <option value="m2">Metro quadrado</option>
                  <option value="metro">Metro linear</option>
                  <option value="hora">Hora</option>
                  <option value="pacote">Pacote</option>
                  <option value="sob_consulta">Sob consulta</option>
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">Estoque</span>
                <input type="number" value={product.estoque ?? ''} onChange={(event) => update('estoque', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">SKU / código interno</span>
                <input value={product.sku || ''} onChange={(event) => update('sku', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['ativo', 'Ativo'],
                ['preco_sob_consulta', 'Preço sob consulta'],
                ['promocao_ativa', 'Promoção ativa'],
                ['destaque', 'Destacar no site'],
                ['oculto', 'Ocultar do site'],
                ['arquivado', 'Arquivado'],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 font-black">
                  <input type="checkbox" checked={Boolean(product[field])} onChange={(event) => update(field, event.target.checked)} />
                  {label}
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black">Preço promocional</span>
                <input type="number" value={product.preco_promocional || 0} onChange={(event) => update('preco_promocional', Number(event.target.value || 0))} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">URL do vídeo</span>
                <input value={product.video_url || ''} onChange={(event) => update('video_url', event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
              </label>
            </div>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black">Descrição curta</span>
              <textarea value={product.descricao_curta || product.descricao || ''} onChange={(event) => update('descricao_curta', event.target.value)} rows={3} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
            </label>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black">Descrição detalhada</span>
              <textarea value={product.descricao_detalhada || ''} onChange={(event) => update('descricao_detalhada', event.target.value)} rows={6} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
            </label>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black">Imagens, uma URL por linha</span>
              <textarea value={imageLines} onChange={(event) => setImageLines(event.target.value)} rows={5} className="resize-none rounded-2xl border border-slate-200 px-4 py-4 font-bold outline-none" />
            </label>

            <button onClick={save} disabled={saving} className="mt-5 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar produto'}
            </button>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-2xl font-black tracking-[-0.04em]">IA do produto</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">Gere descrição, benefícios e perguntas de orçamento para este item.</p>

              <form onSubmit={generateAi} className="mt-5">
                <button className="rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white">Gerar com IA</button>
              </form>

              {aiAnswer ? (
                <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-[#f5f8ff] p-4 font-sans text-sm font-bold leading-7">{aiAnswer}</pre>
              ) : null}
            </section>

            <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <h2 className="text-2xl font-black tracking-[-0.04em]">Prévia rápida</h2>
              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-[#f5f8ff]">
                {linesToArray(imageLines)[0] ? (
                  <img src={linesToArray(imageLines)[0]} alt={product.nome || 'Produto'} className="h-48 w-full object-cover" />
                ) : (
                  <div className="grid h-48 place-items-center text-sm font-black text-slate-400">Sem imagem</div>
                )}
                <div className="p-4">
                  <p className="font-black">{product.nome}</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-500">{product.descricao_curta || product.descricao || 'Sem descrição curta.'}</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
