'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { modelosNegocio } from '@/lib/modelos-negocio'

type Empresa = {
  id: string
  nome: string
  segmento: string | null
  modelo_negocio: string | null
  modelo_nome: string | null
  modelo_perguntas: string[] | null
}

export default function OrcamentoInteligentePage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [perguntasTexto, setPerguntasTexto] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const { data: sessao } = await supabase.auth.getSession()
      const usuario = sessao.session?.user

      if (!usuario) {
        setErro('Você precisa estar logado.')
        setCarregando(false)
        return
      }

      const { data, error } = await supabase
        .from('companies')
        .select('id, nome, segmento, modelo_negocio, modelo_nome, modelo_perguntas')
        .or(`owner_id.eq.${usuario.id},tester_id.eq.${usuario.id}`)
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Empresa não encontrada.')

      const empresaAtual = data as Empresa
      setEmpresa(empresaAtual)

      const modeloPadrao = modelosNegocio.find((modelo) => modelo.id === empresaAtual.modelo_negocio)
      const perguntas = empresaAtual.modelo_perguntas?.length
        ? empresaAtual.modelo_perguntas
        : modeloPadrao?.perguntas || modelosNegocio[modelosNegocio.length - 1].perguntas

      setPerguntasTexto(perguntas.join('\n'))
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar orçamento inteligente.')
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!empresa) return

    const perguntas = perguntasTexto
      .split('\n')
      .map((linha) => linha.trim())
      .filter(Boolean)

    if (perguntas.length === 0) {
      alert('Informe pelo menos uma pergunta.')
      return
    }

    setSalvando(true)
    setMensagem('Salvando perguntas...')

    const nomeModelo = empresa.modelo_nome || empresa.segmento || 'Modelo personalizado'
    const tipoModelo = empresa.modelo_negocio || 'personalizado'

    const { error: empresaError } = await supabase
      .from('companies')
      .update({
        modelo_perguntas: perguntas,
      })
      .eq('id', empresa.id)

    if (empresaError) {
      setMensagem(`Erro: ${empresaError.message}`)
      setSalvando(false)
      return
    }

    const { error: modeloError } = await supabase.from('quote_templates').upsert(
      {
        company_id: empresa.id,
        nome: nomeModelo,
        tipo: tipoModelo,
        perguntas,
        ativo: true,
      },
      { onConflict: 'company_id,tipo' }
    )

    if (modeloError) {
      setMensagem(`Erro: ${modeloError.message}`)
      setSalvando(false)
      return
    }

    setMensagem('Perguntas atualizadas com sucesso.')
    setSalvando(false)
    carregar()
  }

  const modeloAtual = modelosNegocio.find((modelo) => modelo.id === empresa?.modelo_negocio)

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl">
        <Link href="/painel" className="text-sm font-black text-[#05245c]">
          ← Voltar ao painel
        </Link>

        <header className="mt-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
            Orçamento inteligente
          </p>

          <h1 className="mt-3 text-4xl font-black text-[#071b3a] sm:text-5xl">
            O fluxo já vem do tipo de negócio escolhido no cadastro.
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Aqui você ajusta as perguntas do modelo atual. A escolha do tipo de empresa fica no cadastro, para o sistema nascer adaptado desde o primeiro acesso.
          </p>
        </header>

        {erro && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        {carregando && (
          <div className="mt-6 rounded-[2rem] bg-white p-8 text-center font-black shadow-xl shadow-blue-950/5">
            Carregando...
          </div>
        )}

        {!carregando && empresa && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
            <aside className="grid h-fit gap-5">
              <div className="rounded-[2rem] border border-blue-100 bg-[#05245c] p-6 text-white shadow-2xl shadow-blue-950/20">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-100">
                  Modelo ativo
                </p>

                <h2 className="mt-3 text-4xl font-black">
                  {empresa.modelo_nome || empresa.segmento || 'Modelo personalizado'}
                </h2>

                <p className="mt-3 leading-7 text-blue-100">
                  {modeloAtual?.descricao || 'Modelo ajustável para o fluxo de pedidos da sua empresa.'}
                </p>
              </div>

              <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
                <h3 className="text-2xl font-black text-[#071b3a]">
                  Como funciona
                </h3>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-3xl bg-blue-50 p-4">
                    <p className="font-black text-[#071b3a]">1. Cliente escolhe o produto</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">A loja abre as perguntas certas.</p>
                  </div>

                  <div className="rounded-3xl bg-blue-50 p-4">
                    <p className="font-black text-[#071b3a]">2. Pedido chega organizado</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">Menos conversa perdida no WhatsApp.</p>
                  </div>

                  <div className="rounded-3xl bg-blue-50 p-4">
                    <p className="font-black text-[#071b3a]">3. Empresa gera proposta</p>
                    <p className="mt-1 text-sm font-bold text-slate-500">Com valor, prazo e link de aprovação.</p>
                  </div>
                </div>
              </div>
            </aside>

            <form onSubmit={salvar} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
                    Perguntas do pedido
                  </p>
                  <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
                    Ajuste o que o cliente precisa responder
                  </h2>
                </div>

                <button
                  disabled={salvando}
                  className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43] disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Salvar perguntas'}
                </button>
              </div>

              <p className="mt-4 leading-7 text-slate-600">
                Coloque uma pergunta por linha. Essas perguntas aparecem quando o cliente configura um produto na página pública.
              </p>

              <textarea
                value={perguntasTexto}
                onChange={(evento) => setPerguntasTexto(evento.target.value)}
                rows={14}
                className="mt-5 w-full resize-none rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5 font-semibold leading-8 outline-none transition focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#05245c]">
                  Prévia
                </p>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {perguntasTexto
                    .split('\n')
                    .map((linha) => linha.trim())
                    .filter(Boolean)
                    .slice(0, 10)
                    .map((pergunta) => (
                      <div key={pergunta} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600">
                        {pergunta}
                      </div>
                    ))}
                </div>
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  )
}
