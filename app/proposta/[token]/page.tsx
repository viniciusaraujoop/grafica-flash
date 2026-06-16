'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Proposta = {
  id: string
  token: string
  titulo: string | null
  cliente_nome: string | null
  cliente_whatsapp: string | null
  valor_total: number | null
  valor_sinal: number | null
  prazo: string | null
  condicoes: string | null
  status: string | null
  itens: Array<{ nome: string; quantidade?: number; valor?: number; respostas?: Record<string, string> }>
  payment_url: string | null
}

type Empresa = {
  nome: string
  logo_url: string | null
  whatsapp: string | null
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function limparTelefone(valor: string | null | undefined) {
  return (valor || '').replace(/\D/g, '')
}

function linkWhatsapp(numero: string | null | undefined, texto: string) {
  const limpo = limparTelefone(numero)
  if (!limpo) return ''
  const final = limpo.startsWith('55') ? limpo : `55${limpo}`
  return `https://wa.me/${final}?text=${encodeURIComponent(texto)}`
}

export default function PropostaPage() {
  const params = useParams<{ token: string }>()
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token

  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [mensagem, setMensagem] = useState('')

  async function carregar() {
    setCarregando(true)
    const res = await fetch(`/api/propostas/${token}`)
    const dados = await res.json()

    if (!res.ok) {
      setMensagem(dados.error || 'Proposta nao encontrada.')
      setCarregando(false)
      return
    }

    setProposta(dados.proposta)
    setEmpresa(dados.empresa)
    setCarregando(false)
  }

  useEffect(() => {
    if (token) carregar()
  }, [token])

  async function aprovar() {
    setMensagem('Registrando aprovacao...')

    const res = await fetch(`/api/propostas/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'aprovar' }),
    })

    const dados = await res.json()

    if (!res.ok) {
      setMensagem(dados.error || 'Erro ao aprovar proposta.')
      return
    }

    setMensagem('Proposta aprovada com sucesso.')
    carregar()
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl">Carregando proposta...</div>
      </main>
    )
  }

  if (!proposta || !empresa) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-4">
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <p className="text-3xl font-black text-[#071b3a]">Proposta nao encontrada</p>
          <p className="mt-3 font-bold text-slate-500">{mensagem}</p>
        </div>
      </main>
    )
  }

  const whats = linkWhatsapp(empresa.whatsapp, `Ola! Quero negociar a proposta ${proposta.titulo || proposta.token}.`)

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-5xl">
        <header className="rounded-[2rem] border border-blue-100 bg-white p-6 text-center shadow-xl shadow-blue-950/5">
          {empresa.logo_url && <img src={empresa.logo_url} alt={empresa.nome} className="mx-auto mb-4 h-20 w-20 rounded-3xl object-cover" />}
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Seu orcamento esta pronto</p>
          <h1 className="mt-3 text-4xl font-black text-[#071b3a]">{proposta.titulo || `Proposta de ${empresa.nome}`}</h1>
          <p className="mt-3 text-lg font-bold text-slate-500">{empresa.nome}</p>
        </header>

        {mensagem && <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center text-sm font-bold text-[#05245c]">{mensagem}</div>}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Itens</p>
            <div className="mt-5 grid gap-3">
              {proposta.itens?.map((item, index) => (
                <div key={`${item.nome}-${index}`} className="rounded-3xl border border-blue-50 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-black text-[#071b3a]">{item.nome}</p>
                      {item.quantidade && <p className="mt-1 text-sm font-bold text-slate-500">Quantidade: {item.quantidade}</p>}
                    </div>
                    {item.valor && <p className="font-black text-[#05245c]">{moeda(Number(item.valor))}</p>}
                  </div>

                  {item.respostas && Object.keys(item.respostas).length > 0 && (
                    <div className="mt-3 grid gap-1 text-xs font-bold text-slate-600">
                      {Object.entries(item.respostas).map(([chave, valor]) => (
                        <p key={chave}>{chave}: {valor}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-xl shadow-blue-950/5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-[#05245c]">Resumo</p>
            <p className="mt-4 text-sm font-bold text-slate-500">Valor total</p>
            <p className="text-4xl font-black text-[#071b3a]">{moeda(Number(proposta.valor_total || 0))}</p>

            {Number(proposta.valor_sinal || 0) > 0 && (
              <>
                <p className="mt-4 text-sm font-bold text-slate-500">Sinal</p>
                <p className="text-2xl font-black text-emerald-700">{moeda(Number(proposta.valor_sinal))}</p>
              </>
            )}

            {proposta.prazo && (
              <>
                <p className="mt-4 text-sm font-bold text-slate-500">Prazo</p>
                <p className="font-black text-[#071b3a]">{proposta.prazo}</p>
              </>
            )}

            {proposta.condicoes && (
              <>
                <p className="mt-4 text-sm font-bold text-slate-500">Condicoes</p>
                <p className="leading-7 text-slate-600">{proposta.condicoes}</p>
              </>
            )}

            <div className="mt-6 grid gap-3">
              <button onClick={aprovar} className="rounded-2xl bg-[#05245c] px-5 py-4 font-black text-white">Aprovar proposta</button>
              {proposta.payment_url ? (
                <a href={proposta.payment_url} className="rounded-2xl bg-emerald-600 px-5 py-4 text-center font-black text-white">Pagar sinal</a>
              ) : (
                <button disabled className="rounded-2xl bg-slate-100 px-5 py-4 font-black text-slate-400">Pagamento do sinal em breve</button>
              )}
              {whats && <a href={whats} target="_blank" rel="noreferrer" className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-center font-black text-[#05245c]">Negociar no WhatsApp</a>}
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
