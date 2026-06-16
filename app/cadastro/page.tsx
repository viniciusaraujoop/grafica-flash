'use client'

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { modelosNegocio } from '@/lib/modelos-negocio'
import { criarSlugSeguro, validarNomeEmpresa, validarSenhaForte, validarSlugEmpresa, validarTextoCurto } from '@/lib/security'

type Estado = {
  id: number
  sigla: string
  nome: string
}

type Cidade = {
  id: number
  nome: string
}

const planos = {
  basico: { nome: 'Essencial', valor: 49.9 },
  profissional: { nome: 'Profissional', valor: 99.9 },
  premium: { nome: 'Premium', valor: 149.9 },
}

function CadastroContent() {
  const searchParams = useSearchParams()
  const planoInicial = searchParams.get('plano') || 'profissional'

  const [plano, setPlano] = useState(planoInicial in planos ? planoInicial : 'profissional')
  const [modeloId, setModeloId] = useState('grafica')
  const [buscaModelo, setBuscaModelo] = useState('')
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')
  const [estados, setEstados] = useState<Estado[]>([])
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [estado, setEstado] = useState('')
  const [cidade, setCidade] = useState('')
  const [carregandoCidades, setCarregandoCidades] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const modeloSelecionado = modelosNegocio.find((item) => item.id === modeloId) || modelosNegocio[0]
  const planoSelecionado = planos[plano as keyof typeof planos]
  const slugPreview = criarSlugSeguro(nomeEmpresa || 'sua-empresa')

  const modelosFiltrados = useMemo(() => {
    const termo = buscaModelo.trim().toLowerCase()

    if (!termo) return modelosNegocio

    return modelosNegocio.filter((modelo) => {
      const texto = `${modelo.nome} ${modelo.subtitulo} ${modelo.descricao} ${modelo.exemplos.join(' ')}`.toLowerCase()
      return texto.includes(termo)
    })
  }, [buscaModelo])

  useEffect(() => {
    async function carregarEstados() {
      const resposta = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      const dados = await resposta.json()
      setEstados(dados)
    }

    carregarEstados()
  }, [])

  useEffect(() => {
    async function carregarCidades() {
      if (!estado) {
        setCidades([])
        setCidade('')
        return
      }

      setCarregandoCidades(true)
      setCidade('')

      const resposta = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios?orderBy=nome`)
      const dados = await resposta.json()

      setCidades(dados)
      setCarregandoCidades(false)
    }

    carregarCidades()
  }, [estado])

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    const nomeValidado = validarNomeEmpresa(nomeEmpresa)
    if (!nomeValidado.valido) {
      alert(nomeValidado.erros.join('\n'))
      return
    }

    const slugValidado = validarSlugEmpresa(nomeEmpresa)
    if (!slugValidado.valido) {
      alert(slugValidado.erros.join('\n'))
      return
    }

    const telefoneValidado = validarTextoCurto(telefone, 'WhatsApp', 40)
    if (!telefoneValidado.valido) {
      alert(telefoneValidado.erros.join('\n'))
      return
    }

    if (!email.trim() || !email.includes('@')) {
      alert('Informe um e-mail válido.')
      return
    }

    if (!validarSenhaForte(senha)) {
      alert('A senha precisa ter pelo menos 8 caracteres, uma letra maiúscula e um caractere especial.')
      return
    }

    if (!estado || !cidade) {
      alert('Escolha o estado e a cidade.')
      return
    }

    setEnviando(true)
    setMensagem('Criando sua empresa com validações de segurança...')

    const estadoNome = estados.find((item) => item.sigla === estado)?.nome || estado

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: {
          data: {
            nome_empresa: nomeEmpresa.trim(),
            modelo_negocio: modeloSelecionado.id,
          },
        },
      })

      if (authError) throw authError

      const userId = authData.user?.id

      if (!userId) {
        throw new Error('Usuário criado, mas o ID não foi retornado. Verifique a confirmação de e-mail no Supabase.')
      }

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({
          nome: nomeEmpresa.trim(),
          slug: slugValidado.slug,
          email: email.trim().toLowerCase(),
          whatsapp: telefoneValidado.texto,
          telefone: telefoneValidado.texto,
          cidade,
          estado: estadoNome,
          segmento: modeloSelecionado.nome,
          modelo_negocio: modeloSelecionado.id,
          modelo_nome: modeloSelecionado.nome,
          modelo_perguntas: modeloSelecionado.perguntas,
          plano,
          assinatura_plano: plano,
          assinatura_status: 'pendente',
          ativo: false,
          owner_id: userId,
          cor_principal: '#05245c',
        })
        .select('id')
        .single()

      if (companyError) throw companyError

      await supabase.from('quote_templates').upsert(
        {
          company_id: companyData.id,
          nome: modeloSelecionado.nome,
          tipo: modeloSelecionado.id,
          perguntas: modeloSelecionado.perguntas,
          ativo: true,
        },
        { onConflict: 'company_id,tipo' }
      )

      setMensagem('Empresa criada. Abrindo pagamento...')

      const checkout = await fetch('/api/checkout/plano', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: companyData.id,
          plano,
          email: email.trim().toLowerCase(),
          nomeEmpresa: nomeEmpresa.trim(),
        }),
      })

      const checkoutData = await checkout.json()

      if (!checkout.ok) {
        throw new Error(checkoutData.error || 'Erro ao criar checkout.')
      }

      const url = checkoutData.init_point || checkoutData.checkout_url || checkoutData.url

      if (url) {
        window.location.href = url
        return
      }

      window.location.href = '/assinatura'
    } catch (error) {
      const texto = error instanceof Error ? error.message : 'Erro desconhecido no cadastro.'
      setMensagem(`Erro: ${texto}`)
    }

    setEnviando(false)
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
          <img src="/logo-orcaly.png" alt="Orçaly" className="h-12 w-auto object-contain" />

          <p className="mt-8 text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">
            Cadastro seguro
          </p>

          <h1 className="mt-3 text-4xl font-black text-[#071b3a] sm:text-5xl">
            Escolha o tipo de negócio e proteja sua identidade pública.
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Bloqueamos nomes reservados, endereços indevidos e entradas suspeitas para evitar confusão com áreas internas do sistema.
          </p>

          <form onSubmit={cadastrar} className="mt-8 grid gap-5">
            <div>
              <label className="text-sm font-black text-slate-700">Tipo de empresa</label>

              <input
                value={buscaModelo}
                onChange={(evento) => setBuscaModelo(evento.target.value)}
                placeholder="Procure por gráfica, alimentação, assistência, eventos..."
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />

              <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                {modelosFiltrados.map((modelo) => {
                  const ativo = modelo.id === modeloId

                  return (
                    <button
                      key={modelo.id}
                      type="button"
                      onClick={() => setModeloId(modelo.id)}
                      className={`rounded-3xl border p-4 text-left transition hover:-translate-y-1 ${
                        ativo
                          ? 'border-[#05245c] bg-[#05245c] text-white shadow-xl shadow-blue-950/20'
                          : 'border-blue-100 bg-blue-50 text-slate-800 hover:bg-white'
                      }`}
                    >
                      <p className={`text-lg font-black ${ativo ? 'text-white' : 'text-[#071b3a]'}`}>
                        {modelo.nome}
                      </p>
                      <p className={`mt-1 text-sm font-bold ${ativo ? 'text-blue-100' : 'text-slate-500'}`}>
                        {modelo.subtitulo}
                      </p>
                      <p className={`mt-3 text-xs font-bold leading-5 ${ativo ? 'text-blue-50' : 'text-slate-500'}`}>
                        {modelo.exemplos.join(' • ')}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <input value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} placeholder="Nome da empresa" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="WhatsApp da empresa" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail de acesso" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha forte" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100" />
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100">
                <option value="">Estado</option>
                {estados.map((item) => (
                  <option key={item.id} value={item.sigla}>{item.nome}</option>
                ))}
              </select>
              <select value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={!estado || carregandoCidades} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 font-semibold outline-none focus:border-[#05245c] focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60">
                <option value="">{carregandoCidades ? 'Carregando cidades...' : 'Cidade'}</option>
                {cidades.map((item) => (
                  <option key={item.id} value={item.nome}>{item.nome}</option>
                ))}
              </select>
            </div>

            <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-black text-[#05245c]">Endereço público previsto</p>
              <p className="mt-1 break-all text-lg font-black text-[#071b3a]">{slugPreview}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">
                Nomes como admin, orcaly, api, login, checkout e painel são bloqueados.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(planos).map(([id, item]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPlano(id)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    plano === id ? 'border-[#05245c] bg-[#05245c] text-white' : 'border-blue-100 bg-blue-50 text-slate-800'
                  }`}
                >
                  <p className="font-black">{item.nome}</p>
                  <p className="mt-1 text-sm font-bold">R$ {item.valor.toFixed(2).replace('.', ',')}/mês</p>
                </button>
              ))}
            </div>

            {mensagem && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-[#05245c]">
                {mensagem}
              </div>
            )}

            <button disabled={enviando} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white shadow-lg shadow-blue-950/15 transition hover:bg-[#031a43] disabled:opacity-60">
              {enviando ? 'Criando cadastro...' : `Continuar com o plano ${planoSelecionado.nome}`}
            </button>
          </form>
        </div>

        <aside className="grid h-fit gap-5">
          <div className="rounded-[2rem] border border-blue-100 bg-[#05245c] p-6 text-white shadow-2xl shadow-blue-950/20">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-100">
              Modelo escolhido
            </p>
            <h2 className="mt-3 text-4xl font-black">{modeloSelecionado.nome}</h2>
            <p className="mt-3 leading-7 text-blue-100">{modeloSelecionado.descricao}</p>

            <div className="mt-6 grid gap-2">
              {modeloSelecionado.perguntas.slice(0, 7).map((pergunta) => (
                <div key={pergunta} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white">
                  {pergunta}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <h3 className="text-2xl font-black text-[#071b3a]">
              Proteções aplicadas
            </h3>
            <div className="mt-4 grid gap-3">
              <p className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-slate-600">Bloqueio de nomes reservados.</p>
              <p className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-slate-600">Validação de senha forte.</p>
              <p className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-slate-600">Slug público seguro.</p>
              <p className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-slate-600">Modelo de negócio salvo no cadastro.</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}

export default function CadastroPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f8ff] p-8 text-center font-black">Carregando cadastro...</main>}>
      <CadastroContent />
    </Suspense>
  )
}
