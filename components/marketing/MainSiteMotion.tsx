'use client'

import { useEffect } from 'react'

export default function MainSiteMotion() {
  useEffect(() => {
    const root = document.documentElement
    const header = document.querySelector<HTMLElement>('main > header')
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.marketing-section'))

    root.dataset.siteMotion = 'ready'

    const updateHeader = () => {
      if (!header) return
      header.dataset.scrolled = window.scrollY > 18 ? 'true' : 'false'
    }

    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })

    if (!('IntersectionObserver' in window)) {
      sections.forEach((section) => { section.dataset.revealed = 'true' })
      return () => {
        window.removeEventListener('scroll', updateHeader)
        delete root.dataset.siteMotion
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const section = entry.target as HTMLElement
          section.dataset.revealed = 'true'
          observer.unobserve(section)
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 },
    )

    sections.forEach((section) => observer.observe(section))

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateHeader)
      delete root.dataset.siteMotion
    }
  }, [])

  return null
}
