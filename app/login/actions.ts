'use server'

import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import { getCompanyAccess, getSupabaseAdmin } from '@/lib/company-access'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export type LoginActionResult = {
  ok: false
  error: string
}

export type LoginFormState = LoginActionResult

function safeNextPath(rawNext?: string | null) {
  const next = String(rawNext || '').trim()

  if (!next) return '/painel/inicio'
  if (!next.startsWith('/')) return '/painel/inicio'
  if (next.startsWith('//')) return '/painel/inicio'
  if (next.includes('://')) return '/painel/inicio'
  if (next.startsWith('/login')) return '/painel/inicio'
  if (next.startsWith('/cadastro')) return '/painel/inicio'

  return next
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.'
  }

  if (
    normalized.includes('too many requests') ||
    normalized.includes('rate limit')
  ) {
    return 'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.'
  }

  return 'Não foi possível entrar agora. Tente novamente em alguns instantes.'
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

    destination = access.company?.id ? nextPath : '/cadastro'

    console.info(JSON.stringify({
      event: 'auth_login_success',
      route: '/login',
      has_company: Boolean(access.company?.id),
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

  // A autenticação acabou de alterar os cookies que definem a identidade
  // server-side. Limpar o Router Cache evita reutilizar uma árvore de /painel
  // obtida quando a mesma aba ainda estava anônima.
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
