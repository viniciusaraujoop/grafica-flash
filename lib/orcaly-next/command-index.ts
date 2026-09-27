/**
 * Orçaly Next — Command Palette index and deterministic ranking (isolated).
 *
 * No AI, no network. Commands are derived from the registry + per-product Hub status,
 * so a product the account cannot open never exposes its internal routes.
 */

import type { HubStatus } from './product-status'
import { APP_DESTINATION_STATUSES, hubStatusCopy } from './product-status'
import type { ProductRegistryEntry, RegistryProductId } from './product-registry'
import { navItems, operationalProducts, resolveProductDestination } from './product-registry'

export const COMMAND_GROUPS = ['Produtos', 'Navegação', 'Ações'] as const
export type CommandGroup = (typeof COMMAND_GROUPS)[number]

export type Command = {
  id: string
  title: string
  subtitle: string
  group: CommandGroup
  href: string
  keywords: readonly string[]
  productId: RegistryProductId | null
}

/** Global actions that exist today in the runtime. Kept short on purpose. */
const GLOBAL_ACTIONS: readonly Command[] = [
  { id: 'action.hub', title: 'Abrir App Hub', subtitle: 'Todos os seus produtos', group: 'Ações', href: '/apps', keywords: ['início', 'home', 'produtos'], productId: null },
  { id: 'action.privacy', title: 'Privacidade e consentimentos', subtitle: 'Conexões entre produtos', group: 'Ações', href: '/apps/privacidade', keywords: ['consentimento', 'dados', 'revogar', 'lgpd'], productId: null },
]

export function buildCommandIndex(
  registry: readonly ProductRegistryEntry[],
  statuses: Partial<Record<RegistryProductId, HubStatus>>,
): Command[] {
  const commands: Command[] = []
  for (const product of operationalProducts(registry)) {
    const status = statuses[product.id] ?? 'COMING_SOON'
    const destination = resolveProductDestination(product, status)
    const canOpen = destination.kind === 'app'
    commands.push({
      id: `product.${product.id}`,
      title: canOpen ? `Abrir ${product.shortName}` : `Conhecer ${product.shortName}`,
      subtitle: `${product.name} · ${hubStatusCopy[status].label}`,
      group: 'Produtos',
      href: destination.href,
      keywords: [product.shortName, product.name, product.description],
      productId: product.id,
    })
    if (canOpen && APP_DESTINATION_STATUSES.includes(status)) {
      for (const item of navItems(product)) {
        commands.push({
          id: `nav.${item.id}`, title: item.label, subtitle: product.shortName, group: 'Navegação',
          href: item.href, keywords: [...(item.keywords ?? []), product.shortName], productId: product.id,
        })
      }
    }
  }
  return [...commands, ...GLOBAL_ACTIONS]
}

/** Lowercase, strip diacritics, collapse whitespace. Deterministic across runtimes (no locale compare). */
export function normalizeQuery(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function isSubsequence(needle: string, haystack: string): boolean {
  let index = 0
  for (const char of haystack) if (char === needle[index]) index += 1
  return index === needle.length
}

/**
 * Score tiers (higher wins), per query token, summed:
 *  title exact 120 · title prefix 100 · title word prefix 80 · title substring 60
 *  keyword/subtitle word prefix 40 · keyword/subtitle substring 25 · title subsequence 10
 * A token that matches nothing makes the whole command score 0 (AND semantics).
 */
export function scoreCommand(command: Command, query: string): number {
  const tokens = normalizeQuery(query).split(' ').filter(Boolean)
  if (!tokens.length) return 1
  const title = normalizeQuery(command.title)
  const titleWords = title.split(' ')
  const extra = normalizeQuery([command.subtitle, ...command.keywords].join(' '))
  const extraWords = extra.split(' ')
  let total = 0
  for (const token of tokens) {
    let best = 0
    if (title === token) best = 120
    else if (title.startsWith(token)) best = 100
    else if (titleWords.some((word) => word.startsWith(token))) best = 80
    else if (title.includes(token)) best = 60
    else if (extraWords.some((word) => word.startsWith(token))) best = 40
    else if (extra.includes(token)) best = 25
    else if (token.length >= 3 && isSubsequence(token, title)) best = 10
    if (best === 0) return 0
    total += best
  }
  return total
}

const GROUP_ORDER: Record<CommandGroup, number> = { Produtos: 0, 'Navegação': 1, 'Ações': 2 }

/** Stable order: score desc → group → normalized title → id. Same input, same output, always. */
export function rankCommands(commands: readonly Command[], query: string, limit = 12): Command[] {
  return commands
    .map((command) => ({ command, score: scoreCommand(command, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const group = GROUP_ORDER[a.command.group] - GROUP_ORDER[b.command.group]
      if (group) return group
      const titleA = normalizeQuery(a.command.title)
      const titleB = normalizeQuery(b.command.title)
      if (titleA !== titleB) return titleA < titleB ? -1 : 1
      return a.command.id < b.command.id ? -1 : a.command.id > b.command.id ? 1 : 0
    })
    .slice(0, limit)
    .map((entry) => entry.command)
}
