/* eslint-disable @typescript-eslint/no-explicit-any */
// ORCALY_OWNER_FINANCE_V1
import { NextRequest, NextResponse } from 'next/server'
import { requireOfficialPlatformOwner } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>

const ACCEPTED_PAYMENT_STATUSES = new Set([
  'paid',
  'approved',
  'authorized',
])

const ACTIVE_COMMISSION_STATUSES = new Set([
  'hold',
  'available',
  'processing',
  'paid',
])

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as JsonRecord
}

function records(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is JsonRecord =>
      Boolean(item) &&
      typeof item === 'object' &&
      !Array.isArray(item),
  )
}

function num(value: unknown) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: unknown) {
  return Math.round(num(value) * 100) / 100
}

function lower(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function timestamp(value: unknown) {
  if (!value) return 0
  const parsed = new Date(String(value)).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) throw new Error('Mês inválido.')

  const year = Number(match[1])
  const monthNumber = Number(match[2])

  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error('Mês inválido.')
  }

  const currentStart = new Date(
    `${year}-${String(monthNumber).padStart(2, '0')}-01T00:00:00-03:00`,
  )

  const nextYear = monthNumber === 12 ? year + 1 : year
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1
  const currentEnd = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00-03:00`,
  )

  const previousYear = monthNumber === 1 ? year - 1 : year
  const previousMonth = monthNumber === 1 ? 12 : monthNumber - 1
  const previousStart = new Date(
    `${previousYear}-${String(previousMonth).padStart(2, '0')}-01T00:00:00-03:00`,
  )

  return {
    month: `${year}-${String(monthNumber).padStart(2, '0')}`,
    currentStart,
    currentEnd,
    previousStart,
    previousMonth: `${previousYear}-${String(previousMonth).padStart(2, '0')}`,
  }
}

function currentMonthMaceio() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value

  return `${year || new Date().getUTCFullYear()}-${month || '01'}`
}

function inRange(value: unknown, start: Date, end: Date) {
  const time = timestamp(value)
  return time >= start.getTime() && time < end.getTime()
}

function localDay(value: unknown) {
  const time = timestamp(value)
  if (!time) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(time))

  const year = parts.find((part) => part.type === 'year')?.value || ''
  const month = parts.find((part) => part.type === 'month')?.value || ''
  const day = parts.find((part) => part.type === 'day')?.value || ''

  return `${year}-${month}-${day}`
}

function paymentPayload(row: JsonRecord) {
  for (const key of [
    'raw_payment',
    'raw_authorized_payment',
    'raw_webhook',
  ]) {
    const value = asRecord(row[key])
    if (Object.keys(value).length) return value
  }

  return {}
}

function subscriptionProviderFee(row: JsonRecord) {
  const gross = money(row.valor)
  const payload = paymentPayload(row)
  const transactionDetails = asRecord(payload.transaction_details)
  const rawNet = transactionDetails.net_received_amount

  if (
    rawNet !== null &&
    rawNet !== undefined &&
    rawNet !== '' &&
    Number.isFinite(Number(rawNet))
  ) {
    const payloadGross =
      money(payload.transaction_amount) || gross
    const net = money(rawNet)
    return {
      fee: money(Math.max(0, payloadGross - net)),
      reconciled: true,
      net: money(Math.max(0, gross - Math.max(0, payloadGross - net))),
    }
  }

  const feeDetails = records(payload.fee_details)
  if (feeDetails.length) {
    const fee = money(
      feeDetails
        .filter(
          (feeRow) =>
            lower(feeRow.type) !== 'application_fee',
        )
        .reduce(
          (sum, feeRow) =>
            sum + Math.max(0, num(feeRow.amount)),
          0,
        ),
    )

    return {
      fee,
      reconciled: true,
      net: money(Math.max(0, gross - fee)),
    }
  }

  return {
    fee: 0,
    reconciled: false,
    net: gross,
  }
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function summarizePeriod(
  start: Date,
  end: Date,
  input: {
    subscriptions: JsonRecord[]
    marketplace: JsonRecord[]
    payouts: JsonRecord[]
    commissions: JsonRecord[]
    companies: Map<string, string>
    affiliates: Map<string, string>
  },
) {
  const subscriptions = input.subscriptions.filter((row) => {
    const status = lower(row.status)
    const occurredAt = row.paid_at || row.created_at

    return (
      ACCEPTED_PAYMENT_STATUSES.has(status) &&
      inRange(occurredAt, start, end)
    )
  })

  const marketplace = input.marketplace.filter((row) => {
    const occurredAt = row.paid_at || row.created_at
    return lower(row.status) === 'paid' && inRange(occurredAt, start, end)
  })

  const payoutsPaid = input.payouts.filter(
    (row) =>
      lower(row.status) === 'paid' &&
      inRange(row.paid_at || row.created_at, start, end),
  )

  const commissionsGenerated = input.commissions.filter(
    (row) =>
      ACTIVE_COMMISSION_STATUSES.has(lower(row.status)) &&
      inRange(row.created_at, start, end),
  )

  let subscriptionGross = 0
  let subscriptionProviderFee = 0
  let subscriptionUnreconciledGross = 0

  const subscriptionDetails = subscriptions
    .map((row) => {
      const feeInfo = subscriptionProviderFeeForRow(row)
      const gross = money(row.valor)
      subscriptionGross += gross
      subscriptionProviderFee += feeInfo.fee

      if (!feeInfo.reconciled) {
        subscriptionUnreconciledGross += gross
      }

      return {
        id: String(row.id || ''),
        occurredAt: row.paid_at || row.created_at || null,
        company:
          input.companies.get(String(row.company_id || '')) ||
          String(row.nome_empresa || 'Assinante'),
        plan: String(row.plano || '—'),
        provider: String(row.provider || 'mercado_pago'),
        paymentMethod: String(row.payment_method || '—'),
        gross,
        providerFee: feeInfo.fee,
        net: feeInfo.net,
        feeReconciled: feeInfo.reconciled,
      }
    })
    .sort(
      (a, b) =>
        timestamp(b.occurredAt) - timestamp(a.occurredAt),
    )

  let marketplaceGmv = 0
  let marketplaceProviderFee = 0
  let marketplacePlatformRevenue = 0
  let marketplacePlatformFeePending = 0
  let marketplaceSellerNet = 0

  const marketplaceDetails = marketplace
    .map((row) => {
      const gross = money(row.gross_amount || row.amount)
      const providerFee = money(row.provider_fee_amount)
      const platformFee = money(
        row.platform_fee_amount || row.commission_amount,
      )
      const splitApplied = lower(row.split_status) === 'applied'
      const sellerNet = money(row.seller_net_amount)

      marketplaceGmv += gross
      marketplaceProviderFee += providerFee
      marketplaceSellerNet += sellerNet

      if (splitApplied) {
        marketplacePlatformRevenue += platformFee
      } else {
        marketplacePlatformFeePending += platformFee
      }

      return {
        id: String(row.id || ''),
        occurredAt: row.paid_at || row.created_at || null,
        company:
          input.companies.get(String(row.company_id || '')) ||
          'Empresa',
        provider: String(row.provider || 'mercado_pago'),
        paymentMethod: String(row.payment_method || '—'),
        gross,
        providerFee,
        platformFee,
        sellerNet,
        splitStatus: String(row.split_status || 'não confirmado'),
      }
    })
    .sort(
      (a, b) =>
        timestamp(b.occurredAt) - timestamp(a.occurredAt),
    )

  const payoutsPaidTotal = money(
    payoutsPaid.reduce(
      (sum, row) => sum + num(row.amount),
      0,
    ),
  )

  const commissionGeneratedTotal = money(
    commissionsGenerated.reduce(
      (sum, row) => sum + num(row.commission_amount),
      0,
    ),
  )

  const payoutDetails = payoutsPaid
    .map((row) => ({
      id: String(row.id || ''),
      occurredAt: row.paid_at || row.created_at || null,
      partner:
        input.affiliates.get(String(row.affiliate_id || '')) ||
        String(row.holder_name || 'Indicador'),
      amount: money(row.amount),
      provider: String(row.provider || '—'),
      reference: String(row.external_reference || '—'),
    }))
    .sort(
      (a, b) =>
        timestamp(b.occurredAt) - timestamp(a.occurredAt),
    )

  const subscriptionProviderFeeRounded = money(
    subscriptionProviderFee,
  )
  const platformGrossRevenue = money(
    subscriptionGross + marketplacePlatformRevenue,
  )
  const knownCashOut = money(
    subscriptionProviderFeeRounded + payoutsPaidTotal,
  )
  const netCash = money(platformGrossRevenue - knownCashOut)
  const economicNetAfterGeneratedCommissions = money(
    platformGrossRevenue -
      subscriptionProviderFeeRounded -
      commissionGeneratedTotal,
  )

  const daily = new Map<
    string,
    {
      day: string
      subscriptions: number
      marketplaceRevenue: number
      providerFees: number
      payouts: number
      net: number
    }
  >()

  const dayRow = (day: string) => {
    const existing = daily.get(day)
    if (existing) return existing

    const created = {
      day,
      subscriptions: 0,
      marketplaceRevenue: 0,
      providerFees: 0,
      payouts: 0,
      net: 0,
    }

    daily.set(day, created)
    return created
  }

  for (const row of subscriptionDetails) {
    const day = localDay(row.occurredAt)
    if (!day) continue
    const item = dayRow(day)
    item.subscriptions = money(item.subscriptions + row.gross)
    item.providerFees = money(item.providerFees + row.providerFee)
  }

  for (const row of marketplaceDetails) {
    if (lower(row.splitStatus) !== 'applied') continue
    const day = localDay(row.occurredAt)
    if (!day) continue
    const item = dayRow(day)
    item.marketplaceRevenue = money(
      item.marketplaceRevenue + row.platformFee,
    )
  }

  for (const row of payoutDetails) {
    const day = localDay(row.occurredAt)
    if (!day) continue
    const item = dayRow(day)
    item.payouts = money(item.payouts + row.amount)
  }

  const dailyRows = Array.from(daily.values())
    .map((item) => ({
      ...item,
      net: money(
        item.subscriptions +
          item.marketplaceRevenue -
          item.providerFees -
          item.payouts,
      ),
    }))
    .sort((a, b) => a.day.localeCompare(b.day))

  return {
    metrics: {
      subscriptionGross: money(subscriptionGross),
      subscriptionProviderFee: subscriptionProviderFeeRounded,
      subscriptionNetKnown: money(
        subscriptionGross - subscriptionProviderFeeRounded,
      ),
      subscriptionUnreconciledGross: money(
        subscriptionUnreconciledGross,
      ),
      marketplaceGmv: money(marketplaceGmv),
      marketplaceProviderFee: money(marketplaceProviderFee),
      marketplacePlatformRevenue: money(
        marketplacePlatformRevenue,
      ),
      marketplacePlatformFeePending: money(
        marketplacePlatformFeePending,
      ),
      marketplaceSellerNet: money(marketplaceSellerNet),
      platformGrossRevenue,
      affiliateCommissionGenerated: commissionGeneratedTotal,
      affiliatePayoutsPaid: payoutsPaidTotal,
      knownCashOut,
      netCash,
      economicNetAfterGeneratedCommissions,
      marginPercent:
        platformGrossRevenue > 0
          ? Math.round((netCash / platformGrossRevenue) * 1000) / 10
          : 0,
      subscriptionPaymentCount: subscriptions.length,
      marketplacePaymentCount: marketplace.length,
      payoutCount: payoutsPaid.length,
    },
    daily: dailyRows,
    subscriptionDetails,
    marketplaceDetails,
    payoutDetails,
  }
}

// Function name kept separate to make the summarizer easier to scan.
function subscriptionProviderFeeForRow(row: JsonRecord) {
  return subscriptionProviderFee(row)
}

export async function GET(request: NextRequest) {
  const session =
    await requireOfficialPlatformOwner(request)

  if (!session.ok) {
    return NextResponse.json(
      { error: session.error },
      { status: session.status },
    )
  }

  try {
    const requestedMonth =
      request.nextUrl.searchParams.get('month') ||
      currentMonthMaceio()

    const bounds = monthBounds(requestedMonth)
    const db = session.supabaseAdmin

    const [
      subscriptionsResult,
      marketplaceResult,
      payoutsResult,
      pendingPayoutsResult,
      commissionsResult,
      outstandingCommissionsResult,
      companiesResult,
      affiliatesResult,
    ] = await Promise.all([
      db
        .from('plan_payments')
        .select(
          'id,company_id,plano,valor,status,nome_empresa,provider,payment_method,paid_at,created_at,raw_payment,raw_authorized_payment,raw_webhook',
        )
        .gte(
          'created_at',
          bounds.previousStart.toISOString(),
        )
        .lt('created_at', bounds.currentEnd.toISOString())
        .limit(5000),
      db
        .from('marketplace_payments')
        .select(
          'id,company_id,provider,status,split_status,payment_method,amount,gross_amount,provider_fee_amount,provider_net_amount,platform_fee_amount,commission_amount,seller_net_amount,paid_at,created_at',
        )
        .gte(
          'created_at',
          bounds.previousStart.toISOString(),
        )
        .lt('created_at', bounds.currentEnd.toISOString())
        .limit(5000),
      db
        .from('affiliate_payouts')
        .select(
          'id,affiliate_id,amount,status,provider,holder_name,external_reference,paid_at,created_at',
        )
        .gte(
          'created_at',
          bounds.previousStart.toISOString(),
        )
        .lt('created_at', bounds.currentEnd.toISOString())
        .limit(3000),
      db
        .from('affiliate_payouts')
        .select('id,affiliate_id,amount,status')
        .in('status', [
          'requested',
          'approved',
          'processing',
        ])
        .limit(3000),
      db
        .from('affiliate_commissions')
        .select(
          'id,affiliate_id,commission_amount,status,created_at',
        )
        .gte(
          'created_at',
          bounds.previousStart.toISOString(),
        )
        .lt('created_at', bounds.currentEnd.toISOString())
        .limit(5000),
      db
        .from('affiliate_commissions')
        .select('id,commission_amount,status')
        .in('status', ['hold', 'available', 'processing'])
        .limit(5000),
      db.from('companies').select('id,nome').limit(5000),
      db
        .from('affiliate_profiles')
        .select('id,name')
        .limit(5000),
    ])

    const allResults = [
      subscriptionsResult,
      marketplaceResult,
      payoutsResult,
      pendingPayoutsResult,
      commissionsResult,
      outstandingCommissionsResult,
      companiesResult,
      affiliatesResult,
    ]

    const firstError = allResults.find(
      (result) => result.error,
    )?.error

    if (firstError) throw firstError

    const companies = new Map<string, string>(
      records(companiesResult.data).map((row) => [
        String(row.id || ''),
        String(row.nome || 'Empresa'),
      ]),
    )

    const affiliates = new Map<string, string>(
      records(affiliatesResult.data).map((row) => [
        String(row.id || ''),
        String(row.name || 'Indicador'),
      ]),
    )

    const source = {
      subscriptions: records(subscriptionsResult.data),
      marketplace: records(marketplaceResult.data),
      payouts: records(payoutsResult.data),
      commissions: records(commissionsResult.data),
      companies,
      affiliates,
    }

    const current = summarizePeriod(
      bounds.currentStart,
      bounds.currentEnd,
      source,
    )

    const previous = summarizePeriod(
      bounds.previousStart,
      bounds.currentStart,
      source,
    )

    const pendingPayouts = money(
      records(pendingPayoutsResult.data).reduce(
        (sum, row) => sum + num(row.amount),
        0,
      ),
    )

    const outstandingAffiliateCommissions = money(
      records(outstandingCommissionsResult.data).reduce(
        (sum, row) => sum + num(row.commission_amount),
        0,
      ),
    )

    return NextResponse.json({
      admin: {
        email: session.admin.email,
        nome: session.admin.nome,
      },
      month: bounds.month,
      previousMonth: bounds.previousMonth,
      current,
      previous: {
        metrics: previous.metrics,
      },
      comparison: {
        grossRevenuePercent: percentChange(
          current.metrics.platformGrossRevenue,
          previous.metrics.platformGrossRevenue,
        ),
        netCashPercent: percentChange(
          current.metrics.netCash,
          previous.metrics.netCash,
        ),
        marketplaceGmvPercent: percentChange(
          current.metrics.marketplaceGmv,
          previous.metrics.marketplaceGmv,
        ),
        subscriptionGrossPercent: percentChange(
          current.metrics.subscriptionGross,
          previous.metrics.subscriptionGross,
        ),
      },
      obligations: {
        pendingPayouts,
        outstandingAffiliateCommissions,
      },
      accountingNotes: {
        marketplaceProviderFeeIsSellerCost: true,
        netCashIsPartial:
          current.metrics.subscriptionUnreconciledGross > 0,
        generalPlatformExpensesIncluded: false,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o financeiro da plataforma.',
      },
      { status: 500 },
    )
  }
}
