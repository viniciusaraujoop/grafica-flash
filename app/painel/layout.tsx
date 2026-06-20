'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type EmpresaAssinatura = {
  id: string
  assinatura_status: string | null
  assinatura_expira_em: string | null
  ativo?: boolean | null
}

const ADMIN_EMAIL = 'araujovinicius249@gmail.com'

function assinaturaEstaAtiva(empresa: EmpresaAssinatura | null) {
  if (!empresa) return false

  if (empresa.ativo === false) return false
  if (empresa.assinatura_status !== 'ativa') return false
  if (!empresa.assinatura_expira_em) return true

  const agora = new Date()
  const expiraEm = new Date(empresa.assinatura_expira_em)

  return expiraEm > agora
}

async function carregarEmpresaDoUsuario(usuario: any) {
  const email = String(usuario?.email || '').toLowerCase()

  const { data: empresaDono, error: donoError } = await supabase
    .from('companies')
    .select('id, ativo, assinatura_status, assinatura_expira_em')
    .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
    .maybeSingle()

  if (donoError) throw donoError
  if (empresaDono?.id) return empresaDono as EmpresaAssinatura

  const { data: membro, error: membroError } = await supabase
    .from('company_members')
    .select('company_id,status')
    .eq('user_id', usuario.id)
    .eq('status', 'ativo')
    .maybeSingle()

  if (membroError) throw membroError

  if (membro?.company_id) {
    const { data: empresaMembro, error: empresaMembroError } = await supabase
      .from('companies')
      .select('id, ativo, assinatura_status, assinatura_expira_em')
      .eq('id', membro.company_id)
      .maybeSingle()

    if (empresaMembroError) throw empresaMembroError
    if (empresaMembro?.id) return empresaMembro as EmpresaAssinatura
  }

  if (email === ADMIN_EMAIL) {
    const { data: empresaAdmin, error: empresaAdminError } = await supabase
      .from('companies')
      .select('id, ativo, assinatura_status, assinatura_expira_em')
      .eq('slug', 'grafica-flash')
      .maybeSingle()

    if (empresaAdminError) throw empresaAdminError
    if (empresaAdmin?.id) return empresaAdmin as EmpresaAssinatura
  }

  return null
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
        const { data: sessaoData, error: sessaoError } = await supabase.auth.getSession()

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

        const empresa = await carregarEmpresaDoUsuario(usuario)

        if (!empresa) {
          router.replace('/assinatura')
          return
        }

        if (!assinaturaEstaAtiva(empresa)) {
          router.replace('/assinatura')
          return
        }

        setLiberado(true)
        setCarregando(false)
      } catch (erro) {
        const textoErro = erro instanceof Error ? erro.message : 'Erro desconhecido ao verificar assinatura.'

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
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto mb-6 h-14 w-auto object-contain" />
          <p className="font-bold text-slate-500">Verificando assinatura...</p>
        </div>
      </main>
    )
  }

  if (mensagem) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-lg rounded-[2rem] border border-red-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5">
          <img src="/logo-orcaly.png" alt="Orçaly" className="mx-auto mb-6 h-14 w-auto object-contain" />

          <h1 className="text-3xl font-black text-[#071b3a]">Não foi possível liberar o painel</h1>

          <p className="mt-3 leading-7 text-slate-600">{mensagem}</p>

          <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-2xl bg-[#05245c] px-6 py-4 font-black text-white">
            Tentar novamente
          </button>
        </div>
      </main>
    )
  }

  if (!liberado) return null

  return children
}
