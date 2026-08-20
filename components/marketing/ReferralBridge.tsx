'use client'

import { useEffect } from 'react'

const REF_STORAGE_KEY = 'orcaly_affiliate_referral_v1'
const SESSION_STORAGE_KEY = 'orcaly_affiliate_click_session_v1'

export default function ReferralBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = String(params.get('ref') || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32)

    if (!code) return

    try {
      window.localStorage.setItem(
        REF_STORAGE_KEY,
        JSON.stringify({
          code,
          expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
        }),
      )

      let sessionId = window.localStorage.getItem(SESSION_STORAGE_KEY)
      if (!sessionId) {
        sessionId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2)
        window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId)
      }

      void fetch('/api/parceiros/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          code,
          sessionId,
          landingPath: window.location.pathname + window.location.search,
          referrer: document.referrer,
        }),
      })
    } catch {
      // O cadastro ainda aceita ?ref= diretamente quando storage não estiver disponível.
    }
  }, [])

  return null
}
