import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import MfaChallenge from '@/components/security/MfaChallenge'
import { getMfaSecurityState } from '@/lib/security/mfa'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function safeNextPath(value: unknown) {
  const next = String(value || '').trim()
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('://')) return '/painel/inicio'
  if (next.startsWith('/login') || next.startsWith('/mfa')) return '/painel/inicio'
  return next
}

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const nextPath = safeNextPath(params.next)
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const mfa = await getMfaSecurityState(supabase)
  if (!mfa.hasVerifiedFactor || mfa.currentLevel === 'aal2') {
    redirect(nextPath)
  }

  const factor = mfa.verifiedFactors.find((item) => item.factorType === 'totp') || mfa.verifiedFactors[0]
  if (!factor) redirect(nextPath)

  return (
    <main className="min-h-screen bg-[#eef4fb] px-5 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_30px_90px_rgba(15,42,80,.12)] sm:p-9">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#082b62]">
              <Image src="/icone-orcaly.png" alt="Orçaly" width={36} height={36} className="h-9 w-9 object-contain" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Segurança da conta</p>
              <h1 className="text-xl font-black tracking-[-0.03em]">Confirme que é você</h1>
            </div>
          </div>

          <p className="mt-6 text-sm font-medium leading-6 text-slate-600">
            Esta conta usa verificação em duas etapas. Abra seu aplicativo autenticador e informe o código atual para concluir o login.
          </p>

          <MfaChallenge factorId={factor.id} nextPath={nextPath} />

          <div className="mt-6 border-t border-slate-100 pt-5 text-center">
            <Link href="/login" className="text-sm font-bold text-slate-500 transition hover:text-slate-900">
              Voltar ao login
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
