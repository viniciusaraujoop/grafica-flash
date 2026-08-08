"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  referralLink: string;
  partnerName?: string;
};

type ScriptItem = {
  id: string;
  channel: string;
  title: string;
  body: string;
};

const scripts: ScriptItem[] = [
  {
    id: "whatsapp",
    channel: "WhatsApp",
    title: "Primeiro contato",
    body:
      "Oi! Tudo bem? Vi que você trabalha com [SEGMENTO] e queria te fazer uma pergunta rápida: hoje vocês organizam pedidos, clientes e divulgação em um sistema só ou acabam usando várias ferramentas? Trabalho com o Orçaly e posso te mostrar uma demonstração bem curta, sem compromisso.",
  },
  {
    id: "instagram",
    channel: "Instagram / Direct",
    title: "Abordagem curta",
    body:
      "Oi! Conheci o perfil de vocês e gostei do trabalho. Eu apresento o Orçaly para empresas que querem organizar site, catálogo, pedidos e operação em um só lugar. Posso te mandar uma demonstração rápida para você ver se faria sentido aí?",
  },
  {
    id: "presencial",
    channel: "Presencial",
    title: "Pitch de 30 segundos",
    body:
      "Eu trabalho com o Orçaly, uma plataforma que reúne ferramentas que o negócio normalmente usa separadas. Antes de te explicar tudo, queria entender uma coisa: hoje como vocês recebem pedidos e organizam o acompanhamento dos clientes? Se fizer sentido, eu consigo te mostrar o sistema em poucos minutos.",
  },
  {
    id: "followup",
    channel: "Follow-up",
    title: "Retomar sem pressionar",
    body:
      "Oi! Passando só para retomar nossa conversa sobre o Orçaly. Você comentou que [DOR DO CLIENTE]. Na demonstração eu te mostrei como a parte de [RECURSO] pode ajudar justamente nisso. Se ainda fizer sentido, posso te enviar o acesso para conhecer melhor.",
  },
  {
    id: "organic",
    channel: "Conteúdo orgânico",
    title: "Legenda educativa",
    body:
      "Seu negócio usa uma ferramenta para pedidos, outra para catálogo, planilha para financeiro e WhatsApp para lembrar o resto? Centralizar a operação pode reduzir retrabalho e deixar o atendimento mais claro. Estou mostrando o Orçaly para empresas que querem organizar esse fluxo. {LINK}",
  },
  {
    id: "paid",
    channel: "Tráfego pago",
    title: "Anúncio direto",
    body:
      "Pedidos, catálogo, clientes e operação espalhados em várias ferramentas? Conheça uma forma mais organizada de centralizar a rotina da sua empresa. Veja o Orçaly e teste se faz sentido para o seu negócio. {LINK}",
  },
];

export default function PartnerPromotionTab({
  referralLink,
  partnerName,
}: Props) {
  const [copied, setCopied] = useState("");

  const scriptsWithLink = useMemo(
    () =>
      scripts.map((item) => ({
        ...item,
        body: item.body.replace("{LINK}", referralLink),
      })),
    [referralLink],
  );

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="partner-fade-up space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#071b3a] via-[#082a5c] to-[#0d4a83] p-5 text-white shadow-xl sm:p-7">
        <div className="pointer-events-none absolute -right-16 top-0 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_360px] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
              Central de divulgação
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Você não precisa inventar a venda do zero.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/58">
              Use roteiros, ideias de campanha, seu link de indicação e um ambiente demonstrativo para apresentar o Orçaly com mais clareza.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/60">
              Parceiro
            </p>
            <p className="mt-1 text-lg font-black">
              {partnerName || "Parceiro Orçaly"}
            </p>
            <p className="mt-3 text-xs font-bold leading-5 text-white/45">
              Personalize os textos antes de enviar. Conversa real converte melhor do que mensagem copiada para cinquenta pessoas.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_.92fr]">
        <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
            Demonstrativo Orçaly
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
            Abra o sistema e mostre como ele funciona.
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            O demonstrativo usa dados totalmente fictícios. Ele existe apenas para apresentação comercial e não cria pedidos, clientes, cobranças ou alterações reais.
          </p>

          <div className="mt-5 rounded-[1.5rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-violet-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-violet-700">
                  Somente leitura
                </span>
                <p className="mt-3 font-black text-[#071b3a]">
                  Visão geral, pedidos, produtos, clientes e financeiro
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  Ideal para uma demonstração rápida presencial, em chamada ou compartilhando a tela.
                </p>
              </div>

              <Link
                href="/parceiros/demo"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-2xl bg-[#05245c] px-5 py-4 text-center text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#031a43]"
              >
                Abrir demonstrativo ↗
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
            Seu link
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Link de indicação
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            Use este endereço quando a pessoa quiser conhecer o Orçaly de verdade. É ele que preserva a atribuição da indicação.
          </p>

          <div className="mt-5 break-all rounded-2xl border border-blue-100 bg-[#f7faff] p-4 text-sm font-black text-[#05245c]">
            {referralLink}
          </div>

          <button
            type="button"
            onClick={() => void copy("referral-link", referralLink)}
            className="mt-4 w-full rounded-2xl bg-[#05245c] px-5 py-4 text-sm font-black text-white"
          >
            {copied === "referral-link" ? "✓ Link copiado" : "Copiar meu link"}
          </button>
        </section>
      </div>

      <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
            Roteiros prontos
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Comece por uma conversa, não por um panfleto.
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Os textos abaixo são pontos de partida. Troque os campos entre colchetes e adapte a linguagem ao negócio da pessoa.
          </p>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {scriptsWithLink.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.45rem] border border-slate-100 bg-[#fbfcfe] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {item.channel}
                  </p>
                  <h3 className="mt-1 font-black text-[#071b3a]">
                    {item.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void copy(item.id, item.body)}
                  className="shrink-0 rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs font-black text-[#05245c]"
                >
                  {copied === item.id ? "✓ Copiado" : "Copiar"}
                </button>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-600">
            Tráfego gratuito
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Rotina orgânica que dá contexto à oferta
          </h2>

          <div className="mt-5 grid gap-3">
            {[
              ["1", "Escolha um nicho", "Fale com empresas cuja rotina você entende. Isso melhora conteúdo e abordagem."],
              ["2", "Publique dores reais", "Mostre problemas de pedidos, atendimento, catálogo, organização e retrabalho."],
              ["3", "Mostre interface", "Grave trechos do demonstrativo explicando um fluxo por vez."],
              ["4", "Converse", "Responda comentários e directs antes de jogar um link na pessoa."],
              ["5", "Convide", "Quando houver interesse, envie seu link de indicação para ela conhecer o sistema."],
            ].map(([number, title, detail]) => (
              <div
                key={number}
                className="flex gap-4 rounded-[1.25rem] border border-emerald-100 bg-emerald-50/60 p-4"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-xs font-black text-white">
                  {number}
                </span>
                <div>
                  <p className="font-black text-emerald-950">{title}</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-emerald-900/65">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-600">
            Tráfego pago
          </p>
          <h2 className="mt-2 text-2xl font-black">
            Teste pequeno, mensagem específica, medição clara
          </h2>

          <div className="mt-5 grid gap-3">
            {[
              ["Público", "Comece com um nicho, região ou perfil de negócio que tenha uma dor identificável."],
              ["Criativo", "Mostre a situação atual e uma tela do Orçaly que ajude a organizar aquele processo."],
              ["Oferta", "Convide para conhecer ou testar. Não prometa faturamento, economia garantida ou resultado impossível de comprovar."],
              ["Destino", "Use seu link de indicação quando a campanha levar para cadastro e mantenha a mesma mensagem do anúncio."],
              ["Métrica", "Acompanhe custo por conversa, cadastro e cliente, não apenas curtidas ou visualizações."],
            ].map(([title, detail]) => (
              <div
                key={title}
                className="rounded-[1.25rem] border border-violet-100 bg-violet-50/60 p-4"
              >
                <p className="font-black text-violet-950">{title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-violet-900/65">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[1.8rem] border border-red-100 bg-red-50 p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-red-600">
          O que não fazer
        </p>
        <h2 className="mt-2 text-xl font-black text-red-950">
          Venda ruim vira cancelamento, reclamação e indicação perdida.
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Não invente funcionalidade que o sistema ainda não possui.",
            "Não prometa renda, faturamento ou resultado garantido.",
            "Não use urgência, desconto ou escassez falsos.",
            "Não faça spam em massa ou esconda que você é parceiro do Orçaly.",
          ].map((text) => (
            <div
              key={text}
              className="rounded-xl bg-white/70 p-4 text-sm font-bold leading-6 text-red-900/75"
            >
              {text}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
