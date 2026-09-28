// Industry Pack core helpers (pure).

import { ITEM_REQUIREMENTS, PACK_ITEM_KINDS, SEMVER } from './constants'
import type { PackItem } from './types'

export function parseSemver(version: string): [number, number, number] | null {
  const match = SEMVER.exec(version)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** Negative when a < b, 0 when equal, positive when a > b. Invalid versions sort first. */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a)
  const right = parseSemver(b)
  if (!left || !right) return (left ? 1 : 0) - (right ? 1 : 0)
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

/** Text equivalence: NFC, trimmed, internal whitespace collapsed. */
export function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function normalizeKey(value: string): string {
  return normalizeText(value).toLowerCase()
}

export function containsMarkup(value: string): boolean {
  return /<\s*\/?\s*[a-z!?][^>]*>/i.test(value)
}

export function containsRemoteReference(value: string): boolean {
  return /(^|[\s("'])(?:https?:|ftp:|javascript:|data:|file:|\/\/|www\.)/i.test(value)
}

export function extractPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((match) => match[1])
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

const kindRank = new Map(PACK_ITEM_KINDS.map((kind, index) => [kind, index]))
const requirementRank = new Map(ITEM_REQUIREMENTS.map((requirement, index) => [requirement, index]))

export function compareItemIdentity(
  a: { kind: PackItem['kind']; requirement?: PackItem['requirement']; id: string },
  b: { kind: PackItem['kind']; requirement?: PackItem['requirement']; id: string },
): number {
  const byKind = (kindRank.get(a.kind) ?? 99) - (kindRank.get(b.kind) ?? 99)
  if (byKind) return byKind
  const byRequirement =
    (a.requirement ? requirementRank.get(a.requirement) ?? 99 : 0) -
    (b.requirement ? requirementRank.get(b.requirement) ?? 99 : 0)
  if (byRequirement) return byRequirement
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function collectStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 16) return out
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out, depth + 1)
  else if (value && typeof value === 'object') for (const item of Object.values(value)) collectStrings(item, out, depth + 1)
  return out
}
