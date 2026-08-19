'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAccessTokenClient } from '@/lib/current-company-client'

type SearchResult = {
  id: string
  type: 'module' | 'customer' | 'lead' | 'order' | 'proposal' | 'product'
  title: string
  subtitle: string
  href: string
}

const typeLabels: Record<SearchResult['type'], string> = {
  module: 'Módulo',
  customer: 'Cliente',
  lead: 'Lead',
  order: 'Pedido',
  proposal: 'Proposta',
  product: 'Produto',
}

export default function PanelGlobalSearch() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const token = await getAccessTokenClient()
        const response = await fetch(`/api/panel/search?q=${encodeURIComponent(trimmed)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
          cache: 'no-store',
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Erro na busca.')
        setResults(payload.results || [])
        setActiveIndex(0)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResults([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 180)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const grouped = useMemo(() => {
    const groups = new Map<string, SearchResult[]>()
    for (const item of results) {
      const label = typeLabels[item.type]
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label)!.push(item)
    }
    return [...groups.entries()]
  }, [results])

  function openResult(result: SearchResult) {
    setOpen(false)
    setQuery('')
    router.push(result.href)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      openResult(results[activeIndex])
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold text-white/90 transition duration-200 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-label="Abrir busca global"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <span className="hidden xl:inline">Buscar</span>
        <kbd className="hidden rounded-md border border-white/15 bg-black/10 px-1.5 py-0.5 text-[10px] font-bold text-white/60 sm:inline">Ctrl K</kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-start justify-center bg-[#03132d]/55 px-3 pt-[10vh] backdrop-blur-sm motion-safe:animate-[orcaly-search-backdrop_160ms_ease-out_both]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(3,19,45,0.3)] motion-safe:animate-[orcaly-search-enter_180ms_ease-out_both]"
            role="dialog"
            aria-modal="true"
            aria-label="Busca global do Orçaly"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-[#174e93]" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar cliente, pedido, proposta, produto ou módulo..."
                aria-label="Pesquisar no Orçaly"
                className="min-w-0 flex-1 bg-transparent py-2 text-base font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 sm:text-lg"
              />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50">Esc</button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2 sm:p-3">
              {query.trim().length < 2 ? (
                <div className="px-3 py-10 text-center">
                  <strong className="text-sm text-slate-700">Encontre qualquer coisa sem caçar menu.</strong>
                  <p className="mt-1 text-sm text-slate-400">Digite pelo menos 2 caracteres.</p>
                </div>
              ) : loading ? (
                <div className="grid gap-2 p-2" aria-label="Buscando">
                  {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
                </div>
              ) : grouped.length ? (
                <div className="grid gap-3">
                  {grouped.map(([group, items]) => (
                    <div key={group}>
                      <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{group}</p>
                      <div className="grid gap-1">
                        {items.map((result) => {
                          const index = results.findIndex((item) => item.id === result.id)
                          const active = index === activeIndex
                          return (
                            <button
                              key={result.id}
                              type="button"
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => openResult(result)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-blue-50 ring-1 ring-blue-100' : 'hover:bg-slate-50'}`}
                            >
                              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${active ? 'bg-[#0b3b78] text-white' : 'bg-slate-100 text-slate-500'}`} aria-hidden="true">{typeLabels[result.type].slice(0, 1)}</span>
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-sm text-slate-800">{result.title}</strong>
                                <small className="mt-0.5 block truncate text-xs font-medium text-slate-400">{result.subtitle}</small>
                              </span>
                              <span className="text-slate-300" aria-hidden="true">→</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-10 text-center">
                  <strong className="text-sm text-slate-700">Nada encontrado.</strong>
                  <p className="mt-1 text-sm text-slate-400">Tente nome, telefone, produto ou área do sistema.</p>
                </div>
              )}
            </div>
          </section>
          <style jsx global>{`
            @keyframes orcaly-search-enter { from { opacity: 0; transform: translateY(-6px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes orcaly-search-backdrop { from { opacity: 0; } to { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { [class*='orcaly-search'] { animation: none !important; } }
          `}</style>
        </div>
      ) : null}
    </>
  )
}
