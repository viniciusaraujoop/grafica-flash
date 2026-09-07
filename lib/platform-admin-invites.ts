import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/company-access'

export const PLATFORM_ADMIN_INVITE_TTL_DAYS = 7

export function normalizeTeamInviteEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export function validTeamInviteEmail(value: unknown) {
  const email = normalizeTeamInviteEmail(value)
  return (
    email.length >= 5 &&
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
}

export function validTeamInvitePassword(value: unknown) {
  const password = String(value || '')
  return (
    password.length >= 10 &&
    password.length <= 128 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  )
}

export function createPlatformAdminInviteToken() {
  return randomBytes(32).toString('base64url')
}

export function hashPlatformAdminInviteToken(value: unknown) {
  const token = String(value || '').trim()

  if (
    token.length < 32 ||
    token.length > 160 ||
    !/^[A-Za-z0-9_-]+$/.test(token)
  ) {
    return null
  }

  return createHash('sha256').update(token).digest('hex')
}

export function platformAdminInviteExpiresAt() {
  return new Date(
    Date.now() +
      PLATFORM_ADMIN_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
}

export function buildPlatformAdminActivationUrl(
  request: NextRequest,
  token: string,
) {
  const url = new URL('/equipe/ativar', request.nextUrl.origin)
  url.searchParams.set('token', token)
  return url.toString()
}

export function maskTeamInviteEmail(value: unknown) {
  const email = normalizeTeamInviteEmail(value)
  const [local, domain] = email.split('@')

  if (!local || !domain) return 'e-mail protegido'

  const visible =
    local.length <= 2
      ? local.slice(0, 1)
      : local.slice(0, 2)

  return `${visible}${'*'.repeat(
    Math.max(2, local.length - visible.length),
  )}@${domain}`
}

export async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  targetEmail: string,
) {
  const email = normalizeTeamInviteEmail(targetEmail)

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100,
      })

    if (error) throw error

    const users = data?.users || []
    const found = users.find(
      (user) =>
        normalizeTeamInviteEmail(user.email) === email,
    )

    if (found) return found
    if (users.length < 100) break
  }

  return null
}
