'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function MfaChallenge({
  factorId,
  nextPath,
}: {
  factorId: string
  nextPath: string
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = code.replace(/\D/g, '').slice(0, 6)
    if (normalized.length !== 6) {
      setError('Digite o código de 6 dígitos do seu autenticador.')
      return
    }

    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: normalized,
    })

    if (verifyError) {
      setBusy(false)
      setError('Código inválido ou expirado. Gere um novo código e tente novamente.')
      return
    }

    router.replace(nextPath)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-4">
      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Código do autenticador
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          aria-describedby={error ? 'mfa-error' : undefined}
          className="h-13 rounded-2xl border border-slate-200 bg-white px-4 text-center text-xl font-black tracking-[0.35em] text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          placeholder="000000"
        />
      </label>

      {error ? (
        <p id="mfa-error" role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="h-12 rounded-2xl bg-[#082b62] px-5 text-sm font-black text-white transition hover:bg-[#0a397f] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Verificando…' : 'Confirmar e entrar'}
      </button>
    </form>
  )
}
