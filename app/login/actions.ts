'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect, RedirectType } from 'next/navigation'
import { getCompanyAccess, getSupabaseAdmin } from '@/lib/company-access'
import { getMfaSecurityState } from '@/lib/security/mfa'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { safeNextPath } from '@/lib/auth-navigation'
import { consumeRateLimit } from '@/lib/security/rate-limit'

export type LoginActionResult = {
  ok: false
  error: string
}

export type LoginFormState = {
  ok: boolean
  error: string
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (
    normalized.includes('too many requests') ||
    normalized.includes('rate limit')
  ) {
    return 'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.'
  }

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('email not confirmed')
  ) {
    return 'Não foi possível entrar com essas credenciais.'
  }

  return 'Não foi possível entrar agora. Tente novamente em alguns instantes.'
}

function clientNetworkSignal(requestHeaders: Headers) {
  return (
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip') ||
    requestHeaders.get('cf-connecting-ip') ||
    'unknown'
  )
}

export async function signInWithPasswordAction(input: {
  email: string
  password: string
  next?: string | null
}): Promise<LoginActionResult> {
  const email = String(input.email || '').trim().toLowerCase()
  const password = String(input.password || '')
  const nextPath = safeNextPath(input.next)

  if (!email || !password) {
    return {
      ok: false,
      error: 'Informe o e-mail e a senha da conta.',
    }
  }

  let destination = nextPath

  try {
    const requestHeaders = await headers()
    const network = clientNetworkSignal(requestHeaders)
    const [networkLimit, accountLimit] = await Promise.all([
      consumeRateLimit({
        scope: 'auth-login-network',
        limit: 30,
        windowSeconds: 600,
        identity: network,
        failOpen: true,
      }),
      consumeRateLimit({
        scope: 'auth-login-identifier',
        limit: 8,
        windowSeconds: 600,
        identity: `${network}:${email}`,
        failOpen: true,
      }),
    ])

    if (!networkLimit.allowed || !accountLimit.allowed) {
      return {
        ok: false,
        error: 'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.',
      }
    }
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user?.id) {
      console.warn(JSON.stringify({
        event: 'auth_login_failure',
        route: '/login',
        code: error?.code || 'missing_user',
      }))

      return {
        ok: false,
        error: friendlyAuthError(error?.message || 'missing_user'),
      }
    }

    const supabaseAdmin = getSupabaseAdmin()
    const access = await getCompanyAccess(
      supabaseAdmin,
      data.user.id,
      data.user.email,
    )

    const personalDestination = nextPath === '/apps' || nextPath.startsWith('/apps/')
    const postLoginDestination = access.company?.id || personalDestination ? nextPath : '/cadastro'
    const mfa = await getMfaSecurityState(supabase)

    destination = mfa.hasVerifiedFactor && mfa.currentLevel !== 'aal2'
      ? `/mfa?next=${encodeURIComponent(postLoginDestination)}`
      : postLoginDestination

    console.info(JSON.stringify({
      event: 'auth_login_success',
      route: '/login',
      has_company: Boolean(access.company?.id),
      mfa_required: mfa.hasVerifiedFactor && mfa.currentLevel !== 'aal2',
    }))
  } catch (error) {
    console.error(JSON.stringify({
      event: 'auth_login_failure',
      route: '/login',
      code: 'server_error',
      error_name: error instanceof Error ? error.name : 'UnknownError',
    }))

    return {
      ok: false,
      error: 'Não foi possível entrar agora. Tente novamente em alguns instantes.',
    }
  }

  revalidatePath('/', 'layout')

  console.info(JSON.stringify({
    event: 'auth_redirect_started',
    route: '/login',
    destination,
  }))

  redirect(destination, RedirectType.replace)
}

export async function signInWithPasswordFormAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  return signInWithPasswordAction({
    email: String(formData.get('email') || ''),
    password: String(formData.get('password') || ''),
    next: String(formData.get('next') || ''),
  })
}
