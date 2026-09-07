"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getPanelModulesForBusinessType,
  panelGroupLabels,
  type BusinessSegment,
  type PanelModule,
  type PanelModuleGroup,
} from "@/lib/panel-modules";
import { getBusinessTypeConfig } from "@/lib/business-types";

type DemoCompany = {
  nome: string;
  plano: string;
  business_type: BusinessSegment;
  site_template: BusinessSegment;
  logo_url: null;
};

type DemoOrder = {
  id: string;
  customer: string;
  product: string;
  value: string;
  status: string;
  payment: string;
  when: string;
};

type DemoProduct = {
  name: string;
  category: string;
  price: string;
  stock: string;
  status: string;
};

type DemoClient = {
  name: string;
  detail: string;
  value: string;
  tag: string;
  next: string;
};

type DemoProposal = {
  id: string;
  customer: string;
  value: string;
  status: string;
  validity: string;
};

const groupOrder: PanelModuleGroup[] = [
  "principal",
  "comercial",
  "operacao",
  "financeiro",
  "presenca_digital",
  "relatorios",
  "sistema",
];

const scenarioNames: Record<BusinessSegment, string> = {
  services: "Studio Norte Serviços",
  graphic: "Gráfica Aurora",
  custom_products: "Ateliê Personaliza",
  food: "Sabor da Casa",
  auto: "Auto Prime Oficina",
  technical_assistance: "TechFix Assistência",
  beauty: "Essenza Beauty",
  barber: "Barbearia Central",
  store: "Loja Horizonte",
  events: "Celebra Eventos",
};

const scenarioOptions: Array<{
  value: BusinessSegment;
  label: string;
}> = [
  { value: "graphic", label: "Gráfica" },
  { value: "food", label: "Food / Restaurante" },
  { value: "store", label: "Loja / Comércio" },
  { value: "services", label: "Serviços" },
  { value: "auto", label: "Auto / Oficina" },
  { value: "technical_assistance", label: "Assistência técnica" },
  { value: "beauty", label: "Beleza" },
  { value: "barber", label: "Barbearia" },
  { value: "events", label: "Eventos" },
  { value: "custom_products", label: "Personalizados" },
];

const orders: DemoOrder[] = [
  {
    id: "#1048",
    customer: "Marina Costa",
    product: "Kit promocional",
    value: "R$ 189,90",
    status: "Recebido",
    payment: "Pago",
    when: "há 4 min",
  },
  {
    id: "#1047",
    customer: "João Rocha",
    product: "Produto personalizado",
    value: "R$ 74,50",
    status: "Em produção",
    payment: "Pago",
    when: "há 18 min",
  },
  {
    id: "#1046",
    customer: "Amanda Silva",
    product: "Pacote empresarial",
    value: "R$ 248,00",
    status: "Pronto",
    payment: "Pendente",
    when: "há 42 min",
  },
  {
    id: "#1045",
    customer: "Carlos Melo",
    product: "Item rápido",
    value: "R$ 119,90",
    status: "Entregue",
    payment: "Pago",
    when: "há 1 h",
  },
  {
    id: "#1044",
    customer: "Beatriz Lima",
    product: "Pedido recorrente",
    value: "R$ 320,00",
    status: "Aguardando",
    payment: "Pendente",
    when: "há 2 h",
  },
];

const products: DemoProduct[] = [
  {
    name: "Kit promocional",
    category: "Mais vendido",
    price: "R$ 89,90",
    stock: "24 un.",
    status: "Ativo",
  },
  {
    name: "Produto personalizado",
    category: "Sob encomenda",
    price: "R$ 149,90",
    stock: "Produção",
    status: "Ativo",
  },
  {
    name: "Pacote empresarial",
    category: "Serviço",
    price: "R$ 299,00",
    stock: "Disponível",
    status: "Ativo",
  },
  {
    name: "Item rápido",
    category: "Catálogo",
    price: "R$ 39,90",
    stock: "61 un.",
    status: "Ativo",
  },
];

const clients: DemoClient[] = [
  {
    name: "Marina Costa",
    detail: "5 pedidos",
    value: "R$ 684,20",
    tag: "Recorrente",
    next: "Retorno em 2 dias",
  },
  {
    name: "João Rocha",
    detail: "2 pedidos",
    value: "R$ 218,40",
    tag: "Ativo",
    next: "Proposta enviada",
  },
  {
    name: "Amanda Silva",
    detail: "8 pedidos",
    value: "R$ 1.492,70",
    tag: "VIP",
    next: "Sem pendência",
  },
  {
    name: "Carlos Melo",
    detail: "1 pedido",
    value: "R$ 119,90",
    tag: "Novo",
    next: "Apresentar catálogo",
  },
];

const proposals: DemoProposal[] = [
  {
    id: "PROP-221",
    customer: "Construtora Vale",
    value: "R$ 1.840,00",
    status: "Aguardando cliente",
    validity: "12/08",
  },
  {
    id: "PROP-220",
    customer: "Clínica Vitta",
    value: "R$ 680,00",
    status: "Aprovada",
    validity: "15/08",
  },
  {
    id: "PROP-219",
    customer: "Mercado União",
    value: "R$ 920,00",
    status: "Em negociação",
    validity: "10/08",
  },
];

const routeDescriptions: Record<string, string> = {
  "/painel/inicio":
    "Acompanhe a operação e acesse rapidamente as áreas mais importantes do negócio.",
  "/painel/site":
    "Edite site, catálogo, identidade e publicação em uma única vitrine.",
  "/painel/produtos":
    "Gerencie produtos, serviços, preços, imagens, estoque e disponibilidade.",
  "/painel/pedidos":
    "Organize pedidos, prioridades, clientes e mudanças de status.",
  "/painel/crm":
    "Acompanhe clientes, oportunidades e negociações com clareza.",
  "/painel/clientes":
    "Centralize contatos, histórico e oportunidades comerciais.",
  "/painel/follow-up":
    "Mantenha retornos e contatos importantes sob controle.",
  "/painel/propostas":
    "Crie, acompanhe e organize propostas comerciais.",
  "/painel/cupons":
    "Gerencie campanhas, benefícios e regras comerciais.",
  "/painel/financeiro":
    "Acompanhe entradas, saídas, vencimentos e saldo operacional.",
  "/painel/pagamentos":
    "Veja recebimentos online, taxas do provedor e situação de pagamentos.",
  "/painel/artes":
    "Organize arquivos, aprovações e histórico de materiais.",
  "/painel/producao":
    "Acompanhe trabalhos em andamento e etapas da produção.",
  "/painel/entregas":
    "Monitore entregas do preparo até a conclusão.",
  "/painel/estoque":
    "Acompanhe disponibilidade, entradas, saídas e alertas de estoque.",
  "/painel/configuracoes":
    "Ajuste dados, preferências e identidade da empresa.",
};

function pageTitle(pathname: string, modules: PanelModule[]) {
  const panelItem = modules.find((item) => item.href === pathname);
  if (panelItem) return panelItem.label;
  if (pathname === "/painel/inicio") return "Visão geral";
  if (pathname === "/painel/site") return "Minha Vitrine";

  const last = pathname.split("/").filter(Boolean).pop() || "painel";
  return last
    .replace(/-/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function toneForStatus(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("pago") ||
    normalized.includes("aprov") ||
    normalized.includes("entreg")
  ) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (
    normalized.includes("pend") ||
    normalized.includes("aguard") ||
    normalized.includes("negocia")
  ) {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }

  return "bg-blue-50 text-blue-700 ring-blue-100";
}

function DemoMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#10213d]">
            {value}
          </p>
          <p className="mt-2 text-xs font-bold text-slate-400">{detail}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-lg text-blue-700">
          {icon}
        </span>
      </div>
    </article>
  );
}

function DemoSectionTitle({
  kicker,
  title,
  description,
  action,
  onAction,
}: {
  kicker?: string;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker ? (
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            {kicker}
          </p>
        ) : null}
        <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-[#10213d]">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {action && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-xl bg-[#05245c] px-4 py-2.5 text-xs font-black text-white"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function DemoOverview({
  navigate,
  notify,
}: {
  navigate: (href: string) => void;
  notify: (message: string) => void;
}) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-5 text-[#10213d] sm:px-6">
      <section className="mx-auto max-w-[1440px] space-y-5">
        <header className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-xl font-black text-white">
                G
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Gráfica
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                  Gráfica Aurora
                </h2>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => notify("No modo demonstrativo, nenhum item é criado.")}
                className="rounded-xl bg-[#05245c] px-5 py-3 text-sm font-black text-white"
              >
                Novo item
              </button>
              <button
                type="button"
                onClick={() => navigate("/painel/pedidos")}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#10213d]"
              >
                Ver pedidos
              </button>
              <button
                type="button"
                onClick={() => navigate("/painel/site")}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-[#10213d]"
              >
                Abrir vitrine
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DemoMetric
            label="Faturamento hoje"
            value="R$ 2.846,40"
            detail="14 pagamentos confirmados hoje"
            icon="R$"
          />
          <DemoMetric
            label="Pedidos hoje"
            value="18"
            detail="6 em andamento"
            icon="📥"
          />
          <DemoMetric
            label="Aguardando ação"
            value="4"
            detail="Pedidos pendentes"
            icon="⏳"
          />
          <DemoMetric
            label="Itens ativos"
            value="63"
            detail="71 cadastrados"
            icon="📦"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <DemoSectionTitle
              title="Pedidos recentes"
              action="Ver todos"
              onAction={() => navigate("/painel/pedidos")}
            />
            <div className="mt-4 divide-y divide-slate-100">
              {orders.slice(0, 5).map((order) => (
                <button
                  type="button"
                  key={order.id}
                  onClick={() => notify("Detalhes fictícios do pedido. Nenhuma alteração é salva.")}
                  className="grid w-full gap-3 py-4 text-left transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-[#10213d]">
                      {order.customer}
                    </p>
                    <p className="mt-1 truncate text-sm font-bold text-slate-400">
                      {order.product} · {order.when}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${toneForStatus(order.status)}`}
                  >
                    {order.status}
                  </span>
                  <p className="font-black text-[#10213d]">{order.value}</p>
                </button>
              ))}
            </div>
          </article>

          <div className="grid content-start gap-5">
            <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <DemoSectionTitle title="Atenção agora" />
              <div className="mt-4 grid gap-2">
                {[
                  ["4 pedidos aguardando", "bg-amber-50 text-amber-700", "/painel/pedidos"],
                  ["3 propostas pendentes", "bg-violet-50 text-violet-700", "/painel/propostas"],
                  ["2 itens sem foto", "bg-blue-50 text-blue-700", "/painel/produtos"],
                ].map(([label, tone, href]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => navigate(href)}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-black ${tone}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
              <DemoSectionTitle title="Atalhos" />
              <div className="mt-4 grid gap-2">
                {[
                  ["🌐", "Minha Vitrine", "Editar e publicar", "/painel/site"],
                  ["📦", "Produtos", "Itens, preços e estoque", "/painel/produtos"],
                  ["👥", "Clientes", "Contatos e oportunidades", "/painel/crm"],
                  ["💰", "Financeiro", "Entradas e saídas", "/painel/financeiro"],
                ].map(([icon, label, detail, href]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => navigate(href)}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-lg">
                      {icon}
                    </span>
                    <span>
                      <strong className="block text-sm text-[#10213d]">{label}</strong>
                      <small className="font-bold text-slate-400">{detail}</small>
                    </span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

function DemoOrders({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <DemoSectionTitle
          kicker="Operação"
          title="Pedidos"
          description="Acompanhe pedidos, cliente, pagamento e etapa atual em uma única visão."
          action="Novo pedido"
          onAction={() => notify("Criação bloqueada no modo demonstração.")}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <DemoMetric label="Recebidos" value="8" detail="novos pedidos" icon="📥" />
          <DemoMetric label="Em produção" value="6" detail="trabalhos ativos" icon="⚙️" />
          <DemoMetric label="Prontos" value="3" detail="aguardando saída" icon="✓" />
          <DemoMetric label="Pendentes" value="4" detail="precisam de atenção" icon="!" />
        </div>

        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-[95px_1fr_1fr_130px_130px_120px] gap-3 border-b border-slate-100 px-4 pb-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Item</span>
              <span>Valor</span>
              <span>Status</span>
              <span>Pagamento</span>
            </div>
            {orders.map((order) => (
              <button
                type="button"
                key={order.id}
                onClick={() => notify(`Abrindo ${order.id} apenas para visualização.`)}
                className="grid w-full grid-cols-[95px_1fr_1fr_130px_130px_120px] gap-3 border-b border-slate-100 px-4 py-4 text-left text-sm font-bold hover:bg-slate-50"
              >
                <span className="font-black text-[#05245c]">{order.id}</span>
                <span>{order.customer}</span>
                <span className="text-slate-500">{order.product}</span>
                <span>{order.value}</span>
                <span>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${toneForStatus(order.status)}`}>
                    {order.status}
                  </span>
                </span>
                <span className={order.payment === "Pago" ? "text-emerald-600" : "text-amber-600"}>
                  {order.payment}
                </span>
              </button>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

function DemoProducts({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <DemoSectionTitle
          kicker="Vitrine"
          title="Itens da Vitrine"
          description="Produtos e serviços aparecem aqui com preço, estoque, mídia e disponibilidade."
          action="Cadastrar item"
          onAction={() => notify("Cadastro bloqueado no modo demonstração.")}
        />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-400">
            Buscar produto ou serviço...
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600">
            Todos os status
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product, index) => (
            <button
              type="button"
              key={product.name}
              onClick={() => notify(`${product.name}: edição desativada na demonstração.`)}
              className="overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
                <h3 className="mt-1 font-black">{product.name}</h3>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="font-black text-[#05245c]">{product.price}</span>
                  <span className="text-xs font-bold text-slate-400">{product.stock}</span>
                </div>
                <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">
                  {product.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function DemoCrm({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <DemoSectionTitle
            kicker="Relacionamento"
            title="Clientes / CRM"
            description="Centralize histórico, valor, tags e próximo contato."
            action="Novo cliente"
            onAction={() => notify("Cadastro de cliente desativado no modo demonstração.")}
          />

          <div className="mt-5 grid gap-3">
            {clients.map((client) => (
              <button
                type="button"
                key={client.name}
                onClick={() => notify(`Perfil de ${client.name}: somente leitura.`)}
                className="flex flex-col gap-4 rounded-[1.4rem] border border-slate-100 bg-[#fbfcfe] p-4 text-left sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#071b3a] text-sm font-black text-white">
                    {client.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div>
                    <p className="font-black">{client.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {client.detail} · {client.tag}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lg font-black text-[#05245c]">{client.value}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{client.next}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
          <DemoSectionTitle title="Funil comercial" />
          <div className="mt-4 grid gap-3">
            {[
              ["Novos leads", "12", "bg-blue-50 text-blue-700"],
              ["Em conversa", "8", "bg-violet-50 text-violet-700"],
              ["Proposta enviada", "5", "bg-amber-50 text-amber-700"],
              ["Clientes ativos", "327", "bg-emerald-50 text-emerald-700"],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-xl p-4 ${tone}`}>
                <p className="text-xs font-black">{label}</p>
                <p className="mt-1 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function DemoProposals({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="p-4 sm:p-6">
      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <DemoSectionTitle
          kicker="Comercial"
          title="Propostas"
          description="Acompanhe valor, validade e situação das negociações."
          action="Criar proposta"
          onAction={() => notify("Criação de proposta bloqueada na demonstração.")}
        />
        <div className="mt-5 grid gap-3">
          {proposals.map((proposal) => (
            <button
              key={proposal.id}
              type="button"
              onClick={() => notify(`${proposal.id}: visualização demonstrativa.`)}
              className="grid gap-3 rounded-[1.35rem] border border-slate-100 bg-[#fbfcfe] p-4 text-left sm:grid-cols-[120px_1fr_150px_170px_100px] sm:items-center"
            >
              <span className="font-black text-[#05245c]">{proposal.id}</span>
              <span className="font-black">{proposal.customer}</span>
              <span>{proposal.value}</span>
              <span>
                <span className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${toneForStatus(proposal.status)}`}>
                  {proposal.status}
                </span>
              </span>
              <span className="text-xs font-bold text-slate-400">{proposal.validity}</span>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function DemoFinance({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DemoMetric label="Entradas do mês" value="R$ 24.840" detail="+12% no período" icon="↗" />
        <DemoMetric label="Saídas" value="R$ 9.420" detail="custos registrados" icon="↘" />
        <DemoMetric label="A receber" value="R$ 5.760" detail="valores em aberto" icon="◷" />
        <DemoMetric label="Saldo projetado" value="R$ 15.420" detail="visão demonstrativa" icon="R$" />
      </div>

      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <DemoSectionTitle
          kicker="Financeiro"
          title="Últimos lançamentos"
          description="Entradas e saídas organizadas em uma visão operacional."
          action="Novo lançamento"
          onAction={() => notify("Lançamentos estão bloqueados na demonstração.")}
        />
        <div className="mt-5 grid gap-2">
          {[
            ["Pedido #1048", "Venda", "+ R$ 189,90", "Hoje, 17:42"],
            ["Fornecedor de material", "Despesa", "- R$ 420,00", "Hoje, 14:10"],
            ["Pedido #1046", "Venda", "+ R$ 248,00", "Hoje, 11:25"],
            ["Serviço recorrente", "Despesa", "- R$ 99,90", "Ontem"],
          ].map(([title, type, amount, date]) => (
            <button
              key={`${title}-${date}`}
              type="button"
              onClick={() => notify("Detalhes financeiros são fictícios e somente leitura.")}
              className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-[#fbfcfe] p-4 text-left"
            >
              <div>
                <p className="font-black">{title}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {type} · {date}
                </p>
              </div>
              <p className={`font-black ${amount.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                {amount}
              </p>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function DemoSite({ notify }: { notify: (message: string) => void }) {
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
          <DemoSectionTitle
            kicker="Minha Vitrine"
            title="Identidade e conteúdo"
            description="Configurações representativas da vitrine pública."
          />
          <div className="mt-5 grid gap-4">
            {[
              ["Nome público", "Gráfica Aurora"],
              ["Título principal", "Impressão rápida para transformar suas ideias."],
              ["WhatsApp", "(82) 99999-0000"],
              ["Endereço", "Maceió - AL"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="mb-2 text-xs font-black text-slate-500">{label}</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  {value}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => notify("Publicação desativada no modo demonstração.")}
              className="rounded-xl bg-[#05245c] px-5 py-3 text-sm font-black text-white"
            >
              Publicar alterações
            </button>
          </div>
        </article>

        <article className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.13em] text-slate-400">
                Pré-visualização
              </p>
              <p className="mt-1 font-black">grafica-aurora.orcaly.com.br</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
              Publicado
            </span>
          </div>

          <div className="bg-[#071b3a] p-8 text-white sm:p-10">
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-cyan-100">
              Gráfica Aurora
            </span>
            <h3 className="mt-5 max-w-2xl text-4xl font-black tracking-[-0.055em]">
              Impressão rápida para transformar suas ideias.
            </h3>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-white/60">
              Catálogo, produtos, orçamento e pedidos em uma experiência digital organizada.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-xl bg-white px-5 py-3 text-sm font-black text-[#05245c]">
                Ver produtos
              </span>
              <span className="rounded-xl border border-white/15 px-5 py-3 text-sm font-black">
                Falar no WhatsApp
              </span>
            </div>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {products.slice(0, 3).map((product) => (
              <div key={product.name} className="rounded-xl border border-slate-100 bg-[#fbfcfe] p-4">
                <div className="h-20 rounded-lg bg-gradient-to-br from-blue-50 to-violet-50" />
                <p className="mt-3 text-sm font-black">{product.name}</p>
                <p className="mt-1 text-xs font-bold text-[#05245c]">{product.price}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function DemoGenericModule({
  panelModule,
  notify,
}: {
  panelModule: PanelModule | undefined;
  notify: (message: string) => void;
}) {
  const label = panelModule?.label || "Módulo demonstrativo";
  const description =
    panelModule?.description ||
    "Esta área segue a estrutura visual do painel e usa apenas dados fictícios.";

  return (
    <section className="space-y-5 p-4 sm:p-6">
      <article className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <DemoSectionTitle
          kicker="Modo demonstração"
          title={label}
          description={description}
          action="Nova ação"
          onAction={() => notify("Ação bloqueada: esta demonstração é somente leitura.")}
        />

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <DemoMetric label="Ativos" value="18" detail="registros demonstrativos" icon={panelModule?.icon || "•"} />
          <DemoMetric label="Em andamento" value="7" detail="itens na operação" icon="◷" />
          <DemoMetric label="Concluídos" value="42" detail="histórico fictício" icon="✓" />
        </div>

        <div className="mt-6 grid gap-3">
          {[
            ["Registro demonstrativo 01", "Atualizado hoje", "Em andamento"],
            ["Registro demonstrativo 02", "Atualizado ontem", "Aguardando"],
            ["Registro demonstrativo 03", "Atualizado há 2 dias", "Concluído"],
            ["Registro demonstrativo 04", "Atualizado há 3 dias", "Em análise"],
          ].map(([title, when, status]) => (
            <button
              type="button"
              key={title}
              onClick={() => notify(`${label}: este registro é apenas ilustrativo.`)}
              className="flex flex-col gap-3 rounded-[1.3rem] border border-slate-100 bg-[#fbfcfe] p-4 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-black">{title}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{when}</p>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ring-1 ${toneForStatus(status)}`}>
                {status}
              </span>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function DemoContent({
  pathname,
  modules,
  navigate,
  notify,
}: {
  pathname: string;
  modules: PanelModule[];
  navigate: (href: string) => void;
  notify: (message: string) => void;
}) {
  if (pathname === "/painel/inicio") {
    return <DemoOverview navigate={navigate} notify={notify} />;
  }

  if (pathname === "/painel/site" || pathname === "/painel") {
    return <DemoSite notify={notify} />;
  }

  if (pathname === "/painel/pedidos") {
    return <DemoOrders notify={notify} />;
  }

  if (pathname === "/painel/produtos" || pathname === "/painel/estoque") {
    return <DemoProducts notify={notify} />;
  }

  if (pathname === "/painel/crm" || pathname === "/painel/clientes" || pathname === "/painel/follow-up") {
    return <DemoCrm notify={notify} />;
  }

  if (pathname === "/painel/propostas") {
    return <DemoProposals notify={notify} />;
  }

  if (
    pathname === "/painel/financeiro" ||
    pathname.startsWith("/painel/financeiro/") ||
    pathname === "/painel/pagamentos"
  ) {
    return <DemoFinance notify={notify} />;
  }

  return (
    <DemoGenericModule
      panelModule={modules.find((item) => item.href === pathname)}
      notify={notify}
    />
  );
}

export default function PartnerSystemDemo() {
  const [segment, setSegment] = useState<BusinessSegment>("graphic");
  const [pathname, setPathname] = useState("/painel/inicio");
  const [notice, setNotice] = useState(
    "Modo demonstração: navegue livremente. Nenhum dado real será alterado.",
  );
  // ORCALY_DEMO_TRAINING_MODE
  const [trainingMode, setTrainingMode] = useState(false);
  const [visitedRoutes, setVisitedRoutes] = useState<Set<string>>(
    new Set(["/painel/inicio"]),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setTrainingMode(params.get("training") === "1");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const company: DemoCompany = useMemo(
    () => ({
      nome: scenarioNames[segment],
      plano: "premium",
      business_type: segment,
      site_template: segment,
      logo_url: null,
    }),
    [segment],
  );

  const modules = useMemo(
    () =>
      getPanelModulesForBusinessType(segment).filter(
        (panelItem) => panelItem.status === "active",
      ),
    [segment],
  );

  const businessConfig = useMemo(
    () => getBusinessTypeConfig(segment),
    [segment],
  );

  function navigate(href: string) {
    if (href.startsWith("http")) {
      setNotice("Links externos estão desativados no modo demonstração.");
      return;
    }

    setPathname(href);
    setVisitedRoutes((current) => new Set([...current, href]));
    setNotice(`Visualizando ${pageTitle(href, modules)} em modo somente leitura.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function notify(message: string) {
    setNotice(message);
  }

  function changeSegment(next: BusinessSegment) {
    setSegment(next);
    setPathname("/painel/inicio");
    setVisitedRoutes(new Set(["/painel/inicio"]));
    setNotice(
      `Cenário alterado para ${scenarioNames[next]}. O menu acompanha o segmento do Orçaly.`,
    );
  }

  const title = pageTitle(pathname, modules);
  const description =
    routeDescriptions[pathname] ||
    modules.find((panelItem) => panelItem.href === pathname)?.description ||
    "Explore esta área usando dados fictícios e sem qualquer alteração real.";
  const trainingMissionRoutes = [
    "/painel/pedidos",
    "/painel/crm",
    "/painel/site",
    "/painel/financeiro",
  ];
  const trainingCompleted = trainingMissionRoutes.filter((route) =>
    visitedRoutes.has(route),
  ).length;
  const trainingProgress = Math.round(
    (trainingCompleted / trainingMissionRoutes.length) * 100,
  );

  return (
    <main className="min-h-screen bg-[#eef3f8]">
      <div className="sticky top-0 z-[80] border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-200 text-sm font-black text-amber-900">
              D
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-800">
                Demonstração Orçaly · somente leitura
              </p>
              <p className="mt-0.5 text-xs font-bold leading-5 text-amber-700">
                {notice}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2">
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                Cenário
              </span>
              <select
                value={segment}
                onChange={(event) =>
                  changeSegment(event.target.value as BusinessSegment)
                }
                className="bg-transparent text-xs font-black text-[#071b3a] outline-none"
              >
                {scenarioOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <Link
              href="/parceiros/painel"
              className="rounded-xl bg-[#05245c] px-4 py-2.5 text-center text-xs font-black text-white"
            >
              Voltar ao Portal
            </Link>
          </div>
        </div>
      </div>

      {trainingMode ? (
        <section className="border-b border-violet-200 bg-violet-50 px-4 py-4">
          <div className="mx-auto grid max-w-[1700px] gap-4 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                Treino de demonstração ativo
              </p>
              <h2 className="mt-1 text-lg font-black text-violet-950">
                Missão: conduza uma demo sem passear por todos os menus.
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-violet-800/70">
                Visite Pedidos, CRM, Minha Vitrine e Financeiro. Durante uma apresentação real, escolha apenas as áreas ligadas à dor do cliente.
              </p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-white p-4">
              <div className="flex items-center justify-between text-xs font-black text-violet-800">
                <span>Progresso da missão</span>
                <span>{trainingCompleted}/{trainingMissionRoutes.length}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-500"
                  style={{ width: `${trainingProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-violet-700">
                {trainingProgress === 100
                  ? "Missão concluída. Agora tente repetir a demo em menos de cinco minutos."
                  : "Navegue pelas áreas da missão usando o menu."}
              </p>
            </div>
          </div>
        </section>
      ) : null}
      <div
        className="orcaly-panel-adaptive min-h-screen lg:grid lg:grid-cols-[288px_minmax(0,1fr)]"
        data-orcaly-panel="adaptive-v1-demo"
      >
        <DemoSidebar
          company={company}
          pathname={pathname}
          modules={modules}
          businessLabel={businessConfig.label}
          navigate={navigate}
        />

        <div className="panel-adaptive-content min-w-0">
          <div className="panel-adaptive-top-line" aria-hidden="true" />

          <header className="panel-adaptive-header">
            <div className="panel-adaptive-header-copy min-w-0">
              <nav
                className="panel-adaptive-breadcrumb"
                aria-label="Navegação demonstrativa"
              >
                <button type="button" onClick={() => navigate("/painel/site")}>
                  Minha Vitrine
                </button>
                <span>
                  <span aria-hidden="true">/</span>
                  <span>{title}</span>
                </span>
              </nav>

              <div className="panel-adaptive-title-row">
                <div className="min-w-0">
                  <span className="panel-adaptive-kicker">
                    Central de gestão
                  </span>
                  <h1>{title}</h1>
                </div>
                <span className="panel-adaptive-segment-badge">
                  {businessConfig.label}
                </span>
              </div>

              <p>{description}</p>
            </div>

            <div className="panel-adaptive-header-actions">
              <div
                className="panel-adaptive-company-card"
                title={company.nome}
              >
                <span className="panel-adaptive-company-logo panel-adaptive-company-initial">
                  {company.nome.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <strong>{company.nome}</strong>
                  <small>Premium · Demo</small>
                </span>
              </div>

              <button
                type="button"
                onClick={() => navigate("/painel/site")}
                className="panel-adaptive-open-site"
              >
                Ver vitrine
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </header>

          <div className="panel-adaptive-page-slot min-w-0">
            <div className="panel-adaptive-page-width">
              {pathname === "/painel/inicio" ? (
                <DemoAdaptiveOverview
                  segment={segment}
                  navigate={navigate}
                />
              ) : null}

              <div className="panel-adaptive-page-canvas min-w-0">
                <DemoContent
                  pathname={pathname}
                  modules={modules}
                  navigate={navigate}
                  notify={notify}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function DemoSidebar({
  company,
  pathname,
  modules,
  businessLabel,
  navigate,
}: {
  company: DemoCompany;
  pathname: string;
  modules: PanelModule[];
  businessLabel: string;
  navigate: (href: string) => void;
}) {
  return (
    <>
      <div className="panel-sidebar-mobile-legacy sticky top-[73px] z-40 border-b border-blue-100 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-sm font-black text-white">
                {company.nome.slice(0, 1)}
              </span>
              <div>
                <p className="truncate text-sm font-black text-[#071b3a]">
                  {company.nome}
                </p>
                <p className="truncate text-xs font-bold text-slate-500">
                  {businessLabel}
                </p>
              </div>
            </div>
            <span className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-[#05245c]">
              Menu
            </span>
          </summary>

          <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-[1.4rem] border border-blue-100 bg-[#f8fbff] p-3 shadow-xl">
            <DemoSidebarGroups
              pathname={pathname}
              modules={modules}
              navigate={navigate}
            />
          </div>
        </details>
      </div>

      <aside className="panel-sidebar-desktop-legacy hidden min-h-screen border-r border-blue-100 bg-white/95 lg:block">
        <div className="sticky top-[73px] flex h-[calc(100vh-73px)] flex-col overflow-hidden">
          <div className="border-b border-blue-100 p-5">
            <button
              type="button"
              onClick={() => navigate("/painel/site")}
              className="flex w-full items-center gap-3 text-left"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-lg font-black text-white">
                {company.nome.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-[-0.03em] text-[#071b3a]">
                  {company.nome}
                </p>
                <p className="truncate text-xs font-bold text-slate-500">
                  Premium · Demonstração
                </p>
              </div>
            </button>

            <div className="mt-4 rounded-[1.2rem] bg-[#f5f8ff] p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#05245c]">
                Segmento
              </p>
              <p className="mt-1 text-sm font-black text-[#071b3a]">
                {businessLabel}
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                O menu abaixo vem da mesma configuração modular usada pelo Orçaly.
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <DemoSidebarGroups
              pathname={pathname}
              modules={modules}
              navigate={navigate}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

function DemoSidebarGroups({
  pathname,
  modules,
  navigate,
}: {
  pathname: string;
  modules: PanelModule[];
  navigate: (href: string) => void;
}) {
  return (
    <nav className="space-y-5">
      {groupOrder.map((group) => {
        const items = modules.filter((panelItem) => panelItem.group === group);
        if (!items.length) return null;

        return (
          <section key={group}>
            <p className="mb-2 px-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              {panelGroupLabels[group]}
            </p>

            <div className="grid gap-1.5">
              {items.map((panelItem) => {
                const active =
                  pathname === panelItem.href ||
                  pathname.startsWith(`${panelItem.href}/`);

                return (
                  <button
                    key={`${panelItem.id}-${panelItem.href}`}
                    type="button"
                    onClick={() => navigate(panelItem.href)}
                    className={`group w-full rounded-[1.1rem] border px-3 py-3 text-left transition ${
                      active
                        ? "border-[#05245c] bg-[#05245c] text-white shadow-lg shadow-blue-950/15"
                        : "border-transparent text-slate-600 hover:border-blue-100 hover:bg-[#f8fbff] hover:text-[#05245c]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-base">
                        {panelItem.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="truncate text-sm font-black">
                          {panelItem.label}
                        </span>
                        <span
                          className={`mt-1 line-clamp-2 block text-[11px] font-bold leading-4 ${
                            active ? "text-white/65" : "text-slate-400"
                          }`}
                        >
                          {panelItem.description}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}

function DemoAdaptiveOverview({
  segment,
  navigate,
}: {
  segment: BusinessSegment;
  navigate: (href: string) => void;
}) {
  const content: Record<
    BusinessSegment,
    {
      label: string;
      title: string;
      description: string;
      actions: Array<[string, string, string, string]>;
    }
  > = {
    graphic: {
      label: "Gráfica",
      title: "Orçamentos, artes e produção",
      description:
        "Centralize produtos, propostas, aprovações e etapas de produção.",
      actions: [
        ["PR", "Novo produto", "Cadastre produtos e serviços.", "/painel/produtos"],
        ["PP", "Ver propostas", "Acompanhe propostas comerciais.", "/painel/propostas"],
        ["AR", "Ver artes", "Organize arquivos e aprovações.", "/painel/artes"],
        ["PO", "Produção", "Veja trabalhos em andamento.", "/painel/producao"],
      ],
    },
    custom_products: {
      label: "Personalizados",
      title: "Produtos, pedidos e produção",
      description:
        "Apresente catálogo, pedidos personalizados e fluxo de produção.",
      actions: [
        ["PR", "Produtos", "Itens e personalizações.", "/painel/produtos"],
        ["PD", "Pedidos", "Solicitações recebidas.", "/painel/pedidos"],
        ["PP", "Propostas", "Negociações comerciais.", "/painel/propostas"],
        ["PO", "Produção", "Trabalhos em andamento.", "/painel/producao"],
      ],
    },
    food: {
      label: "Food",
      title: "Operação de pedidos e entregas",
      description:
        "Acesse cardápio, pedidos, entregas, regiões e horários de atendimento.",
      actions: [
        ["PD", "Ver pedidos", "Acompanhe pedidos e status.", "/painel/pedidos"],
        ["PR", "Cardápio", "Organize itens e disponibilidade.", "/painel/produtos"],
        ["EN", "Entregas", "Monitore a operação.", "/painel/entregas"],
        ["HR", "Horários", "Defina quando atende.", "/painel/horarios"],
      ],
    },
    auto: {
      label: "Auto e oficina",
      title: "Ordens, veículos e manutenção",
      description:
        "Acesse ordens de serviço, diagnósticos, peças e andamento da oficina.",
      actions: [
        ["OS", "Ordens de serviço", "Serviços abertos.", "/painel/ordens-servico"],
        ["VE", "Veículos", "Veículos cadastrados.", "/painel/veiculos"],
        ["DG", "Diagnósticos", "Avaliação técnica.", "/painel/diagnostico"],
        ["PC", "Peças", "Itens e materiais.", "/painel/pecas"],
      ],
    },
    technical_assistance: {
      label: "Assistência técnica",
      title: "Aparelhos, diagnóstico e manutenção",
      description:
        "Organize aparelhos recebidos, defeitos, aprovações e entrega ao cliente.",
      actions: [
        ["AP", "Aparelhos", "Equipamentos recebidos.", "/painel/aparelhos"],
        ["DG", "Diagnósticos", "Avaliação técnica.", "/painel/diagnostico"],
        ["MT", "Manutenção", "Trabalhos ativos.", "/painel/manutencao"],
        ["GT", "Garantias", "Garantias e retornos.", "/painel/garantias"],
      ],
    },
    beauty: {
      label: "Beauty",
      title: "Agenda, profissionais e serviços",
      description:
        "Acesse agenda, equipe, serviços e relacionamento com clientes.",
      actions: [
        ["AG", "Agenda", "Horários do dia.", "/painel/agenda"],
        ["PF", "Profissionais", "Equipe de atendimento.", "/painel/profissionais"],
        ["SV", "Serviços", "Itens oferecidos.", "/painel/produtos"],
        ["CL", "Clientes", "Histórico e contatos.", "/painel/crm"],
      ],
    },
    barber: {
      label: "Barbearia",
      title: "Agenda, profissionais e serviços",
      description:
        "Acesse agenda, equipe, serviços e relacionamento com clientes.",
      actions: [
        ["AG", "Agenda", "Horários do dia.", "/painel/agenda"],
        ["PF", "Profissionais", "Equipe de atendimento.", "/painel/profissionais"],
        ["SV", "Serviços", "Itens oferecidos.", "/painel/produtos"],
        ["CL", "Clientes", "Histórico e contatos.", "/painel/crm"],
      ],
    },
    store: {
      label: "Loja e comércio",
      title: "Produtos, estoque e vendas",
      description:
        "Acesse produtos, pedidos, estoque e vitrine digital.",
      actions: [
        ["PR", "Produtos", "O que está à venda.", "/painel/produtos"],
        ["PD", "Pedidos", "Compras e status.", "/painel/pedidos"],
        ["ES", "Estoque", "Disponibilidade.", "/painel/estoque"],
        ["ST", "Vitrine", "Site público.", "/painel/site"],
      ],
    },
    events: {
      label: "Eventos",
      title: "Datas, contratos e execução",
      description:
        "Organize eventos futuros, pacotes, contratos, equipe e checklist.",
      actions: [
        ["EV", "Eventos", "Eventos e datas.", "/painel/eventos"],
        ["CO", "Contratos", "Documentos e acordos.", "/painel/contratos"],
        ["PA", "Pacotes", "Ofertas e serviços.", "/painel/pacotes"],
        ["CK", "Checklist", "Preparação do evento.", "/painel/checklist-evento"],
      ],
    },
    services: {
      label: "Serviços",
      title: "Solicitações, propostas e acompanhamento",
      description:
        "Organize demandas, propostas, prazos e relacionamento com clientes.",
      actions: [
        ["SO", "Solicitações", "Novas demandas.", "/painel/solicitacoes"],
        ["PP", "Propostas", "Negociações.", "/painel/propostas"],
        ["TF", "Tarefas", "Trabalho em andamento.", "/painel/tarefas"],
        ["CL", "Clientes", "Contatos e histórico.", "/painel/crm"],
      ],
    },
  };

  const selected = content[segment];

  return (
    <section className="panel-adaptive-overview">
      <div className="panel-adaptive-overview-copy">
        <span>{selected.label}</span>
        <h2>{selected.title}</h2>
        <p>{selected.description}</p>
      </div>

      <div className="panel-adaptive-actions">
        {selected.actions.map(([code, label, description, href]) => (
          <button
            key={href}
            type="button"
            onClick={() => navigate(href)}
            className="panel-adaptive-action-card text-left"
          >
            <span className="panel-adaptive-action-code">{code}</span>
            <span className="min-w-0">
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <span className="panel-adaptive-action-arrow">→</span>
          </button>
        ))}
      </div>
    </section>
  );
}
