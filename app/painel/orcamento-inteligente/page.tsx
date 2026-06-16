'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Empresa = {
  id: string
  nome: string
}

type Modelo = {
  id: string
  nome: string
  tipo: string
  perguntas: string[]
  ativo: boolean
}

const modelosBase = [
  {
    nome: 'Gr&aacute;fica',
    tipo: 'produto',
    descricao: 'Ideal para banners, cart&otilde;es, adesivos, impressos e materiais personalizados.',
    perguntas: [
      'Produto',
      'Quantidade',
      'Material',
      'Tamanho',
      'Acabamento',
      'Prazo desejado',
      'Arte pronta?',
    ],
  },
  {
    nome: 'Servi&ccedil;os',
    tipo: 'servico',
    descricao: 'Ideal para profissionais que trabalham com agenda, atendimento e execu&ccedil;&atilde;o.',
    perguntas: [
      'Servi&ccedil;o desejado',
      'Profissional',
      'Data',
      'Hor&aacute;rio',
      'Endere&ccedil;o ou local',
      'Observa&ccedil;&atilde;o',
    ],
  },
  {
    nome: 'Assist&ecirc;ncia t&eacute;cnica',
    tipo: 'assistencia',
    descricao: 'Ideal para celulares, computadores, eletros, manuten&ccedil;&atilde;o e reparos.',
    perguntas: [
      'Tipo de aparelho',
      'Marca e modelo',
      'Defeito apresentado',
      'Fotos do problema',
      'Urg&ecirc;ncia',
      'Observa&ccedil;&atilde;o',
    ],
  },
]

export default function OrcamentoInteligentePage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const { data: sessaoData } = await supabase.auth.getSession()
      const usuario = sessaoData.session?.user

      if (!usuario) {
        setErro('Voc&ecirc; precisa estar logado.')
        setCarregando(false)
        return
      }

      const { data: empresaData, error: empresaError } = await supabase
        .from('companies')
        .select('id, nome')
        .eq('owner_id', usuario.id)
        .maybeSingle()

      if (empresaError) throw empresaError

      if (!empresaData) {
        setErro('Empresa n&atilde;o encontrada.')
        setCarregando(false)
        return
      }

      const empresaAtual = empresaData as Empresa
      setEmpresa(empresaAtual)

      const { data: modelosData, error: modelosError } = await supabase
        .from('quote_templates')
        .select('id, nome, tipo, perguntas, ativo')
        .eq('company_id', empresaAtual.id)
        .order('created_at', { ascending: false })

      if (modelosError) throw modelosError

      setModelos((modelosData || []) as Modelo[])
    } catch (error) {
      const texto = error instanceof Error ? error.message : 'Erro ao carregar modelos.'
      setErro(texto)
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function ativarModelo(modelo: (typeof modelosBase)[number]) {
    if (!empresa) return

    setMensagem(`Salvando modelo ${modelo.nome.replace(/<[^>]+>/g, '')}...`)

    const { error } = await supabase.from('quote_templates').upsert(
      {
        company_id: empresa.id,
        nome: modelo.nome,
        tipo: modelo.tipo,
        perguntas: modelo.perguntas,
        ativo: true,
      },
      {
        onConflict: 'company_id,nome',
      }
    )

    if (error) {
      setMensagem(`Erro: ${error.message}`)
      return
    }

    setMensagem('Modelo salvo com sucesso.')
    carregar()
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] text-slate-950">
      <section className="mx-auto max-w-7xl px-4 py-6">
        <Link href="/painel" className="text-sm font-black text-[#05245c]">
          ← Voltar ao painel
        </Link>

        <header className="mt-5 overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
            Or&ccedil;amento inteligente
          </p>

          <h1 className="mt-3 text-4xl font-black text-[#071b3a] sm:text-5xl">
            Perguntas certas para cada tipo de neg&oacute;cio
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Cada categoria pode ter perguntas pr&oacute;prias. Assim o cliente envia informa&ccedil;&otilde;es melhores
            e a empresa ganha tempo para montar uma proposta profissional.
          </p>
        </header>

        {mensagem && (
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
            {mensagem}
          </div>
        )}

        {erro && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            {erro}
          </div>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-3">
          {modelosBase.map((modelo) => (
            <article key={modelo.tipo} className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-950/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#05245c]">
                    Modelo
                  </p>
                  <h2
                    className="mt-2 text-3xl font-black text-[#071b3a]"
                    dangerouslySetInnerHTML={{ __html: modelo.nome }}
                  />
                </div>

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                  🧠
                </div>
              </div>

              <p
                className="mt-3 leading-7 text-slate-600"
                dangerouslySetInnerHTML={{ __html: modelo.descricao }}
              />

              <div className="mt-5 grid gap-2">
                {modelo.perguntas.map((pergunta) => (
                  <div key={pergunta} className="rounded-2xl border border-blue-50 bg-blue-50 px-4 py-3 text-sm font-black text-[#05245c]">
                    <span dangerouslySetInnerHTML={{ __html: pergunta }} />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => ativarModelo(modelo)}
                className="mt-6 w-full rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white transition hover:bg-[#031a43]"
              >
                Ativar este modelo
              </button>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
            Modelos ativos
          </p>

          {carregando && (
            <p className="mt-4 font-bold text-slate-500">
              Carregando...
            </p>
          )}

          {!carregando && modelos.length === 0 && (
            <p className="mt-4 font-bold text-slate-500">
              Nenhum modelo ativo ainda. Ative um dos modelos acima.
            </p>
          )}

          {!carregando && modelos.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {modelos.map((modelo) => (
                <div key={modelo.id} className="rounded-3xl border border-blue-100 bg-blue-50 p-5">
                  <p className="text-2xl font-black text-[#071b3a]" dangerouslySetInnerHTML={{ __html: modelo.nome }} />
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    {modelo.perguntas.length} perguntas configuradas
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700">
            Pr&oacute;xima etapa
          </p>
          <h2 className="mt-2 text-3xl font-black text-[#071b3a]">
            Link de aprova&ccedil;&atilde;o da proposta
          </h2>
          <p className="mt-3 max-w-4xl leading-7 text-slate-600">
            A proposta pode ser enviada ao cliente pelo WhatsApp com um link como
            <strong> /proposta/abc123</strong>. Nessa p&aacute;gina ele v&ecirc; itens, valor,
            prazo, condi&ccedil;&otilde;es e pode aprovar, pagar sinal ou negociar.
          </p>
        </section>
      </section>
    </main>
  )
}
