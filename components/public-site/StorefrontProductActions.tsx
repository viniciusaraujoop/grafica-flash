'use client'

import { useEffect, useState } from 'react'

function keyPart(value: string) {
  return value.trim() || 'storefront'
}

function getSessionId() {
  const key = 'orcaly-storefront-session-v2'
  try {
    const current = window.localStorage.getItem(key)
    if (current) return current
    const created = crypto.randomUUID()
    window.localStorage.setItem(key, created)
    return created
  } catch {
    return ''
  }
}

function readIds(key: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.map((item) => String(item || '')).filter(Boolean) : []
  } catch {
    return []
  }
}

export default function StorefrontProductActions({ slug, productId, productName, whatsapp, actionLabel }: { slug: string; productId: string; productName: string; whatsapp: string; actionLabel: string }) {
  const favoriteKey = `orcaly-storefront-favorites:${keyPart(slug)}`
  const recentKey = `orcaly-storefront-recent:${keyPart(slug)}`
  const [favorite, setFavorite] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const favorites = readIds(favoriteKey)
    setFavorite(favorites.includes(productId))
    const recent = [productId, ...readIds(recentKey).filter((id) => id !== productId)].slice(0, 12)
    try { window.localStorage.setItem(recentKey, JSON.stringify(recent)) } catch {}

    void fetch(`/api/public-site/${encodeURIComponent(slug)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'product_view', productId, sessionId: getSessionId() }),
      keepalive: true,
    }).catch(() => undefined)
  }, [favoriteKey, productId, recentKey, slug])

  function toggleFavorite() {
    const current = readIds(favoriteKey)
    const nextFavorite = !current.includes(productId)
    const next = nextFavorite ? [productId, ...current].slice(0, 30) : current.filter((id) => id !== productId)
    try { window.localStorage.setItem(favoriteKey, JSON.stringify(next)) } catch {}
    setFavorite(nextFavorite)
    if (nextFavorite) {
      void fetch(`/api/public-site/${encodeURIComponent(slug)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'favorite_add', productId, sessionId: getSessionId() }),
        keepalive: true,
      }).catch(() => undefined)
    }
  }

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: productName, url }).catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return <div className="grid gap-2 sm:grid-cols-2"><a href={`/site/${encodeURIComponent(slug)}#catalogo`} className="rounded-xl px-4 py-3 text-center text-sm font-extrabold text-white" style={{ background: 'var(--product-primary)' }}>{actionLabel}</a>{whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-extrabold text-emerald-700">Falar no WhatsApp</a> : null}<button type="button" onClick={toggleFavorite} className={`rounded-xl border px-4 py-3 text-sm font-extrabold ${favorite ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}>{favorite ? '♥ Salvo' : '♡ Favoritar'}</button><button type="button" onClick={() => void share()} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-600">{copied ? 'Link copiado' : 'Compartilhar'}</button></div>
}
