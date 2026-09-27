'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { COMMAND_GROUPS, rankCommands, type Command } from '@/lib/orcaly-next/command-index'
import styles from './palette.module.css'

/**
 * Command Palette — isolated prototype.
 * Native <dialog> + showModal(): focus trap, inert background and Esc come from the platform.
 * WAI-ARIA combobox (input) + listbox (results), aria-activedescendant for the highlighted row.
 * Ctrl/⌘+K toggles. Ranking is deterministic (lib/orcaly-next/command-index.ts). No AI, no network.
 */
export default function CommandPalette({ commands, onNavigate, shortcut = true, triggerLabel = 'Buscar produtos e ações' }: {
  commands: readonly Command[]
  /** Integration passes router.push. Default performs a full navigation. */
  onNavigate?: (href: string) => void
  shortcut?: boolean
  triggerLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const baseId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const grouped = useMemo(() => {
    const ranked = rankCommands(commands, query, 12)
    return COMMAND_GROUPS
      .map((group) => ({ group, items: ranked.filter((command) => command.group === group) }))
      .filter((entry) => entry.items.length)
  }, [commands, query])
  const ordered = useMemo(() => grouped.flatMap((entry) => entry.items), [grouped])
  const indexed = useMemo(() => {
    let index = -1
    return grouped.map((entry) => ({ group: entry.group, items: entry.items.map((command) => { index += 1; return { command, index } }) }))
  }, [grouped])
  const listId = `${baseId}-list`
  const optionId = (index: number) => `${baseId}-opt-${index}`
  const activeIndex = ordered.length ? Math.min(active, ordered.length - 1) : -1

  const openPalette = useCallback(() => {
    setQuery('')
    setActive(0)
    setOpen(true)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) { dialog.showModal(); inputRef.current?.focus() }
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!shortcut) return
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (dialogRef.current?.open) dialogRef.current.close()
        else openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut, openPalette])

  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, baseId])

  function go(command: Command) {
    dialogRef.current?.close()
    if (onNavigate) onNavigate(command.href)
    else window.location.assign(command.href)
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!ordered.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((activeIndex + 1) % ordered.length) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((activeIndex - 1 + ordered.length) % ordered.length) }
    else if (event.key === 'Home' && event.ctrlKey) { event.preventDefault(); setActive(0) }
    else if (event.key === 'End' && event.ctrlKey) { event.preventDefault(); setActive(ordered.length - 1) }
    else if (event.key === 'Enter') { event.preventDefault(); const command = ordered[activeIndex]; if (command) go(command) }
  }

  return (
    <>
      <button ref={triggerRef} type="button" className={styles.trigger} onClick={openPalette} aria-haspopup="dialog">
        <span aria-hidden="true">⌕</span>
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <kbd className={styles.kbd} aria-hidden="true">Ctrl K</kbd>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-label="Paleta de comandos"
        onClose={() => { setOpen(false); triggerRef.current?.focus() }}
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close() }}
      >
        <div className={styles.searchRow}>
          <label htmlFor={`${baseId}-input`} style={srOnly}>Buscar</label>
          <input
            ref={inputRef}
            id={`${baseId}-input`}
            className={styles.input}
            type="text"
            role="combobox"
            aria-expanded={ordered.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            placeholder="Buscar produtos, telas e ações…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActive(0) }}
            onKeyDown={onInputKeyDown}
          />
          <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>Esc</button>
        </div>
        <div className={styles.list}>
          {ordered.length ? (
            <div id={listId} role="listbox" aria-label="Resultados">
              {indexed.map((entry) => (
                <div key={entry.group} role="group" aria-labelledby={`${baseId}-g-${entry.group}`} className={styles.group}>
                  <div id={`${baseId}-g-${entry.group}`} className={styles.groupLabel} role="presentation">{entry.group}</div>
                  {entry.items.map(({ command, index }) => {
                    return (
                      <div
                        key={command.id}
                        id={optionId(index)}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={styles.option}
                        data-command={command.id}
                        onMouseMove={() => { if (index !== activeIndex) setActive(index) }}
                        onClick={() => go(command)}
                      >
                        <span className={styles.optionTitle}>{command.title}</span>
                        <span className={styles.optionSub}>{command.subtitle}</span>
                        <span className={styles.optionHint} aria-hidden="true">↵</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div id={listId} role="listbox" aria-label="Resultados">
              <p className={styles.empty}>Nenhum resultado para “{query}”. Tente o nome de um produto ou de uma tela.</p>
            </div>
          )}
        </div>
        <p className={styles.footer} role="status" aria-live="polite">
          <span>{ordered.length} {ordered.length === 1 ? 'resultado' : 'resultados'}</span>
          <span aria-hidden="true">↑↓ navegar · ↵ abrir · Esc fechar</span>
        </p>
      </dialog>
    </>
  )
}

const srOnly = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } as const
