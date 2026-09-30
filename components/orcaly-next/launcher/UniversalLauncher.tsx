'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { HubTile } from '@/lib/orcaly-next/hub-model'
import type { ProductRegistryEntry } from '@/lib/orcaly-next/product-registry'
import { hubStatusCopy } from '@/lib/orcaly-next/product-status'
import { skinContracts } from '@/lib/orcaly-next/skins'
import { FoundationRoot } from '../foundation/primitives'
import styles from './launcher.module.css'

/**
 * Universal Launcher — isolated prototype.
 * Disclosure button + non-modal dialog with a 3-column (≥768px) / 2-column grid.
 * Keyboard: Enter/Space opens, arrows move across the grid (column count read from CSS),
 * Home/End jump, Esc closes and returns focus to the trigger, Tab leaves normally.
 * Outside pointer closes. Subscribed → app, unsubscribed → landing (resolveProductDestination).
 */
export default function UniversalLauncher({ tiles, one, hubHref = '/apps', label = 'Produtos Orçaly' }: {
  tiles: readonly HubTile[]
  one?: ProductRegistryEntry | null
  hubHref?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const headingId = `${baseId}-heading`
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const tileRefs = useRef<Array<HTMLAnchorElement | null>>([])

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    tileRefs.current[0]?.focus()
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) close(false)
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  function onGridKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const links = tileRefs.current.filter((link): link is HTMLAnchorElement => Boolean(link))
    const index = links.findIndex((link) => link === document.activeElement)
    if (index < 0 || !gridRef.current) return
    const columns = Math.max(1, getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').filter(Boolean).length)
    const moves: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }
    let next = index
    if (event.key in moves) next = index + moves[event.key]
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = links.length - 1
    else return
    event.preventDefault()
    links[Math.min(links.length - 1, Math.max(0, next))]?.focus()
  }

  return (
    <FoundationRoot className={styles.foundationRoot}>
      <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span className={styles.triggerDots} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} />)}</span>
        <span style={srOnly}>{label}</span>
      </button>
      {open ? (
        <div id={panelId} className={styles.panel} role="dialog" aria-modal="false" aria-labelledby={headingId}>
          <div className={styles.header}>
            <h2 id={headingId}>{label}</h2>
            <Link href={hubHref} onClick={() => close(false)}>App Hub</Link>
          </div>
          <ul className={styles.grid} ref={gridRef} onKeyDown={onGridKeyDown} aria-label="Produtos">
            {tiles.map((tile, index) => {
              const copy = hubStatusCopy[tile.status]
              const accent = skinContracts[tile.product.skin].accent
              return (
                <li key={tile.product.id}>
                  <Link
                    ref={(node) => { tileRefs.current[index] = node }}
                    href={tile.destination.href}
                    className={styles.tile}
                    style={{ '--tile-accent': accent } as CSSProperties}
                    data-status={tile.status}
                    data-destination={tile.destination.kind}
                    onClick={() => close(false)}
                  >
                    <span className={styles.mark} aria-hidden="true">{tile.product.shortName.slice(0, 1)}</span>
                    <span className={styles.name}>{tile.product.shortName}</span>
                    <span className={styles.status}>{copy.label}</span>
                    <span style={srOnly}>{tile.destination.kind === 'app' ? '— abre o aplicativo' : '— abre a página do produto'}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {one ? (
            <Link className={styles.oneLink} href={one.landing.path} onClick={() => close(false)}>
              <span><strong>{one.shortName}</strong><small>Proposta de acesso integrado</small></span>
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <p className={styles.footnote}>Assinaturas são verificadas em cada produto. Nenhum dado é compartilhado entre eles sem o seu consentimento.</p>
        </div>
      ) : null}
      </div>
    </FoundationRoot>
  )
}

const srOnly: CSSProperties = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
