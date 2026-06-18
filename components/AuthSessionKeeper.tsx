'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const SESSION_TIMEOUT_MS = 10 * 60 * 1000
const LAST_ACTIVITY_KEY = 'orcaly:last_activity_at'

function now() {
  return Date.now()
}

function getLastActivity() {
  if (typeof window === 'undefined') return 0
  const value = window.localStorage.getItem(LAST_ACTIVITY_KEY)
  return value ? Number(value) : 0
}

function setLastActivity() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now()))
}

function clearLastActivity() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LAST_ACTIVITY_KEY)
}

function isExpired() {
  const lastActivity = getLastActivity()
  if (!lastActivity) return false
  return now() - lastActivity > SESSION_TIMEOUT_MS
}

function isLoginPath(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/login/')
}

function isProtectedPath(pathname: string) {
  return pathname === '/painel' ||
    pathname.startsWith('/painel/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
}

export default function AuthSessionKeeper() {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const lastTouchRef = useRef(0)
  const validatingRef = useRef(false)

  useEffect(() => {
    let active = true

    async function validateSession() {
      if (validatingRef.current) return
      validatingRef.current = true

      try {
        const { data } = await supabase.auth.getSession()
        const session = data.session

        if (!active) return

        if (!session) {
          clearLastActivity()

          if (isProtectedPath(pathname)) {
            router.replace('/login')
          }

          return
        }

        const lastActivity = getLastActivity()

        if (!lastActivity) {
          setLastActivity()
        }

        if (isExpired()) {
          clearLastActivity()
          await supabase.auth.signOut()

          if (isProtectedPath(pathname) || isLoginPath(pathname)) {
            router.replace('/login?expired=1')
          }

          return
        }

        if (isLoginPath(pathname)) {
          router.replace('/painel')
        }
      } finally {
        validatingRef.current = false
      }
    }

    function touchActivity() {
      const current = now()

      if (current - lastTouchRef.current < 5000) {
        return
      }

      lastTouchRef.current = current
      setLastActivity()
    }

    const events: Array<keyof WindowEventMap> = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
    ]

    events.forEach((event) => {
      window.addEventListener(event, touchActivity, { passive: true })
    })

    const interval = window.setInterval(validateSession, 20000)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        validateSession()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    validateSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setLastActivity()
        if (isLoginPath(pathname)) {
          router.replace('/painel')
        }
      }

      if (event === 'SIGNED_OUT') {
        clearLastActivity()
        if (isProtectedPath(pathname)) {
          router.replace('/login')
        }
      }
    })

    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      events.forEach((event) => {
        window.removeEventListener(event, touchActivity)
      })
      listener.subscription.unsubscribe()
    }
  }, [pathname, router])

  return null
}
