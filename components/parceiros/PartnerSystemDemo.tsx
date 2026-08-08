"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type DemoTab = "overview" | "orders" | "products" | "clients" | "finance";

const nav: Array<{ id: DemoTab; label: string; icon: string }> = [
  { id: "overview", label: "VisÃ£o geral", icon: "âŒ‚" },
  { id: "orders", label: "Pedidos", icon: "â–¤" },
  { id: "products", label: "Produtos", icon: "â–¡" },
  { id: "clients", label: "Clientes", icon: "â—Ž" },
  { id: "finance", label: "Financeiro", icon: "$" },
];

const orders = [
  { id: "#1048", customer: "Marina C.", value: "R$ 189,90", status: "Recebido", when: "hÃ¡ 4 min" },
  { id: "#1047", customer: "JoÃ£o R.", value: "R$ 74,50", status: "Em produÃ§Ã£o", when: "hÃ¡ 18 min" },
  { id: "#1046", customer: "Amanda S.", value: "R$ 248,00", status: "Pronto", when: "hÃ¡ 42 min" },
  { id: "#1045", customer: "Carlos M.", value: "R$ 119,90", status: "Entregue", when: "hÃ¡ 1 h" },
];

const products = [
  { name: "Kit promocional", category: "Mais vendido", price: "R$ 89,90", stock: "24 un." },
  { name: "Produto personalizado", category: "Sob encomenda", price: "R$ 149,90", stock: "ProduÃ§Ã£o" },
  { name: "Pacote empresarial", category: "ServiÃ§o", price: "R$ 299,00", stock: "DisponÃ­vel" },
  { name: "Item rÃ¡pido", category: "CatÃ¡logo", price: "R$ 39,90", stock: "61 un." },
];

const clients = [
  { name: "Marina Costa", detail: "5 pedidos", value: "R$ 684,20", tag: "Recorrente" },
  { name: "JoÃ£o Rocha", detail: "2 pedidos", value: "R$ 218,40", tag: "Ativo" },
  { name: "Amanda Silva", detail: "8 pedidos", value: "R$ 1.492,70", tag: "VIP" },
  { name: "Carlos Melo", detail: "1 pedido", value: "R$ 119,90", tag: "Novo" },
];

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1.35rem] border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#071b3a]">
        {value}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-400">{detail}</p>
    </article>
  );
}

export default function PartnerSystemDemo() {
  const [tab, setTab] = useState<DemoTab>("overview");

  return (
    <main className="min-h-screen bg-[#eef3f8] text-[#071b3a]">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs font-black text-amber-800">
        AMBIENTE DE DEMONSTRAÃ‡ÃƒO Â· DADOS FICTÃCIOS Â· NENHUMA ALTERAÃ‡ÃƒO Ã‰ SALVA
      </div>

      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1550px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/parceiros">
            <Image
              src="/logo-orcaly.png"
              alt="OrÃ§aly"
              width={170}
              height={50}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-violet-50 px-4 py-2 text-xs font-black text-violet-700 sm:inline-flex">
              Demo comercial
            </span>
            <Link
              href="/parceiros/painel"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600"
            >
              Voltar ao portal
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1550px] gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[245px_1fr]">
        <aside className="h-fit rounded-[1.8rem] bg-[#071b3a] p-3 text-white lg:sticky lg:top-24">
          <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.07] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/60">
              Empresa demonstrativa
            </p>
            <p className="mt-2 text-lg font-black">Studio Aurora</p>
            <p className="mt-1 text-xs font-bold text-white/40">
              Dados criados apenas para apresentaÃ§Ã£o
            </p>
          </div>

          <nav className="mt-3 grid gap-1">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                  tab === item.id
                    ? "bg-white text-[#05245c]"
                    : "text-white/65 hover:bg-white/8"
                }`}
              >
                <span
                  className={`grid h-8 w-8 place-items-center rounded-xl text-xs ${
                    tab === item.id ? "bg-blue-50" : "bg-white/8"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-4 rounded-[1.2rem] border border-emerald-300/15 bg-emerald-300/8 p-4">
            <p className="text-xs font-black text-emerald-100">
              Seguro para apresentar
            </p>
            <p className="mt-1 text-[11px] font-bold leading-5 text-white/40">
              BotÃµes e dados desta tela nÃ£o atingem banco, pagamentos ou empresas reais.
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          {tab === "overview" ? (
            <div className="space-y-5">
              <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071b3a] via-[#082955] to-[#0e4c84] p-6 text-white shadow-xl sm:p-8">
                <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
                <div className="relative">
                  <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
                    VisÃ£o operacional
                  </p>
                  <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.055em] sm:text-4xl">
                    Bom dia. Sua empresa estÃ¡ em movimento.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/55">
                    A ideia do OrÃ§aly Ã© reunir as informaÃ§Ãµes que o empreendedor normalmente espalha entre planilhas, mensagens e ferramentas diferentes.
                  </p>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Pedidos hoje" value="18" detail="+4 desde ontem" />
                <Metric label="Faturamento do dia" value="R$ 2.846" detail="dados ilustrativos" />
                <Metric label="Clientes ativos" value="327" detail="base organizada" />
                <Metric label="PendÃªncias" value="6" detail="itens para acompanhar" />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
                <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                        Pedidos recentes
                      </p>
                      <h2 className="mt-1 text-xl font-black">O que entrou agora</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("orders")}
                      className="text-xs font-black text-[#05245c]"
                    >
                      Ver pedidos
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {orders.slice(0, 3).map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-[#f8faff] p-4"
                      >
                        <div>
                          <p className="font-black">
                            {order.id} Â· {order.customer}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {order.when} Â· {order.status}
                          </p>
                        </div>
                        <p className="font-black text-[#05245c]">{order.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Fluxo da operaÃ§Ã£o
                  </p>
                  <h2 className="mt-1 text-xl font-black">Do pedido ao acompanhamento</h2>

                  <div className="mt-5 grid gap-3">
                    {[
                      ["01", "Pedido recebido", "Cliente entra no fluxo organizado."],
                      ["02", "Equipe acompanha", "Status e informaÃ§Ãµes ficam centralizados."],
                      ["03", "Cliente Ã© registrado", "HistÃ³rico ajuda em novas vendas e atendimento."],
                      ["04", "GestÃ£o enxerga", "Indicadores resumem a operaÃ§Ã£o."],
                    ].map(([number, title, detail]) => (
                      <div
                        key={number}
                        className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#05245c] text-[10px] font-black text-white">
                          {number}
                        </span>
                        <div>
                          <p className="text-sm font-black">{title}</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                            {detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {tab === "orders" ? (
            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                Pedidos
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                Acompanhe cada etapa sem procurar conversa antiga.
              </h1>

              <div className="mt-6 overflow-x-auto">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-[110px_1fr_150px_150px_110px] gap-3 border-b border-slate-100 px-4 pb-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <span>Pedido</span>
                    <span>Cliente</span>
                    <span>Valor</span>
                    <span>Status</span>
                    <span>Entrada</span>
                  </div>
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="grid grid-cols-[110px_1fr_150px_150px_110px] gap-3 border-b border-slate-100 px-4 py-4 text-sm font-bold"
                    >
                      <span className="font-black text-[#05245c]">{order.id}</span>
                      <span>{order.customer}</span>
                      <span>{order.value}</span>
                      <span>
                        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-[#05245c]">
                          {order.status}
                        </span>
                      </span>
                      <span className="text-slate-400">{order.when}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                DemonstraÃ§Ã£o: clicar, editar ou mudar status aqui nÃ£o produz nenhuma alteraÃ§Ã£o real.
              </div>
            </section>
          ) : null}

          {tab === "products" ? (
            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                CatÃ¡logo e produtos
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                Produtos organizados para vender e operar.
              </h1>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {products.map((product, index) => (
                  <article
                    key={product.name}
                    className="overflow-hidden rounded-[1.45rem] border border-slate-100 bg-[#fbfcfe]"
                  >
                    <div className="grid h-36 place-items-center bg-gradient-to-br from-blue-50 via-violet-50 to-cyan-50">
                      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-2xl font-black text-[#05245c] shadow-sm">
                        {index + 1}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
                        {product.category}
                      </p>
                      <h2 className="mt-1 font-black">{product.name}</h2>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="font-black text-[#05245c]">{product.price}</span>
                        <span className="text-xs font-bold text-slate-400">{product.stock}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "clients" ? (
            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                Clientes
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                HistÃ³rico para atender melhor e vender novamente.
              </h1>

              <div className="mt-6 grid gap-3">
                {clients.map((client) => (
                  <article
                    key={client.name}
                    className="flex flex-col gap-4 rounded-[1.4rem] border border-slate-100 bg-[#fbfcfe] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#071b3a] text-sm font-black text-white">
                        {client.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                      <div>
                        <p className="font-black">{client.name}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {client.detail} Â· {client.tag}
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-black text-[#05245c]">{client.value}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "finance" ? (
            <div className="space-y-5">
              <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                  Financeiro
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">
                  Uma visÃ£o simples do que entrou, saiu e estÃ¡ previsto.
                </h1>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Entradas do mÃªs" value="R$ 24,8 mil" detail="dados fictÃ­cios" />
                  <Metric label="SaÃ­das" value="R$ 9,4 mil" detail="custos demonstrativos" />
                  <Metric label="A receber" value="R$ 5,7 mil" detail="pedidos em aberto" />
                  <Metric label="Saldo projetado" value="R$ 15,4 mil" detail="exemplo visual" />
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
                <p className="font-black">Ãšltimos lanÃ§amentos</p>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Pedido #1048", "Entrada", "+ R$ 189,90"],
                    ["Fornecedor de material", "SaÃ­da", "- R$ 420,00"],
                    ["Pedido #1046", "Entrada", "+ R$ 248,00"],
                    ["ServiÃ§o recorrente", "SaÃ­da", "- R$ 99,90"],
                  ].map(([title, type, amount]) => (
                    <div
                      key={`${title}-${amount}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-[#fbfcfe] p-4"
                    >
                      <div>
                        <p className="font-black">{title}</p>
                        <p className="mt-1 text-xs font-bold text-slate-400">{type}</p>
                      </div>
                      <p
                        className={`font-black ${
                          amount.startsWith("+")
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {amount}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-center text-xs font-black text-violet-700">
            Este ambiente Ã© apenas um demonstrativo comercial do OrÃ§aly. Todos os nomes, valores e operaÃ§Ãµes exibidos sÃ£o fictÃ­cios.
          </div>
        </section>
      </div>
    </main>
  );
}
