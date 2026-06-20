'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type EmpresaAssinatura = {
  id: string
  assinatura_status: string | null
  assinatura_expira_em: string | null
}

function assinaturaEstaAtiva(empresa: EmpresaAssinatura | null) {
  if (!empresa) return false

  if (empresa.assinatura_status !== 'ativa') return false

  if (!empresa.assinatura_expira_em) return true

  const agora = new Date()
  const expiraEm = new Date(empresa.assinatura_expira_em)

  return expiraEm > agora
}

export default function PainelLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  const [liberado, setLiberado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    async function verificarAcesso() {
      setCarregando(true)
      setMensagem('')

      try {
        const { data: sessaoData, error: sessaoError } =
          await supabase.auth.getSession()

        if (sessaoError) {
          setMensagem(`Erro ao verificar login: ${sessaoError.message}`)
          setCarregando(false)
          return
        }

        const usuario = sessaoData.session?.user

        if (!usuario) {
          router.replace('/login')
          return
        }

        const { data: empresaData, error: empresaError } = await supabase
          .from('companies')
          .select('id, assinatura_status, assinatura_expira_em')
          .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
          .maybeSingle()

        if (empresaError) {
          setMensagem(`Erro ao verificar assinatura: ${empresaError.message}`)
          setCarregando(false)
          return
        }

        if (!empresaData) {
          router.replace('/assinatura')
          return
        }

        if (!assinaturaEstaAtiva(empresaData as EmpresaAssinatura)) {
          router.replace('/assinatura')
          return
        }

        setLiberado(true)
        setCarregando(false)
      } catch (erro) {
        const textoErro =
          erro instanceof Error
            ? erro.message
            : 'Erro desconhecido ao verificar assinatura.'

        setMensagem(`Erro: ${textoErro}`)
        setCarregando(false)
      }
    }

    verificarAcesso()
  }, [router])

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="rounded-[2rem] border border-blue-50 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="OrÃ§aly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <p className="font-bold text-slate-500">
            Verificando assinatura...
          </p>
        </div>
      </main>
    )
  }

  if (mensagem) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-lg rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img
            src="/logo-orcaly.png"
            alt="OrÃ§aly"
            className="mx-auto mb-6 h-14 w-auto object-contain"
          />

          <h1 className="text-3xl font-black text-[#071b3a]">
            NÃ£o foi possÃ­vel liberar o painel
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            {mensagem}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    )
  }

  if (!liberado) {
    return null
  }

  return children
}

