import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isMissingRelation } from '@/lib/admin/optional-schema'
import { reportApplicationError } from '@/lib/observability/application-errors'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'Operational' | 'Degraded' | 'Down' | 'Unknown'
type Service = {
  key: string
  name: string
  status: Status
  detail: string
  observedAt?: string | null
}

type ErrorRow = {
  error_id?: string | null
  route?: string | null
  operation?: string | null
  error_type?: string | null
  error_code?: string | null
  http_status?: number | null
  created_at?: string | null
}

function statusFrom(success: number, failed: number): Status {
  if (success > 0 && failed === 0) return 'Operational'
  if (success > 0 && failed > 0) return 'Degraded'
  if (failed > 0) return 'Degraded'
  return 'Unknown'
}

function lower(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || randomUUID()
  const session = await requirePlatformAdmin(request, 'system.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })

  try {
    const db = session.supabaseAdmin
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [supabaseCheck, hooks, whatsapp, scan, security, assistant, applicationErrors] = await Promise.all([
      db.from('companies').select('id', { count: 'exact', head: true }),
      db.from('payment_webhook_events').select('id,provider,processing_status,received_at,error_message').gte('received_at', since).order('received_at', { ascending: false }).limit(300),
      db.from('whatsapp_message_logs').select('id,status,error,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(300),
      db.from('admin_scan_runs').select('id,status,started_at,finished_at,total_issues,critical_count,high_count').order('started_at', { ascending: false }).limit(1).maybeSingle(),
      db.from('security_events').select('id', { count: 'exact', head: true }).eq('resolved', false),
      db.from('assistant_events').select('event_name,status,created_at,model').gte('created_at', since).order('created_at', { ascending: false }).limit(300),
      db.from('application_error_events').select('error_id,route,operation,error_type,error_code,http_status,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
    ])

    const hookRows = hooks.data || []
    const mpRows = hookRows.filter((row) => lower(row.provider).includes('mercado'))
    const mpSuccess = mpRows.filter((row) => ['processed', 'success', 'completed', 'done'].includes(lower(row.processing_status))).length
    const mpFailed = mpRows.filter((row) => ['failed', 'error'].includes(lower(row.processing_status))).length

    const waRows = whatsapp.data || []
    const waSuccess = waRows.filter((row) => ['sent', 'delivered', 'read', 'success'].includes(lower(row.status)) && !row.error).length
    const waFailed = waRows.filter((row) => Boolean(row.error) || ['failed', 'error'].includes(lower(row.status))).length

    const assistantRows = assistant.data || []
    const assistantFailed = assistantRows.filter((row) =>
      lower(row.event_name).includes('provider_error') || ['error', 'fallback', 'failed'].includes(lower(row.status)),
    ).length
    const assistantSuccess = assistantRows.filter((row) =>
      ['ok', 'success'].includes(lower(row.status)) && !lower(row.event_name).includes('provider_error'),
    ).length

    const errorRelationMissing = isMissingRelation(applicationErrors.error, 'application_error_events')
    const errorSchemaReady = !errorRelationMissing
    const errorTelemetryReadable = !applicationErrors.error
    const recentErrors = errorTelemetryReadable ? ((applicationErrors.data || []) as ErrorRow[]) : []
    const error5xx = recentErrors.filter((row) => Number(row.http_status || 0) >= 500).length

    const services: Service[] = [
      {
        key: 'supabase',
        name: 'Supabase / Database',
        status: supabaseCheck.error ? 'Down' : 'Operational',
        detail: supabaseCheck.error
          ? 'A consulta real de leitura falhou. Consulte o Error Explorer e os logs do provider.'
          : `Consulta real respondida · ${supabaseCheck.count || 0} empresas observadas.`,
        observedAt: new Date().toISOString(),
      },
      {
        key: 'vercel',
        name: 'Vercel Runtime',
        status: process.env.VERCEL_ENV ? 'Operational' : 'Unknown',
        detail: process.env.VERCEL_ENV
          ? `Esta requisição foi servida no ambiente ${process.env.VERCEL_ENV}. Isso confirma o runtime atual, não a saúde global da Vercel.`
          : 'Execução fora de runtime Vercel observável.',
        observedAt: new Date().toISOString(),
      },
      {
        key: 'mercado_pago',
        name: 'Mercado Pago',
        status: hooks.error ? 'Unknown' : statusFrom(mpSuccess, mpFailed),
        detail: hooks.error
          ? 'Telemetria de webhooks indisponível; nenhuma inferência de saúde externa foi feita.'
          : mpRows.length
            ? `${mpSuccess} webhooks processados e ${mpFailed} falhos nas últimas 24h.`
            : 'Sem evento recente suficiente para inferir saúde externa.',
        observedAt: mpRows[0]?.received_at || null,
      },
      {
        key: 'ai',
        name: 'Assistente / AI provider',
        status: assistant.error ? 'Unknown' : statusFrom(assistantSuccess, assistantFailed),
        detail: assistant.error
          ? 'Telemetria do Assistente indisponível neste schema.'
          : assistantRows.length
            ? `${assistantSuccess} execuções com sucesso e ${assistantFailed} falhas/fallbacks observados nas últimas 24h.`
            : 'Sem evento recente suficiente para inferir saúde do provider. Credencial configurada, sozinha, não conta como saúde.',
        observedAt: assistantRows[0]?.created_at || null,
      },
      {
        key: 'whatsapp',
        name: 'WhatsApp',
        status: whatsapp.error ? 'Unknown' : statusFrom(waSuccess, waFailed),
        detail: whatsapp.error
          ? 'Telemetria de mensagens indisponível; nenhuma bolinha verde foi inventada.'
          : waRows.length
            ? `${waSuccess} mensagens com sucesso e ${waFailed} falhas nas últimas 24h.`
            : 'Sem mensagens recentes suficientes para inferir saúde.',
        observedAt: waRows[0]?.created_at || null,
      },
      {
        key: 'application_errors',
        name: 'Application Errors',
        status: !errorSchemaReady || !errorTelemetryReadable
          ? 'Unknown'
          : error5xx > 0
            ? 'Degraded'
            : recentErrors.length
              ? 'Operational'
              : 'Unknown',
        detail: !errorSchemaReady
          ? 'Migration de observabilidade ainda não aplicada neste ambiente.'
          : !errorTelemetryReadable
            ? 'Schema existe, mas a leitura da telemetria falhou. Nenhuma inferência de saúde foi feita.'
            : recentErrors.length
              ? `${recentErrors.length} erros registrados em 24h; ${error5xx} associados a HTTP 5xx.`
              : 'Schema disponível, mas sem eventos recentes. Ausência de evento não prova saúde total.',
        observedAt: recentErrors[0]?.created_at || null,
      },
      {
        key: 'email',
        name: 'E-mail',
        status: 'Unknown',
        detail: 'Não há telemetria persistida de provider de e-mail no schema auditado.',
      },
      {
        key: 'jobs',
        name: 'Jobs / Cron',
        status: scan.error ? 'Unknown' : scan.data?.status === 'completed' ? 'Operational' : scan.data ? 'Degraded' : 'Unknown',
        detail: scan.error
          ? 'Não foi possível consultar o último scanner administrativo.'
          : scan.data
            ? `Último scanner: ${String(scan.data.status || 'unknown')} · ${Number(scan.data.total_issues || 0)} achados.`
            : 'Não há execução recente suficiente para inferir a saúde de jobs.',
        observedAt: scan.data?.finished_at || scan.data?.started_at || null,
      },
    ]

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        requestId,
        services,
        metrics: {
          webhookFailures24h: hooks.error ? null : hookRows.filter((row) => ['failed', 'error'].includes(lower(row.processing_status))).length,
          whatsappFailures24h: whatsapp.error ? null : waFailed,
          securityOpen: security.error ? null : security.count || 0,
          applicationErrors24h: !errorTelemetryReadable ? null : recentErrors.length,
          application5xx24h: !errorTelemetryReadable ? null : error5xx,
          latestScan: scan.error ? null : scan.data || null,
        },
        recentErrors: recentErrors.slice(0, 12).map((row) => ({
          errorId: row.error_id || null,
          route: row.route || 'unknown',
          operation: row.operation || 'unknown',
          type: row.error_type || 'UnknownError',
          code: row.error_code || null,
          httpStatus: row.http_status || null,
          createdAt: row.created_at || null,
        })),
        schema: {
          applicationErrorsReady: errorSchemaReady,
          applicationErrorsReadable: errorTelemetryReadable,
        },
      },
      { headers: { 'x-orcaly-request-id': requestId } },
    )
  } catch (error) {
    const incident = await reportApplicationError({
      error,
      route: '/api/admin/system-health',
      operation: 'load_system_health',
      requestId,
      httpStatus: 500,
    })
    return NextResponse.json(
      {
        error: 'Não foi possível carregar a saúde da plataforma.',
        errorId: incident.errorId,
        requestId: incident.requestId,
      },
      { status: 500, headers: { 'x-orcaly-request-id': incident.requestId } },
    )
  }
}
