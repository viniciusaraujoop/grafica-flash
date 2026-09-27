/**
 * Orçaly Next — shared navigation helpers (isolated).
 * Replaces the duplicated isActivePath/activeFor copies in
 * components/painel/PanelSidebar.tsx and PanelSegmentSidebar.tsx once adopted.
 */

/** Active when equal or a sub-path. Root-like product homes only match exactly. External hrefs never match. */
export function isActiveHref(pathname: string, href: string, exactHrefs: readonly string[] = []): boolean {
  if (/^[a-z]+:/i.test(href) || href.startsWith('//')) return false
  const clean = (value: string) => (value.length > 1 ? value.replace(/[?#].*$/, '').replace(/\/+$/, '') : value)
  const path = clean(pathname)
  const target = clean(href)
  if (exactHrefs.includes(target)) return path === target
  return path === target || path.startsWith(`${target}/`)
}

/** Picks the single most specific active href, so a parent and a child are never both highlighted. */
export function mostSpecificActive(pathname: string, hrefs: readonly string[], exactHrefs: readonly string[] = []): string | null {
  let best: string | null = null
  for (const href of hrefs) {
    if (isActiveHref(pathname, href, exactHrefs) && (best === null || href.length > best.length)) best = href
  }
  return best
}
