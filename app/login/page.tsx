'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault()
    setCarregando(true)
    setMensagem('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setMensagem(`Erro: ${error.message}`)
      setCarregando(false)
      return
    }

    router.push('/painel')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900 p-8">
        <p className="text-sm font-bold text-orange-400">
          Gráfica Flash
        </p>

        <h1 className="mt-2 text-3xl font-black">
          Acessar painel
        </h1>

        <p className="mt-2 text-neutral-400">
          Entre com o acesso da gráfica para ver os pedidos.
        </p>

        <form onSubmit={entrar} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block font-bold">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="mb-2 block font-bold">
              Senha
            </label>

            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none"
              placeholder="Sua senha"
            />
          </div>

          <button
            disabled={carregando}
            className="w-full rounded-xl bg-orange-400 px-6 py-3 font-black text-neutral-950 disabled:opacity-60"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>

          {mensagem && (
            <p className="text-center text-sm text-red-400">
              {mensagem}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}