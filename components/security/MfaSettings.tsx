'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Factor = {
  id: string
  friendlyName: string
  type: string
}

type PendingEnrollment = {
  id: string
  qrCode: string
  secret: string
}

type MfaSnapshot = {
  factors: Factor[]
  currentLevel: string
}

async function loadMfaState(): Promise<MfaSnapshot> {
  const [{ data: factorData, error: factorError }, { data: aalData, error: aalError }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])

  if (factorError) throw factorError
  if (aalError) throw aalError

  const verified = [
    ...(factorData?.totp || []),
    ...(factorData?.phone || []),
  ].filter((factor) => factor.status === 'verified')

  return {
    factors: verified.map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name || 'Autenticador',
      type: factor.factor_type,
    })),
    currentLevel: aalData?.currentLevel || 'aal1',
  }
}

export default function MfaSettings() {
  const [factors, setFactors] = useState<Factor[]>([])
  const [currentLevel, setCurrentLevel] = useState<string>('aal1')
  const [pending, setPending] = useState<PendingEnrollment | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [stepUpCode, setStepUpCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const snapshot = await loadMfaState()
    setFactors(snapshot.factors)
    setCurrentLevel(snapshot.currentLevel)
  }

  useEffect(() => {
    let active = true

    void loadMfaState()
      .then((snapshot) => {
        if (!active) return
        setFactors(snapshot.factors)
        setCurrentLevel(snapshot.currentLevel)
      })
      .catch(() => {
        if (!active) return
        setError('Não foi possível carregar o estado da verificação em duas etapas.')
      })

    return () => {
      active = false
    }
  }, [])

  async function startEnrollment() {
    setBusy(true)
    setError('')
    setMessage('')

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Orçaly ${factors.length + 1}`,
    })

    setBusy(false)
    if (enrollError || !data?.id || !data.totp) {
      setError('Não foi possível iniciar a configuração do autenticador.')
      return
    }

    setPending({
      id: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    })
    setVerifyCode('')
  }

  async function confirmEnrollment() {
    if (!pending) return
    const code = verifyCode.replace(/\D/g, '').slice(0, 6)
    if (code.length !== 6) {
      setError('Digite o código de 6 dígitos gerado pelo autenticador.')
      return
    }

    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.id, code })
    setBusy(false)

    if (verifyError) {
      setError('Código inválido ou expirado. Gere um novo código e tente novamente.')
      return
    }

    setPending(null)
    setVerifyCode('')
    setMessage('Verificação em duas etapas ativada com sucesso.')
    await refresh()
  }

  async function confirmStepUp() {
    const factor = factors.find((item) => item.type === 'totp') || factors[0]
    const code = stepUpCode.replace(/\D/g, '').slice(0, 6)
    if (!factor || code.length !== 6) {
      setError('Digite o código atual do seu autenticador.')
      return
    }

    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    setBusy(false)

    if (verifyError) {
      setError('Não foi possível confirmar sua identidade com esse código.')
      return
    }

    setStepUpCode('')
    setMessage('Identidade confirmada. Ações sensíveis estão liberadas nesta sessão.')
    await refresh()
  }

  async function removeFactor(factorId: string) {
    if (currentLevel !== 'aal2') {
      setError('Confirme sua identidade com um código antes de remover um autenticador.')
      return
    }

    setBusy(true)
    setError('')
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)

    if (removeError) {
      setError('Não foi possível remover este autenticador.')
      return
    }

    setMessage('Autenticador removido.')
    await supabase.auth.refreshSession()
    await refresh()
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Conta e acesso</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Verificação em duas etapas</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Proteja sua conta com um código TOTP do seu aplicativo autenticador. Quando ativado, o Orçaly exige esse código após a senha e antes de ações sensíveis.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-xs font-black ${factors.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {factors.length ? 'MFA ativo' : 'MFA desativado'}
          </span>
        </div>

        {message ? <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        <div className="mt-6 grid gap-3">
          {factors.map((factor) => (
            <div key={factor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="font-black text-slate-900">{factor.friendlyName}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{factor.type}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeFactor(factor.id)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        {!pending ? (
          <button
            type="button"
            onClick={startEnrollment}
            disabled={busy}
            className="mt-6 rounded-2xl bg-[#082b62] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0a397f] disabled:opacity-50"
          >
            {factors.length ? 'Adicionar outro autenticador' : 'Ativar MFA'}
          </button>
        ) : (
          <div className="mt-6 grid gap-5 rounded-[1.5rem] border border-blue-100 bg-blue-50/60 p-5">
            <div>
              <h3 className="font-black text-slate-950">Escaneie o QR Code</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Abra seu aplicativo autenticador, escaneie o código e depois confirme com os 6 dígitos gerados.</p>
            </div>
            <Image
              src={pending.qrCode}
              alt="QR Code para configurar o autenticador"
              width={176}
              height={176}
              unoptimized
              className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2"
            />
            <details className="text-sm text-slate-600">
              <summary className="cursor-pointer font-bold text-slate-800">Não consigo escanear o QR Code</summary>
              <p className="mt-2 break-all rounded-xl bg-white p-3 font-mono text-xs">{pending.secret}</p>
            </details>
            <div className="flex flex-wrap gap-3">
              <input
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Código TOTP para confirmar ativação"
                className="h-12 min-w-40 rounded-xl border border-slate-200 bg-white px-4 text-center font-black tracking-[0.28em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <button type="button" onClick={confirmEnrollment} disabled={busy || verifyCode.length !== 6} className="rounded-xl bg-[#082b62] px-5 py-3 text-sm font-black text-white disabled:opacity-50">
                Confirmar ativação
              </button>
            </div>
          </div>
        )}
      </section>

      {factors.length > 0 && currentLevel !== 'aal2' ? (
        <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6">
          <h3 className="text-lg font-black text-slate-950">Confirmar identidade nesta sessão</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Ações como alterar Pix, assinatura, permissões elevadas ou exportar todos os dados exigem uma sessão AAL2.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <input
              value={stepUpCode}
              onChange={(event) => setStepUpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Código TOTP para confirmar identidade"
              className="h-12 w-40 rounded-xl border border-amber-200 bg-white px-4 text-center font-black tracking-[0.28em] outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            />
            <button type="button" onClick={confirmStepUp} disabled={busy || stepUpCode.length !== 6} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">
              Confirmar identidade
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">Recuperação da conta</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
          Códigos de recuperação não estão disponíveis neste fluxo. Para reduzir o risco de perder acesso, mantenha um segundo autenticador verificado em outro dispositivo seguro. Nunca salve o segredo TOTP em chats ou notas públicas.
        </p>
      </section>
    </div>
  )
}
