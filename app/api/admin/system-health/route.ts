import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'Operational' | 'Degraded' | 'Down' | 'Unknown'
function statusFrom(success: number, failed: number): Status { if (success > 0 && failed === 0) return 'Operational'; if (success > 0 && failed > 0) return 'Degraded'; if (failed > 0) return 'Degraded'; return 'Unknown' }

export async function GET(request: NextRequest) {
  const session = await requirePlatformAdmin(request, 'system.read')
  if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status })
  const db = session.supabaseAdmin
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [supabaseCheck, hooks, whatsapp, scan, security] = await Promise.all([
    db.from('companies').select('id', { count: 'exact', head: true }),
    db.from('payment_webhook_events').select('id,provider,processing_status,received_at,error_message').gte('received_at', since).order('received_at', { ascending: false }).limit(300),
    db.from('whatsapp_message_logs').select('id,status,error,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(300),
    db.from('admin_scan_runs').select('id,status,started_at,finished_at,total_issues,critical_count,high_count').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('security_events').select('id', { count: 'exact', head: true }).eq('resolved', false),
  ])
  const hookRows = hooks.data || []
  const mpRows = hookRows.filter((row) => String(row.provider || '').toLowerCase().includes('mercado'))
  const mpSuccess = mpRows.filter((row) => ['processed','success','completed','done'].includes(String(row.processing_status || '').toLowerCase())).length
  const mpFailed = mpRows.filter((row) => ['failed','error'].includes(String(row.processing_status || '').toLowerCase())).length
  const waRows = whatsapp.data || []
  const waSuccess = waRows.filter((row) => ['sent','delivered','read','success'].includes(String(row.status || '').toLowerCase()) && !row.error).length
  const waFailed = waRows.filter((row) => Boolean(row.error) || ['failed','error'].includes(String(row.status || '').toLowerCase())).length
  const services: Array<{ key: string; name: string; status: Status; detail: string; observedAt?: string | null }> = [
    { key: 'supabase', name: 'Supabase', status: supabaseCheck.error ? 'Down' : 'Operational', detail: supabaseCheck.error ? supabaseCheck.error.message : `Consulta real respondida · ${supabaseCheck.count || 0} empresas`, observedAt: new Date().toISOString() },
    { key: 'vercel', name: 'Vercel', status: process.env.VERCEL_ENV ? 'Operational' : 'Unknown', detail: process.env.VERCEL_ENV ? `Esta requisição foi servida no ambiente ${process.env.VERCEL_ENV}. Isso não representa monitoramento global da Vercel.` : 'Execução fora de runtime Vercel observável.', observedAt: new Date().toISOString() },
    { key: 'mercado_pago', name: 'Mercado Pago', status: statusFrom(mpSuccess, mpFailed), detail: mpRows.length ? `${mpSuccess} webhooks processados e ${mpFailed} falhos nas últimas 24h.` : 'Sem evento recente suficiente para inferir saúde externa.', observedAt: mpRows[0]?.received_at || null },
    { key: 'openai', name: 'OpenAI', status: 'Unknown', detail: process.env.OPENAI_API_KEY ? 'Credencial configurada, mas não existe telemetria de saúde externa persistida para esta visão.' : 'Credencial não observada no runtime.' },
    { key: 'whatsapp', name: 'WhatsApp', status: statusFrom(waSuccess, waFailed), detail: waRows.length ? `${waSuccess} mensagens com sucesso e ${waFailed} falhas nas últimas 24h.` : 'Sem mensagens recentes suficientes para inferir saúde.', observedAt: waRows[0]?.created_at || null },
    { key: 'email', name: 'E-mail', status: 'Unknown', detail: 'Não há telemetria persistida de provider de e-mail no schema auditado.' },
    { key: 'jobs', name: 'Jobs / Cron', status: 'Unknown', detail: 'Não existe registro centralizado de execução de todos os crons. Scanner administrativo é exibido separadamente.' },
  ]
  return NextResponse.json({ generatedAt: new Date().toISOString(), services, metrics: { webhookFailures24h: hookRows.filter((row) => ['failed','error'].includes(String(row.processing_status || '').toLowerCase())).length, whatsappFailures24h: waFailed, securityOpen: security.count || 0, latestScan: scan.data || null } })
}
