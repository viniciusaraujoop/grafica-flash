// ORCALY_OWNER_SUPPORT_CONTROL_V1
// ORCALY_OWNER_BACKOFFICE_V2
import { NextRequest, NextResponse } from 'next/server'
import {
  affiliateStatusCode,
  getAffiliateAdminDashboard,
  processAffiliateAdminAction,
} from '@/lib/affiliates/server'
import {
  auditPlatformAction,
  canPlatform,
  platformCapabilities,
  requireOfficialPlatformOwner,
  requirePlatformAdmin,
  type PlatformPermission,
} from '@/lib/platform-admin'
import {
  decryptPaymentCredential,
} from '@/lib/payments/credential-encryption'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return String(value || '').trim()
}

const ACTION_PERMISSIONS: Record<
  string,
  PlatformPermission
> = {
  profile_status: 'affiliates.manage',
  review_referral: 'referrals.review',
  verify_payout_account: 'pix.verify',
  reveal_pix: 'pix.reveal',
  create_payout: 'payouts.create',
  approve_payout: 'payouts.approve',
  send_payout: 'payouts.send',
  mark_paid_manual: 'payouts.mark_paid',
  cancel_payout: 'payouts.cancel',
  reverse_commission: 'commissions.reverse',
}

export async function GET(request: NextRequest) {
  const session = await requireOfficialPlatformOwner(request)

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  try {
    const [dashboard, payoutAccountsResult] =
      await Promise.all([
        getAffiliateAdminDashboard(),
        session.supabaseAdmin.rpc(
          'list_affiliate_payout_accounts_admin',
        ),
      ])

    if (payoutAccountsResult.error) {
      throw payoutAccountsResult.error
    }

    const accounts = Array.isArray(
      payoutAccountsResult.data,
    )
      ? payoutAccountsResult.data
      : []

    const accountMap = new Map(
      accounts.map((account: any) => [
        String(account.affiliate_id),
        account,
      ]),
    )

    const canFinance = canPlatform(
      session.admin,
      'finance.view',
    )
    const canReferrals = canPlatform(
      session.admin,
      'referrals.view',
    )
    const canCommissions = canPlatform(
      session.admin,
      'commissions.view',
    )
    const canPayouts = canPlatform(
      session.admin,
      'payouts.view',
    )
    const canContacts = canPlatform(
      session.admin,
      'contact.view',
    )

    const safeProfiles = (
      dashboard.profiles || []
    ).map((profile: any) => ({
      ...profile,
      email: canContacts
        ? profile.email
        : 'Contato protegido',
      whatsapp: canContacts
        ? profile.whatsapp
        : null,
      document_last4:
        session.admin.role === 'owner'
          ? profile.document_last4
          : null,
      payoutAccount:
        accountMap.get(String(profile.id)) || null,
    }))

    const summary: Record<string, unknown> = {
      ...(dashboard.summary || {}),
      financialHidden: !canFinance,
    }

    if (!canFinance) {
      summary.commissionsHold = null
      summary.commissionsAvailable = null
      summary.commissionsPaid = null
      summary.payoutsPending = null
    }

    return NextResponse.json({
      ...dashboard,
      admin: {
        id: session.admin.id,
        email: session.admin.email,
        nome: session.admin.nome,
        role: session.admin.role,
        area: session.admin.area,
      },
      capabilities: platformCapabilities(
        session.admin,
      ),
      summary,
      profiles: safeProfiles,
      referrals: canReferrals
        ? (dashboard.referrals || []).map(
            (referral: any) => ({
              ...referral,
              lead: referral.lead
                ? {
                    ...referral.lead,
                    nome_responsavel: canContacts
                      ? referral.lead.nome_responsavel
                      : referral.customer_name_masked,
                    email: canContacts
                      ? referral.lead.email
                      : referral.customer_email_masked,
                    whatsapp: canContacts
                      ? referral.lead.whatsapp
                      : null,
                  }
                : null,
              company: referral.company
                ? {
                    ...referral.company,
                    email: canContacts
                      ? referral.company.email
                      : null,
                    whatsapp: canContacts
                      ? referral.company.whatsapp
                      : null,
                  }
                : null,
            }),
          )
        : [],
      commissions:
        canFinance && canCommissions
          ? dashboard.commissions || []
          : [],
      payouts:
        canFinance && canPayouts
          ? dashboard.payouts || []
          : [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as indicações.',
      },
      { status: affiliateStatusCode(error) },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request
      .json()
      .catch(() => ({}))
    const action = text(body.action)
    const permission =
      ACTION_PERMISSIONS[action]

    if (!permission) {
      return NextResponse.json(
        { error: 'Ação administrativa inválida.' },
        { status: 400 },
      )
    }

    const session = await requirePlatformAdmin(
      request,
      permission,
    )

    if (!session.ok) {
      return NextResponse.json(
        { error: session.error },
        { status: session.status },
      )
    }

    if (action === 'review_referral') {
      const referralId = text(body.referralId)
      const decision = text(body.decision)
      const note = text(body.note).slice(0, 500)

      const { data, error } =
        await session.supabaseAdmin.rpc(
          'review_affiliate_referral_admin',
          {
            p_referral_id: referralId,
            p_decision: decision,
            p_actor_email:
              session.admin.email,
            p_note: note || null,
          },
        )

      if (error) throw error

      await auditPlatformAction(
        session.admin.email,
        'affiliate_referral_reviewed',
        {
          targetType: 'affiliate_referral',
          targetId: referralId,
          payload: {
            decision,
            note,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        result: data,
      })
    }

    if (action === 'reveal_pix') {
      if (session.admin.role !== 'owner') {
        return NextResponse.json(
          {
            error:
              'Somente o dono pode revelar a chave Pix completa.',
          },
          { status: 403 },
        )
      }

      const affiliateId = text(
        body.affiliateId,
      )
      const { data, error } =
        await session.supabaseAdmin.rpc(
          'get_affiliate_payout_account_admin',
          {
            p_affiliate_id: affiliateId,
          },
        )

      if (error) throw error

      const account = Array.isArray(data)
        ? data[0]
        : data

      if (!account?.pix_key_encrypted) {
        return NextResponse.json(
          {
            error:
              'Este parceiro ainda não cadastrou uma conta Pix.',
          },
          { status: 404 },
        )
      }

      const pixKey = decryptPaymentCredential(
        account.pix_key_encrypted,
      )

      await auditPlatformAction(
        session.admin.email,
        'affiliate_pix_revealed',
        {
          targetType: 'affiliate',
          targetId: affiliateId,
          targetLabel:
            account.holder_name || null,
          payload: {
            pixKeyType:
              account.pix_key_type,
            pixKeyMasked:
              account.pix_key_masked,
          },
        },
      )

      return NextResponse.json({
        ok: true,
        pixKey,
        pixKeyType: account.pix_key_type,
        holderName: account.holder_name,
        bankName: account.bank_name,
      })
    }

    return NextResponse.json(
      await processAffiliateAdminAction(
        session.admin.email,
        body,
      ),
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível concluir a ação.',
      },
      { status: affiliateStatusCode(error) },
    )
  }
}
