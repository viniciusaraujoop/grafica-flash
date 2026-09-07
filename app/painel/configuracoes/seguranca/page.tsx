import Link from 'next/link'
import MfaSettings from '@/components/security/MfaSettings'

export default function SegurancaPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Configurações</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-slate-950">Segurança</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">MFA, confirmação de identidade e proteção de ações sensíveis.</p>
        </div>
        <Link href="/painel/configuracoes" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
          Voltar às configurações
        </Link>
      </div>

      <MfaSettings />
    </div>
  )
}
