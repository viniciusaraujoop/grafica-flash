'use client'

// ORCALY_LOGIN_SIGNATURE_V3

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'

type MessageType = 'info' | 'erro' | 'sucesso'

type SegmentCard = {
  label: string
  shortLabel: string
  headline: string
  description: string
  metric: string
  metricLabel: string
  accent: string
  soft: string
}

type Feature = {
  title: string
  description: string
  icon: ReactNode
}

type CompanyAccessPayload = {
  company?: { id?: string | null } | null
  error?: string
}

const segmentCards: SegmentCard[] = [
  {
    label: 'Orçaly Food',
    shortLabel: 'Food',
    headline: 'Pedidos entrando. Operação fluindo.',
    description:
      'Cardápio, adicionais, entrega e acompanhamento em uma experiência integrada.',
    metric: '18',
    metricLabel: 'pedidos hoje',
    accent: 'from-emerald-400 via-cyan-400 to-blue-500',
    soft: 'bg-emerald-400/15 text-emerald-100',
  },
  {
    label: 'Orçaly Gráfica',
    shortLabel: 'Gráfica',
    headline: 'Do orçamento à produção, tudo visível.',
    description:
      'Artes, medidas, aprovações, prazos e produção organizados no mesmo fluxo.',
    metric: '12',
    metricLabel: 'etapas ativas',
    accent: 'from-blue-400 via-indigo-400 to-violet-500',
    soft: 'bg-blue-400/15 text-blue-100',
  },
  {
    label: 'Orçaly Beauty',
    shortLabel: 'Beauty',
    headline: 'Agenda cheia. Atendimento organizado.',
    description:
      'Serviços, clientes, horários e presença digital trabalhando juntos.',
    metric: '86%',
    metricLabel: 'agenda ocupada',
    accent: 'from-fuchsia-400 via-violet-400 to-indigo-500',
    soft: 'bg-fuchsia-400/15 text-fuchsia-100',
  },
  {
    label: 'Orçaly Assistência',
    shortLabel: 'Assistência',
    headline: 'Cada aparelho com histórico e status.',
    description:
      'Fotos, defeitos, diagnóstico, orçamento e entrega sem perder informação.',
    metric: '09',
    metricLabel: 'serviços em análise',
    accent: 'from-amber-400 via-orange-400 to-rose-500',
    soft: 'bg-amber-400/15 text-amber-100',
  },
  {
    label: 'Orçaly Serviços',
    shortLabel: 'Serviços',
    headline: 'Propostas claras. Follow-up no tempo certo.',
    description:
      'Leads, prazos, clientes e oportunidades em uma rotina comercial mais previsível.',
    metric: '24',
    metricLabel: 'oportunidades abertas',
    accent: 'from-cyan-400 via-blue-400 to-indigo-500',
    soft: 'bg-cyan-400/15 text-cyan-100',
  },
]

function isValidEmail(value: string) {
  return (
    value.trim().length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
}

function getFriendlyAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (
    message === 'Invalid login credentials' ||
    normalized.includes('invalid login credentials')
  ) {
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

// ORCALY_LOGIN_DEFAULT_INICIO_V1
function getSafeNextPath() {
  if (typeof window === 'undefined') return '/painel/inicio'

  const params = new URLSearchParams(window.location.search)
  const rawNext = params.get('next')

  if (!rawNext) return '/painel/inicio'

  const next = rawNext.trim()

  if (!next) return '/painel/inicio'
  if (!next.startsWith('/')) return '/painel/inicio'
  if (next.startsWith('//')) return '/painel/inicio'
  if (next.includes('://')) return '/painel/inicio'
  if (next.startsWith('/login')) return '/painel/inicio'
  if (next.startsWith('/cadastro')) return '/painel/inicio'

  return next
}

async function fetchCompanyAccess(accessToken: string) {
  const response = await fetch('/api/company/current', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  const payload = (await response.json().catch(() => ({}))) as CompanyAccessPayload
  return { response, payload }
}

function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${className}`}>
      {children}
    </svg>
  )
}

function MailIcon() { return <Icon><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m5 8 7 5 7-5" /></Icon> }
function LockIcon() { return <Icon><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></Icon> }
function ShieldIcon() { return <Icon><path d="M12 3 5 6v5c0 4.6 2.8 8.4 7 10 4.2-1.6 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Icon> }
function ArrowIcon() { return <Icon><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></Icon> }
function SparkIcon() { return <Icon><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z" /><path d="m18.5 14 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></Icon> }
function EyeIcon({ hidden }: { hidden: boolean }) { return hidden ? <Icon><path d="m3 3 18 18" /><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" /><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.2 9 8a9.4 9.4 0 0 1-2 3.8" /><path d="M6.6 6.6C4.3 8.1 3 10.5 3 12c0 2.8 3.5 8 9 8 1.4 0 2.7-.3 3.8-.8" /></Icon> : <Icon><path d="M3 12c0-2.8 3.5-8 9-8s9 5.2 9 8-3.5 8-9 8-9-5.2-9-8Z" /><circle cx="12" cy="12" r="2.5" /></Icon> }
function ChartIcon() { return <Icon><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19V3" /></Icon> }
function UsersIcon() { return <Icon><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9" /><path d="M16.5 3.1a4 4 0 0 1 0 7.8" /></Icon> }
function LayersIcon() { return <Icon><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></Icon> }

function ProductPreview({ segment, index, onSelect }: { segment: SegmentCard; index: number; onSelect: (index: number) => void }) {
  const activity = [['Pedido #1048', 'Recebido agora', 'R$ 89,90'], ['Cliente recorrente', 'Novo contato', 'Ativo'], ['Proposta #231', 'Visualizada', 'Aguardando']]
  return (
    <div className="relative">
      <div className="absolute -inset-8 rounded-[3rem] bg-blue-400/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2.1rem] border border-white/12 bg-white/[0.08] p-3 shadow-[0_40px_100px_rgba(0,0,0,.28)] backdrop-blur-2xl">
        <div className="overflow-hidden rounded-[1.65rem] border border-white/8 bg-[#071a34]/92">
          <div className="flex items-center justify-between gap-4 border-b border-white/8 px-4 py-3">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" /></div>
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-white/8 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold text-white/45"><ShieldIcon />painel.orcaly.com.br</div>
          </div>
          <div className="grid min-h-[420px] grid-cols-[78px_1fr]">
            <aside className="border-r border-white/8 bg-black/10 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white shadow-lg"><Image src="/icone-orcaly.png" alt="" width={34} height={34} className="h-8 w-8 object-contain" /></div>
              <div className="mt-6 grid gap-3">{[LayersIcon, ChartIcon, UsersIcon].map((ItemIcon, itemIndex) => <div key={itemIndex} className={`grid h-10 w-10 place-items-center rounded-xl ${itemIndex === 0 ? 'bg-white text-[#05245c]' : 'bg-white/[0.06] text-white/35'}`}><ItemIcon /></div>)}</div>
            </aside>
            <div className="min-w-0 p-4 xl:p-5">
              <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/70">Visão geral</p><h2 className="mt-2 truncate text-xl font-black tracking-[-0.035em] text-white">Boa tarde, sua operação está em movimento.</h2></div><span className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black ${segment.soft}`}>{segment.label}</span></div>
              <div className="mt-5 grid grid-cols-3 gap-2.5">{[[segment.metric, segment.metricLabel], ['R$ 4,8k', 'movimentado'], ['92%', 'tarefas em dia']].map(([value, label], cardIndex) => <article key={label} className={`relative overflow-hidden rounded-[1.2rem] border border-white/8 p-3 ${cardIndex === 0 ? 'bg-white text-[#071b3a]' : 'bg-white/[0.06] text-white'}`}>{cardIndex === 0 ? <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${segment.accent}`} /> : null}<p className="text-lg font-black tracking-[-0.04em]">{value}</p><p className={`mt-1 text-[9px] font-bold leading-4 ${cardIndex === 0 ? 'text-slate-500' : 'text-white/40'}`}>{label}</p></article>)}</div>
              <div className="mt-4 grid gap-3 xl:grid-cols-[1.08fr_0.92fr]">
                <article className="rounded-[1.35rem] border border-white/8 bg-white/[0.055] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-white">Movimento da operação</p><p className="mt-1 text-[9px] font-bold text-white/35">Últimos sete dias</p></div><span className="rounded-full bg-emerald-400/12 px-2.5 py-1 text-[9px] font-black text-emerald-200">+18,4%</span></div><div className="mt-5 flex h-24 items-end gap-2">{[32, 48, 42, 66, 58, 84, 72].map((height, barIndex) => <div key={barIndex} className="flex h-full flex-1 items-end rounded-full bg-white/[0.045]"><div className={`w-full rounded-full bg-gradient-to-t ${segment.accent} opacity-85`} style={{ height: `${height}%` }} /></div>)}</div></article>
                <article className="rounded-[1.35rem] border border-white/8 bg-white/[0.055] p-4"><p className="text-xs font-black text-white">Atividade recente</p><div className="mt-3 grid gap-2.5">{activity.map(([title, subtitle, value]) => <div key={title} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] p-2.5"><div className="flex min-w-0 items-center gap-2.5"><span className={`h-8 w-1 rounded-full bg-gradient-to-b ${segment.accent}`} /><div className="min-w-0"><p className="truncate text-[10px] font-black text-white">{title}</p><p className="mt-0.5 truncate text-[8px] font-bold text-white/35">{subtitle}</p></div></div><span className="shrink-0 text-[8px] font-black text-cyan-100/70">{value}</span></div>)}</div></article>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${segment.accent}`} /><p className="truncate text-sm font-black text-white">{segment.headline}</p></div><p className="mt-1 max-w-xl text-xs font-semibold leading-5 text-white/45">{segment.description}</p></div><div className="flex shrink-0 items-center gap-1.5">{segmentCards.map((item, itemIndex) => <button key={item.shortLabel} type="button" onClick={() => onSelect(itemIndex)} aria-label={`Mostrar ${item.label}`} className={`h-2 rounded-full transition-all ${itemIndex === index ? 'w-7 bg-white' : 'w-2 bg-white/25 hover:bg-white/45'}`} />)}</div></div>
    </div>
  )
}

const trustFeatures: Feature[] = [
  { title: 'Acesso protegido', description: 'Autenticação vinculada à sua conta.', icon: <ShieldIcon /> },
  { title: 'Tudo centralizado', description: 'Site, clientes e operação no mesmo painel.', icon: <LayersIcon /> },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [lembrarEmail, setLembrarEmail] = useState(true)
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState('Entre para acessar o painel da sua empresa.')
  const [tipoMensagem, setTipoMensagem] = useState<MessageType>('info')
  const [segmentIndex, setSegmentIndex] = useState(0)
  const emailValido = useMemo(() => isValidEmail(email), [email])
  const currentSegment = segmentCards[segmentIndex]

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedEmail = window.localStorage.getItem('orcaly_login_email')
    const params = new URLSearchParams(window.location.search)
    const frame = window.requestAnimationFrame(() => {
      if (savedEmail) setEmail(savedEmail)
      if (params.get('expired') === '1') { setTipoMensagem('info'); setMensagem('Sua sessão expirou. Entre novamente para continuar.'); return }
      if (params.get('renovar') === '1') { setTipoMensagem('info'); setMensagem('Entre para renovar sua assinatura e reativar seu painel.'); return }
      setTipoMensagem('info'); setMensagem('Entre para acessar o painel da sua empresa.')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => { const timer = window.setInterval(() => setSegmentIndex((current) => (current + 1) % segmentCards.length), 5200); return () => window.clearInterval(timer) }, [])

  function handleEmailChange(value: string) {
    setEmail(value)
    if (typeof window !== 'undefined' && lembrarEmail) { const normalized = value.trim().toLowerCase(); if (normalized) window.localStorage.setItem('orcaly_login_email', normalized) }
  }

  function handleRememberChange(checked: boolean) {
    setLembrarEmail(checked)
    if (typeof window === 'undefined') return
    if (!checked) { window.localStorage.removeItem('orcaly_login_email'); return }
    const normalized = email.trim().toLowerCase(); if (normalized) window.localStorage.setItem('orcaly_login_email', normalized)
  }

  function avisarRecuperacaoSenha() { setTipoMensagem('info'); setMensagem('A recuperação automática será liberada em breve. Por enquanto, confira os dados ou fale com o suporte em orcalybr@gmail.com.') }

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (carregando) return
    const emailLimpo = email.trim().toLowerCase()
    if (!emailLimpo) { setTipoMensagem('erro'); setMensagem('Informe o e-mail da conta.'); return }
    if (!emailValido) { setTipoMensagem('erro'); setMensagem('Digite um e-mail válido.'); return }
    if (!senha) { setTipoMensagem('erro'); setMensagem('Informe sua senha de acesso.'); return }

    setCarregando(true); setTipoMensagem('info'); setMensagem('Validando seu acesso...')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailLimpo, password: senha })
      if (error) { setTipoMensagem('erro'); setMensagem(getFriendlyAuthError(error.message)); setCarregando(false); return }
      if (!data.user?.id) { setTipoMensagem('erro'); setMensagem('Não foi possível entrar agora. Tente novamente em alguns instantes.'); setCarregando(false); return }
      if (lembrarEmail && typeof window !== 'undefined') window.localStorage.setItem('orcaly_login_email', emailLimpo)

      let accessToken = data.session?.access_token
      if (!accessToken) { setTipoMensagem('erro'); setMensagem('Não foi possível validar a sessão da sua conta. Entre novamente.'); setCarregando(false); return }

      let { response: accessResponse, payload: accessPayload } = await fetchCompanyAccess(accessToken)

      if (accessResponse.status === 401) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (!refreshError && refreshed.session?.access_token) {
          accessToken = refreshed.session.access_token
          const retried = await fetchCompanyAccess(accessToken)
          accessResponse = retried.response
          accessPayload = retried.payload
        }
      }

      if (!accessResponse.ok) { setTipoMensagem('erro'); setMensagem(accessPayload.error || 'Não foi possível verificar a empresa vinculada à sua conta.'); setCarregando(false); return }
      if (!accessPayload.company?.id) { setTipoMensagem('info'); setMensagem('Sua conta ainda não está vinculada a uma empresa. Vamos concluir seu cadastro.'); router.replace('/cadastro'); return }

      setTipoMensagem('sucesso'); setMensagem('Acesso validado. Abrindo seu painel...')
      router.replace(getSafeNextPath())
      router.refresh()
    } catch {
      setTipoMensagem('erro'); setMensagem('Não foi possível entrar agora. Tente novamente em alguns instantes.'); setCarregando(false)
    }
  }

  const messageClass = tipoMensagem === 'erro' ? 'border-red-200/90 bg-red-50 text-red-700' : tipoMensagem === 'sucesso' ? 'border-emerald-200/90 bg-emerald-50 text-emerald-700' : 'border-blue-100 bg-blue-50/80 text-[#05245c]'

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f2f5f9] text-[#071b3a]" style={{ colorScheme: 'light' }}>
      <style>{`
        @keyframes orcalyLoginRevealV3 { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes orcalyLoginGlowV3 { 0%, 100% { opacity: .52; transform: translate3d(0, 0, 0) scale(1); } 50% { opacity: .82; transform: translate3d(0, -16px, 0) scale(1.05); } }
        @keyframes orcalyLoginScanV3 { from { transform: translateX(-130%); } to { transform: translateX(280%); } }
        @keyframes orcalyLoginProgressV3 { 0% { transform: translateX(-100%); } 100% { transform: translateX(240%); } }
        .orcaly-login-reveal-v3 { animation: orcalyLoginRevealV3 .6s cubic-bezier(.2,.7,.2,1) both; }
        .orcaly-login-glow-v3 { animation: orcalyLoginGlowV3 9s ease-in-out infinite; }
        .orcaly-login-scan-v3 { animation: orcalyLoginScanV3 3.8s ease-in-out infinite; }
        .orcaly-login-progress-v3 { animation: orcalyLoginProgressV3 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .orcaly-login-reveal-v3,.orcaly-login-glow-v3,.orcaly-login-scan-v3,.orcaly-login-progress-v3 { animation: none; } }
      `}</style>

      <div className="grid min-h-[100dvh] w-full lg:grid-cols-[minmax(0,1.12fr)_minmax(480px,.88fr)]">
        <aside className="relative hidden min-h-[100dvh] overflow-hidden bg-[#04152f] text-white lg:flex lg:flex-col">
          <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:52px_52px]" /><div className="orcaly-login-glow-v3 absolute -left-52 -top-64 h-[620px] w-[620px] rounded-full bg-blue-500/30 blur-3xl" /><div className="orcaly-login-glow-v3 absolute -right-64 top-[22%] h-[560px] w-[560px] rounded-full bg-cyan-400/18 blur-3xl [animation-delay:1.8s]" /><div className="absolute -bottom-72 left-[20%] h-[560px] w-[560px] rounded-full bg-violet-500/16 blur-3xl" /><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" /></div>
          <div className="relative flex items-center justify-between gap-5 px-8 py-7 xl:px-12"><Link href="/" aria-label="Voltar para a página inicial" className="inline-flex rounded-2xl bg-white px-4 py-3 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5"><Image src="/logo-orcaly.png" alt="Orçaly" width={190} height={56} priority className="h-11 w-auto object-contain" /></Link><div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-xs font-black text-white/70 backdrop-blur-xl"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_5px_rgba(52,211,153,.12)]" />Plataforma operacional ativa</div></div>
          <div className="relative mx-auto flex w-full max-w-[880px] flex-1 flex-col justify-center px-8 py-8 xl:px-12 2xl:px-16"><div className="max-w-3xl"><div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/12 bg-cyan-300/[0.08] px-4 py-2 text-xs font-black uppercase tracking-[0.17em] text-cyan-100"><SparkIcon />Um painel que acompanha sua empresa</div><h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.07em] xl:text-6xl 2xl:text-[4.7rem]">Sua operação inteira, pronta quando você entrar.</h1><p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/58 xl:text-lg xl:leading-8">Pedidos, clientes, catálogo, site, propostas e resultados reunidos em uma experiência construída para o seu segmento.</p></div><div className="mt-8"><ProductPreview segment={currentSegment} index={segmentIndex} onSelect={setSegmentIndex} /></div></div>
          <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-white/8 px-8 py-5 text-[11px] font-bold text-white/35 xl:px-12"><span>© 2026 Orçaly. Todos os direitos reservados.</span><div className="flex items-center gap-5"><a href="mailto:orcalybr@gmail.com" className="transition hover:text-white">Suporte</a><Link href="/" className="transition hover:text-white">Voltar ao site</Link></div></div>
        </aside>

        <section className="relative flex min-h-[100dvh] items-center overflow-hidden px-4 py-4 sm:px-6 sm:py-8 lg:px-9 xl:px-14">
          <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_center,rgba(5,36,92,.11)_1px,transparent_1px)] [background-size:26px_26px]" /><div className="absolute -right-48 -top-52 h-[500px] w-[500px] rounded-full bg-blue-200/45 blur-3xl" /><div className="absolute -bottom-60 -left-48 h-[520px] w-[520px] rounded-full bg-emerald-100/65 blur-3xl" /></div>
          <div className="orcaly-login-reveal-v3 relative mx-auto w-full max-w-[520px]">
            <header className="mb-5 flex items-center justify-between gap-4 lg:hidden"><Link href="/" aria-label="Voltar para a página inicial" className="inline-flex rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_12px_35px_rgba(6,26,54,.1)]"><Image src="/logo-orcaly.png" alt="Orçaly" width={170} height={50} priority className="h-10 w-auto object-contain" /></Link><a href="mailto:orcalybr@gmail.com" className="rounded-xl border border-white bg-white/80 px-3.5 py-2.5 text-xs font-black text-[#05245c] shadow-sm backdrop-blur">Precisa de ajuda?</a></header>
            <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-white bg-[#071a34] p-4 text-white shadow-xl shadow-blue-950/10 lg:hidden"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.17em] text-cyan-200/65">Seu painel está pronto</p><p className="mt-1.5 truncate text-lg font-black tracking-[-0.03em]">Entre e continue de onde parou.</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-cyan-100"><SparkIcon /></span></div><div className="mt-4 grid grid-cols-3 gap-2">{['Pedidos', 'Clientes', 'Resultados'].map((item) => <div key={item} className="rounded-xl border border-white/8 bg-white/[0.06] px-2 py-2.5 text-center text-[10px] font-black text-white/60">{item}</div>)}</div></div>
            <form onSubmit={entrar} className="relative overflow-hidden rounded-[2.1rem] border border-white bg-white p-5 shadow-[0_35px_100px_rgba(6,26,54,.16)] sm:p-8">
              <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-blue-100/80 blur-3xl" /><div className="pointer-events-none absolute -bottom-28 -left-24 h-56 w-56 rounded-full bg-emerald-100/70 blur-3xl" /><div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden bg-slate-100"><div className="orcaly-login-scan-v3 h-full w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-80" /></div>{carregando ? <div className="absolute inset-x-0 top-0 z-20 h-1 overflow-hidden bg-blue-100"><div className="orcaly-login-progress-v3 h-full w-1/3 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600" /></div> : null}
              <div className="relative"><div className="flex items-start justify-between gap-5"><div className="min-w-0"><div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#05245c]"><ShieldIcon />Acesso seguro</div><h2 className="mt-5 text-[2.1rem] font-black leading-none tracking-[-0.06em] text-[#071b3a] sm:text-[2.8rem]">Bem-vindo de volta.</h2><p className="mt-3 max-w-md text-sm font-semibold leading-6 text-slate-500 sm:text-base sm:leading-7">Acesse sua empresa e retome a operação em poucos segundos.</p></div><div className="hidden h-14 w-14 shrink-0 place-items-center rounded-[1.1rem] bg-[#061a36] text-cyan-100 shadow-xl shadow-blue-950/18 sm:grid"><LockIcon /></div></div>
                <div aria-live="polite" className={`mt-6 flex items-start gap-3 rounded-[1.2rem] border p-3.5 text-sm font-bold leading-5 ${messageClass}`}><span className="mt-0.5 shrink-0"><ShieldIcon /></span><span>{mensagem}</span></div>
                <div className="mt-6 grid gap-5">
                  <label className="grid gap-2"><span className="text-sm font-black text-slate-700">E-mail da conta</span><div className={`group flex min-h-14 items-center gap-3 rounded-[1.15rem] border bg-slate-50/90 px-4 transition duration-200 focus-within:-translate-y-0.5 focus-within:bg-white focus-within:shadow-lg focus-within:shadow-blue-950/5 focus-within:ring-4 ${emailValido ? 'border-slate-200 focus-within:border-[#05245c] focus-within:ring-blue-100' : 'border-red-200 focus-within:border-red-500 focus-within:ring-red-100'}`}><span className="shrink-0 text-slate-400 transition group-focus-within:text-[#05245c]"><MailIcon /></span><input value={email} onChange={(event) => handleEmailChange(event.target.value)} placeholder="voce@empresa.com" type="email" inputMode="email" autoCapitalize="none" autoComplete="email" disabled={carregando} aria-invalid={!emailValido} className="min-w-0 flex-1 bg-transparent py-4 font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" /></div>{!emailValido ? <span className="text-xs font-bold text-red-600">Digite um e-mail válido.</span> : null}</label>
                  <label className="grid gap-2"><span className="text-sm font-black text-slate-700">Senha</span><div className="group flex min-h-14 items-center gap-3 rounded-[1.15rem] border border-slate-200 bg-slate-50/90 px-4 transition duration-200 focus-within:-translate-y-0.5 focus-within:border-[#05245c] focus-within:bg-white focus-within:shadow-lg focus-within:shadow-blue-950/5 focus-within:ring-4 focus-within:ring-blue-100"><span className="shrink-0 text-slate-400 transition group-focus-within:text-[#05245c]"><LockIcon /></span><input value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Digite sua senha" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password" disabled={carregando} className="min-w-0 flex-1 bg-transparent py-4 font-semibold text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed" /><button type="button" onClick={() => setMostrarSenha((current) => !current)} disabled={carregando} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 transition hover:bg-blue-50 hover:text-[#05245c] disabled:cursor-not-allowed disabled:opacity-50"><EyeIcon hidden={mostrarSenha} /></button></div></label>
                  <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-slate-600"><input type="checkbox" checked={lembrarEmail} onChange={(event) => handleRememberChange(event.target.checked)} disabled={carregando} className="h-4 w-4 rounded border-slate-300 accent-[#05245c]" />Lembrar meu e-mail</label><button type="button" onClick={avisarRecuperacaoSenha} disabled={carregando} className="text-sm font-black text-[#05245c] transition hover:underline disabled:cursor-not-allowed disabled:opacity-50">Esqueci minha senha</button></div>
                  <button type="submit" disabled={carregando} className="group relative mt-1 flex min-h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-[1.15rem] bg-[#05245c] px-5 py-4 font-black text-white shadow-[0_16px_35px_rgba(5,36,92,.25)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#031a43] hover:shadow-[0_20px_45px_rgba(5,36,92,.32)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"><span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/20 to-transparent transition duration-700 group-hover:left-[120%]" /><span className="relative">{carregando ? 'Validando acesso...' : 'Entrar no painel'}</span>{!carregando ? <span className="relative transition group-hover:translate-x-1"><ArrowIcon /></span> : <span className="relative h-5 w-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />}</button>
                </div>
                <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200" /><span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Primeira vez por aqui?</span><div className="h-px flex-1 bg-slate-200" /></div>
                <div className="rounded-[1.4rem] border border-blue-100 bg-gradient-to-br from-[#f7faff] to-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="font-black tracking-[-0.02em] text-[#071b3a]">Crie sua empresa no Orçaly</p><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Configure seu segmento, página e painel em uma única experiência.</p></div><Link href="/cadastro" className="mt-4 inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-black text-[#05245c] shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 sm:mt-0 sm:w-auto">Criar conta<ArrowIcon /></Link></div>
                <div className="mt-5 grid grid-cols-2 gap-2.5">{trustFeatures.map((feature) => <div key={feature.title} className="rounded-[1.1rem] border border-slate-100 bg-slate-50/75 p-3"><div className="flex items-center gap-2 text-[#05245c]">{feature.icon}<p className="text-xs font-black">{feature.title}</p></div><p className="mt-1.5 text-[10px] font-semibold leading-4 text-slate-400">{feature.description}</p></div>)}</div>
              </div>
            </form>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-[11px] font-bold text-slate-400"><span>© 2026 Orçaly</span><span aria-hidden="true">•</span><a href="mailto:orcalybr@gmail.com" className="transition hover:text-[#05245c]">orcalybr@gmail.com</a><span aria-hidden="true">•</span><Link href="/" className="transition hover:text-[#05245c]">Voltar ao site</Link></div>
          </div>
        </section>
      </div>
    </main>
  )
}
