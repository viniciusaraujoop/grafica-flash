'use client'

import { FormEvent, Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function SuccessContent() {
  const params = useSearchParams()
  const leadId = params.get('lead_id') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState('')

  async function finalizar(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMensagem('Criando sua conta...')

    const response = await fetch('/api/leads/complete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, password, confirm_password: confirmPassword }),
    })

    const data = await response.json()

    if (!response.ok) {
      setMensagem(data.error || 'Erro ao criar conta.')
      setLoading(false)
      return
    }

    setMensagem('Conta criada. Redirecionando para o login...')
    window.location.href = '/login'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 text-[#061a36]" style={{ colorScheme: 'light' }}>
      <section className="w-full max-w-xl rounded-[2.5rem] border border-[#d7e3f3] bg-[#f8fbff] p-6 text-center shadow-2xl shadow-[#05245c]/10 sm:p-8">
        <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto h-12 w-auto object-contain" />

        <h1 className="mt-8 text-4xl font-black tracking-[-0.04em]">Pagamento recebido</h1>
        <p className="mt-3 font-semibold leading-7 text-[#607895]">
          Agora falta criar a senha da conta para acessar o painel e começar a montar o site da empresa.
        </p>

        {!leadId ? (
          <div className="mt-6 rounded-2xl bg-yellow-50 p-4 font-bold text-yellow-800">
            Não encontrei o cadastro vinculado ao pagamento. Entre em contato com o suporte do Orçaly.
          </div>
        ) : (
          <form onSubmit={finalizar} className="mt-6 grid gap-4 text-left">
            {mensagem && <div className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-[#05245c]">{mensagem}</div>}

            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Crie sua senha"
              className="rounded-2xl border border-[#d7e3f3] bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c]"
            />

            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="Confirme sua senha"
              className="rounded-2xl border border-[#d7e3f3] bg-white px-4 py-4 font-bold outline-none focus:border-[#05245c]"
            />

            <button disabled={loading} className="rounded-2xl bg-[#05245c] px-6 py-5 text-center font-black text-white disabled:opacity-60">
              {loading ? 'Criando conta...' : 'Criar conta e acessar'}
            </button>
          </form>
        )}

        <Link href="/login" className="mt-5 inline-flex font-black text-[#05245c]">
          Já tenho login
        </Link>
      </section>
    </main>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-white font-black">Carregando...</main>}>
      <SuccessContent />
    </Suspense>
  )
}
