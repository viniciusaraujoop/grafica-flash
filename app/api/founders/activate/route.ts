import {
  createHash,
  randomUUID,
} from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  getDefaultSetupForBusiness,
  normalizeBusinessType,
} from '@/lib/business-types'
import {
  getSubdomainSuggestions,
  normalizeSubdomainSlug,
  validateSubdomainSlug,
} from '@/lib/slug'
import { getSupabaseAdmin } from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

function normalizeEmail(value: unknown) {
  return clean(value, 320).toLowerCase()
}

function normalizePhone(value: unknown) {
  return clean(value, 40).replace(/\D/g, '')
}

function validToken(value: unknown) {
  const token = clean(value, 128).toLowerCase()

  if (!/^[0-9a-f]{64}$/.test(token)) {
    return null
  }

  return token
}

function hashToken(token: string) {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

function maskEmail(value: string) {
  const [local, domain] = value.split('@')

  if (!local || !domain) return 'e-mail do convite'

  const visible =
    local.length <= 2
      ? local.slice(0, 1)
      : local.slice(0, 2)

  return `${visible}${'*'.repeat(
    Math.max(2, Math.min(8, local.length - visible.length)),
  )}@${domain}`
}

function passwordError(value: unknown) {
  const password = String(value ?? '')

  if (password.length < 8) {
    return 'A senha precisa ter pelo menos 8 caracteres.'
  }

  if (password.length > 128) {
    return 'A senha precisa ter no máximo 128 caracteres.'
  }

  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return 'Use pelo menos uma letra e um número na senha.'
  }

  return null
}

function databaseMessage(message: string) {
  const cases: Array<[string, string]> = [
    [
      'FOUNDER_ACTIVATION_INVALID_TOKEN',
      'Este convite Founder não é válido.',
    ],
    [
      'FOUNDER_ACTIVATION_IN_PROGRESS',
      'Este convite já está sendo ativado. Aguarde alguns instantes antes de tentar novamente.',
    ],
    [
      'FOUNDER_ACTIVATION_NOT_PENDING',
      'Este convite Founder já foi usado, revogado ou expirou.',
    ],
    [
      'FOUNDER_ACTIVATION_EXPIRED',
      'Este convite Founder expirou. Solicite um novo link.',
    ],
    [
      'FOUNDER_ACTIVATION_EMAIL_MISMATCH',
      'O e-mail informado não corresponde ao convite.',
    ],
    [
      'FOUNDER_ACTIVATION_COMPANY_ALREADY_EXISTS',
      'Este e-mail já possui uma empresa no Orçaly.',
    ],
    [
      'FOUNDER_ACTIVATION_SLUG_TAKEN',
      'Esse link público acabou de ser escolhido por outra empresa.',
    ],
    [
      'FOUNDER_ACTIVATION_INVALID_COMPANY_NAME',
      'Informe um nome de empresa válido.',
    ],
    [
      'FOUNDER_ACTIVATION_INVALID_SLUG',
      'Escolha um link público válido.',
    ],
  ]

  for (const [code, friendly] of cases) {
    if (message.includes(code)) return friendly
  }

  if (
    message.includes('companies_slug_key') ||
    message.includes('companies_subdomain_slug_unique')
  ) {
    return 'Esse link público acabou de ser escolhido por outra empresa.'
  }

  if (
    message.includes('companies_nome_security_check') ||
    message.includes('companies_slug_security_check') ||
    message.includes('companies_subdomain_slug_security_check')
  ) {
    return 'Nome ou link público não permitido. Escolha outra opção.'
  }

  return message
}

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  email: string,
) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      })

    if (error) throw error

    const users = data?.users || []
    const found = users.find(
      (user) =>
        String(user.email || '').trim().toLowerCase() === email,
    )

    if (found) return found
    if (users.length < 1000) break
  }

  return null
}

async function releaseClaim(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  claimId: string,
  reason: string,
) {
  try {
    await supabaseAdmin.rpc(
      'release_founder_activation_claim',
      {
        p_claim_id: claimId,
        p_error: reason.slice(0, 1000),
      },
    )
  } catch {
    // O claim expira automaticamente após 10 minutos.
  }
}

export async function GET(request: NextRequest) {
  try {
    const rawToken =
      request.nextUrl.searchParams.get('token')
    const token = validToken(rawToken)

    if (!token) {
      return NextResponse.json(
        { error: 'Convite Founder inválido.' },
        { status: 400 },
      )
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data, error } = await supabaseAdmin.rpc(
      'preview_founder_activation',
      {
        p_token_hash: hashToken(token),
      },
    )

    if (error) throw error

    const invite = Array.isArray(data) ? data[0] : data

    if (!invite?.invite_id) {
      return NextResponse.json(
        {
          error:
            'Este convite não está mais disponível. Ele pode ter expirado, sido revogado ou já ter sido usado.',
        },
        { status: 404 },
      )
    }

    const businessType = normalizeBusinessType(
      invite.modelo_negocio ||
        invite.segmento ||
        'services',
    )

    const companyName =
      clean(invite.empresa_nome, 80) || ''
    const suggestedSlug =
      clean(invite.slug_sugerido, 42) ||
      normalizeSubdomainSlug(companyName)

    return NextResponse.json({
      invite: {
        id: invite.invite_id,
        founder_number: invite.founder_number,
        plan_key: invite.plan_key,
        founder_price_cents: invite.founder_price_cents,
        token_expires_at: invite.token_expires_at,
        email_hint: maskEmail(invite.email),
      },
      prefill: {
        empresa_nome: companyName,
        nome_responsavel:
          clean(invite.nome_responsavel, 100),
        whatsapp:
          normalizePhone(invite.whatsapp),
        cidade: clean(invite.cidade, 100),
        estado: clean(invite.estado, 2).toUpperCase(),
        business_type: businessType,
        subdomain_slug: suggestedSlug,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? databaseMessage(error.message)
            : 'Não foi possível validar o convite Founder.',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  let claimId = ''
  let createdUserId = ''

  try {
    const body = await request
      .json()
      .catch(() => ({}))

    const token = validToken(body.token)
    const email = normalizeEmail(body.email)
    const password = String(body.password ?? '')
    const nomeResponsavel = clean(
      body.nome_responsavel,
      100,
    )
    const companyName = clean(body.empresa_nome, 80)
    const whatsapp = normalizePhone(body.whatsapp)
    const cidade = clean(body.cidade, 100)
    const estado = clean(body.estado, 2).toUpperCase()
    const onboardingGoal = clean(
      body.onboarding_goal,
      80,
    )
    const businessType = normalizeBusinessType(
      body.business_type,
    )

    const slugValidation =
      validateSubdomainSlug(body.subdomain_slug)

    if (!token) {
      return NextResponse.json(
        { error: 'Convite Founder inválido.' },
        { status: 400 },
      )
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Informe o e-mail do convite.' },
        { status: 400 },
      )
    }

    const invalidPassword = passwordError(password)

    if (invalidPassword) {
      return NextResponse.json(
        { error: invalidPassword },
        { status: 400 },
      )
    }

    if (
      companyName.length < 2 ||
      companyName.length > 80
    ) {
      return NextResponse.json(
        { error: 'Informe o nome da empresa.' },
        { status: 400 },
      )
    }

    if (whatsapp.length < 10) {
      return NextResponse.json(
        { error: 'Informe um WhatsApp válido.' },
        { status: 400 },
      )
    }

    if (!cidade) {
      return NextResponse.json(
        { error: 'Informe a cidade da empresa.' },
        { status: 400 },
      )
    }

    if (!onboardingGoal) {
      return NextResponse.json(
        {
          error:
            'Escolha o principal objetivo da empresa no Orçaly.',
        },
        { status: 400 },
      )
    }

    if (!slugValidation.ok) {
      return NextResponse.json(
        {
          error:
            slugValidation.reason ||
            'Escolha um link público válido.',
        },
        { status: 400 },
      )
    }

    const canonicalSubdomain =
      slugValidation.slug.replace(/[^a-z0-9]/g, '')

    const { data: usedSlug, error: slugError } =
      await supabaseAdmin
        .from('companies')
        .select('id')
        .or(
          `slug.eq.${slugValidation.slug},subdomain_slug.eq.${canonicalSubdomain}`,
        )
        .limit(1)

    if (slugError) throw slugError

    if (usedSlug && usedSlug.length > 0) {
      return NextResponse.json(
        {
          error: 'Esse link público já está em uso.',
          suggestions: getSubdomainSuggestions(
            companyName,
            cidade,
          ),
        },
        { status: 409 },
      )
    }

    claimId = randomUUID()

    const { data: claimedData, error: claimError } =
      await supabaseAdmin.rpc(
        'claim_founder_activation',
        {
          p_token_hash: hashToken(token),
          p_email: email,
          p_claim_id: claimId,
        },
      )

    if (claimError) throw claimError

    const claimed = Array.isArray(claimedData)
      ? claimedData[0]
      : claimedData

    if (!claimed?.invite_id) {
      throw new Error(
        'FOUNDER_ACTIVATION_CLAIM_NOT_FOUND',
      )
    }

    const existingAuthUser =
      await findAuthUserByEmail(
        supabaseAdmin,
        String(claimed.email).toLowerCase(),
      )

    if (existingAuthUser?.id) {
      await releaseClaim(
        supabaseAdmin,
        claimId,
        'AUTH_EMAIL_ALREADY_REGISTERED',
      )

      return NextResponse.json(
        {
          error:
            'Este e-mail já possui uma conta de acesso no Orçaly. Use outro convite/e-mail ou procure o suporte antes de ativar.',
        },
        { status: 409 },
      )
    }

    const { data: createdAuth, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: claimed.email,
        password,
        email_confirm: true,
        app_metadata: {
          orcaly_signup: 'founder',
          founder_number: claimed.founder_number,
          founder_plan: claimed.plan_key,
        },
        user_metadata: {
          nome: nomeResponsavel,
          empresa_nome: companyName,
          portal: 'company',
        },
      })

    if (authError || !createdAuth.user?.id) {
      await releaseClaim(
        supabaseAdmin,
        claimId,
        authError?.message ||
          'AUTH_CREATE_USER_FAILED',
      )

      return NextResponse.json(
        {
          error:
            authError?.message ||
            'Não foi possível criar sua conta.',
        },
        { status: 409 },
      )
    }

    createdUserId = createdAuth.user.id

    const defaultSetup =
      getDefaultSetupForBusiness(businessType)

    const { data: company, error: completeError } =
      await supabaseAdmin.rpc(
        'complete_founder_activation',
        {
          p_claim_id: claimId,
          p_user_id: createdUserId,
          p_company_name: companyName,
          p_slug: slugValidation.slug,
          p_business_type: businessType,
          p_whatsapp: whatsapp,
          p_cidade: cidade,
          p_estado: estado || null,
          p_onboarding_goal: onboardingGoal,
          p_default_setup: defaultSetup,
        },
      )

    if (completeError || !company?.id) {
      const deleteResult =
        await supabaseAdmin.auth.admin.deleteUser(
          createdUserId,
        )

      await releaseClaim(
        supabaseAdmin,
        claimId,
        [
          'COMPANY_FINALIZE_FAILED',
          completeError?.message || 'unknown',
          deleteResult.error
            ? `AUTH_COMPENSATION_FAILED:${deleteResult.error.message}`
            : 'AUTH_COMPENSATED',
        ].join(' | '),
      )

      createdUserId = ''

      throw (
        completeError ||
        new Error(
          'Não foi possível concluir a criação da empresa.',
        )
      )
    }

    return NextResponse.json({
      ok: true,
      email: claimed.email,
      founder_number: claimed.founder_number,
      company: {
        id: company.id,
        nome: company.nome,
        slug: company.slug,
        subdomain_slug: company.subdomain_slug,
        assinatura_status: company.assinatura_status,
        trial_ends_at: company.trial_ends_at,
        founder_price_ends_at:
          company.founder_price_ends_at,
      },
      message:
        'Conta Founder ativada. Seus 30 dias gratuitos começaram agora.',
    })
  } catch (error) {
    if (claimId) {
      if (createdUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(
            createdUserId,
          )
        } catch {
          // O erro é registrado no claim abaixo.
        }
      }

      await releaseClaim(
        supabaseAdmin,
        claimId,
        error instanceof Error
          ? error.message
          : 'FOUNDER_ACTIVATION_UNKNOWN_ERROR',
      )
    }

    const message =
      error instanceof Error
        ? databaseMessage(error.message)
        : 'Não foi possível ativar a conta Founder.'

    const conflict =
      message.includes('já') ||
      message.includes('expir') ||
      message.includes('corresponde') ||
      message.includes('uso') ||
      message.includes('instantes')

    return NextResponse.json(
      { error: message },
      { status: conflict ? 409 : 500 },
    )
  }
}
