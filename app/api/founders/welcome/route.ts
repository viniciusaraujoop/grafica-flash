import { NextRequest, NextResponse } from 'next/server'
import {
  getCompanyAccess,
  getRequester,
  getSupabaseAdmin,
} from '@/lib/company-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const requester = await getRequester(
      request,
      supabaseAdmin,
    )

    if (!requester) {
      return NextResponse.json(
        { error: 'Não autorizado.' },
        { status: 401 },
      )
    }

    const access = await getCompanyAccess(
      supabaseAdmin,
      requester.id,
      requester.email,
    )

    const company = access.company

    if (!company?.id || company.owner_id !== requester.id) {
      return NextResponse.json(
        {
          error:
            'Somente o dono da empresa pode confirmar a mensagem Founder.',
        },
        { status: 403 },
      )
    }

    if (company.is_founder !== true) {
      return NextResponse.json(
        { error: 'Esta empresa não é Founder.' },
        { status: 400 },
      )
    }

    if (company.founder_welcome_seen_at) {
      return NextResponse.json({
        ok: true,
        seen_at: company.founder_welcome_seen_at,
      })
    }

    const seenAt = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('companies')
      .update({
        founder_welcome_seen_at: seenAt,
        updated_at: seenAt,
      })
      .eq('id', company.id)
      .eq('owner_id', requester.id)
      .eq('is_founder', true)

    if (error) throw error

    return NextResponse.json({
      ok: true,
      seen_at: seenAt,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar a confirmação Founder.',
      },
      { status: 500 },
    )
  }
}
