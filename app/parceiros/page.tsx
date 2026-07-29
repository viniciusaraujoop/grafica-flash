// ORCALY_AFFILIATE_VISUAL_V2
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

const planCommissions = [
  {
    plan: "Básico",
    price: "R$ 49,90",
    commission: "R$ 29,94",
    detail: "60% do primeiro pagamento elegível",
  },
  {
    plan: "Intermediário",
    price: "R$ 99,90",
    commission: "R$ 59,94",
    detail: "60% do primeiro pagamento elegível",
    featured: true,
  },
  {
    plan: "Premium",
    price: "R$ 149,90",
    commission: "R$ 89,94",
    detail: "60% do primeiro pagamento elegível",
  },
];

const portalFeatures = [
  {
    title: "Funil completo",
    text: "Veja cliques, cadastros, testes ativos, pagamentos confirmados e clientes convertidos.",
    icon: "↗",
  },
  {
    title: "Saldo separado por etapa",
    text: "Comissão futura, em retenção, disponível, em pagamento e já recebida ficam claramente identificadas.",
    icon: "₿",
  },
  {
    title: "Conta Pix protegida",
    text: "Cadastre a chave do próprio titular, acompanhe a verificação e solicite o pagamento pelo portal.",
    icon: "◆",
  },
  {
    title: "Ranking transparente",
    text: "A pontuação considera vendas reais, plano contratado e permanência dos clientes.",
    icon: "★",
  },
  {
    title: "Link exclusivo",
    text: "Cada parceiro recebe um código próprio para divulgar em redes sociais, WhatsApp ou atendimento direto.",
    icon: "∞",
  },
  {
    title: "Histórico financeiro",
    text: "Consulte retenções, liberações, solicitações, pagamentos e eventuais ajustes por estorno.",
    icon: "▤",
  },
];

const flow = [
  {
    number: "01",
    title: "Você compartilha",
    text: "O cliente acessa seu link e o código fica vinculado ao cadastro.",
  },
  {
    number: "02",
    title: "O cliente testa",
    text: "Durante os 7 dias gratuitos, a indicação aparece como comissão futura.",
  },
  {
    number: "03",
    title: "O pagamento é confirmado",
    text: "A comissão de 60% é calculada sobre o primeiro pagamento mensal líquido elegível.",
  },
  {
    number: "04",
    title: "O saldo fica protegido",
    text: "O valor passa por 14 dias de retenção para cobrir cancelamentos e estornos.",
  },
  {
    number: "05",
    title: "Você solicita o Pix",
    text: "Com pelo menos R$ 50 disponíveis e a conta verificada, o pagamento pode ser solicitado.",
  },
];

const safeguards = [
  "A comissão só existe depois de pagamento real e confirmado.",
  "Teste gratuito, pagamento recusado e cadastro duplicado não geram comissão.",
  "Autoindicação e cadastros artificiais são bloqueados.",
  "Estornos revertem o valor e podem gerar ajuste no saldo futuro.",
  "Dados de clientes aparecem mascarados no portal do parceiro.",
  "Todo pagamento fica registrado com histórico e auditoria.",
];

const faqs = [
  {
    question: "Os 60% são pagos todos os meses?",
    answer:
      "Não. A comissão corresponde a 60% do primeiro pagamento mensal elegível realizado pelo cliente depois do teste gratuito. As mensalidades seguintes permanecem integralmente com o Orçaly.",
  },
  {
    question: "Quando a comissão aparece?",
    answer:
      "Assim que o pagamento elegível for confirmado, o valor entra em retenção. Depois de 14 dias, se não houver cancelamento ou estorno, ele fica disponível.",
  },
  {
    question: "Existe valor mínimo para receber?",
    answer:
      "Sim. A solicitação de pagamento é liberada quando o saldo disponível atingir pelo menos R$ 50,00 e a conta Pix estiver verificada.",
  },
  {
    question: "Posso indicar minha própria empresa?",
    answer:
      "Não. O programa bloqueia autoindicação e vínculos suspeitos por CPF ou CNPJ, telefone, e-mail e outros sinais de duplicidade.",
  },
  {
    question: "O parceiro precisa ser empresa?",
    answer:
      "Não obrigatoriamente. O cadastro pode ser feito como pessoa física ou jurídica, desde que os dados sejam verdadeiros e a conta Pix pertença ao titular informado.",
  },
];

export default function ParceirosPage() {
  return (
    <main
      data-partner-portal
      className="min-h-screen overflow-hidden bg-[#04152f] text-white"
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.75)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.75)_1px,transparent_1px)] [background-size:58px_58px]" />
        <div className="partner-drift absolute -left-72 -top-72 h-[720px] w-[720px] rounded-full bg-blue-500/28 blur-3xl" />
        <div className="partner-drift absolute -right-64 top-[20%] h-[620px] w-[620px] rounded-full bg-emerald-400/18 blur-3xl [animation-delay:-4s]" />
        <div className="absolute bottom-[-260px] left-[32%] h-[520px] w-[520px] rounded-full bg-violet-500/12 blur-3xl" />
      </div>

      <header className="relative z-30 border-b border-white/10 bg-[#04152f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="rounded-2xl bg-white px-4 py-2.5 shadow-xl shadow-black/10"
          >
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
              width={180}
              height={52}
              priority
              className="h-10 w-auto"
            />
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-black text-white/58 lg:flex">
            <a href="#como-funciona" className="transition hover:text-white">
              Como funciona
            </a>
            <a href="#comissoes" className="transition hover:text-white">
              Comissões
            </a>
            <a href="#seguranca" className="transition hover:text-white">
              Segurança
            </a>
            <a href="#duvidas" className="transition hover:text-white">
              Dúvidas
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/parceiros/login"
              className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              Entrar
            </Link>
            <Link
              href="/parceiros/cadastro"
              className="partner-shine rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#05245c] shadow-xl shadow-black/20 transition hover:-translate-y-0.5"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.03fr_.97fr] lg:px-8 lg:py-20">
        <div className="partner-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.17em] text-cyan-100">
            <span className="relative grid h-2.5 w-2.5 place-items-center">
              <span className="partner-pulse-ring absolute h-3 w-3 rounded-full bg-emerald-300" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            Programa Orçaly Parceiros
          </div>

          <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.95] tracking-[-0.075em] sm:text-6xl lg:text-[5.2rem]">
            Transforme boas indicações em
            <span className="block bg-gradient-to-r from-cyan-300 via-emerald-300 to-blue-300 bg-clip-text text-transparent">
              uma renda organizada.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-white/62 sm:text-lg">
            Indique empresas para o Orçaly, acompanhe cada etapa pelo seu próprio portal e receba
            <strong className="font-black text-white">
              {" "}60% do primeiro pagamento mensal elegível
            </strong>
            {" "}de cada cliente convertido.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/parceiros/cadastro"
              className="partner-shine rounded-2xl bg-white px-7 py-4 text-center text-sm font-black text-[#05245c] shadow-2xl shadow-black/20 transition hover:-translate-y-1"
            >
              Quero começar a indicar
            </Link>
            <Link
              href="/parceiros/termos"
              className="rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-center text-sm font-black text-white transition hover:bg-white/10"
            >
              Ler regras completas
            </Link>
          </div>

          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
            {[
              ["60%", "primeiro pagamento"],
              ["14 dias", "retenção"],
              ["R$ 50", "mínimo para Pix"],
            ].map(([value, label], index) => (
              <div
                key={label}
                className={`partner-fade-up partner-delay-${index + 1} rounded-2xl border border-white/10 bg-white/[0.06] p-4`}
              >
                <p className="text-xl font-black sm:text-2xl">{value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.11em] text-white/35">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="partner-fade-up partner-delay-2 relative">
          <div className="absolute -inset-10 rounded-[4rem] bg-blue-400/10 blur-3xl" />

          <div className="partner-float relative rounded-[2.4rem] border border-white/12 bg-white/[0.08] p-3 shadow-[0_45px_120px_rgba(0,0,0,.34)] backdrop-blur-2xl sm:p-4">
            <div className="overflow-hidden rounded-[1.9rem] bg-[#f6f9ff] text-[#071b3a]">
              <div className="flex items-center justify-between border-b border-blue-100 bg-white px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1359a5]">
                    Portal do parceiro
                  </p>
                  <p className="mt-1 font-black">Visão geral</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-black text-slate-400">
                    Atualizado
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Cliques", "148", "+18 esta semana"],
                    ["Cadastros", "21", "9 em teste"],
                    ["Em retenção", "R$ 419,58", "liberação programada"],
                    ["Disponível", "R$ 209,79", "pronto para Pix"],
                  ].map(([label, value, detail]) => (
                    <article
                      key={label}
                      data-partner-card
                      className="rounded-2xl border border-blue-100 bg-white p-4"
                    >
                      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
                        {label}
                      </p>
                      <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#05245c] sm:text-2xl">
                        {value}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">
                        {detail}
                      </p>
                    </article>
                  ))}
                </div>

                <div className="mt-3 rounded-2xl bg-[#071b3a] p-4 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-200/55">
                        Próxima liberação
                      </p>
                      <p className="mt-1 text-lg font-black">R$ 179,82</p>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
                      <p className="text-[9px] font-black text-white/40">Em</p>
                      <p className="text-sm font-black">6 dias</p>
                    </div>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="partner-progress h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300"
                      style={{ "--partner-progress": "64%" } as CSSProperties}
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {[
                    ["Gráfica M***", "Em teste", "R$ 59,94"],
                    ["Studio A***", "Pagamento confirmado", "R$ 89,94"],
                    ["Oficina R***", "Saldo disponível", "R$ 29,94"],
                  ].map(([name, status, value]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-xs font-black">{name}</p>
                        <p className="mt-1 text-[9px] font-bold text-slate-400">
                          {status}
                        </p>
                      </div>
                      <p className="text-xs font-black text-emerald-700">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/10 bg-black/10 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-9 gap-y-3 px-4 text-xs font-black uppercase tracking-[0.13em] text-white/42 sm:px-6 lg:px-8">
          <span>Link exclusivo</span>
          <span className="hidden h-1 w-1 rounded-full bg-cyan-300 sm:block" />
          <span>Acompanhamento em tempo real</span>
          <span className="hidden h-1 w-1 rounded-full bg-cyan-300 sm:block" />
          <span>Pagamento via Pix</span>
          <span className="hidden h-1 w-1 rounded-full bg-cyan-300 sm:block" />
          <span>Histórico e auditoria</span>
        </div>
      </section>

      <section
        id="comissoes"
        className="relative bg-[#f4f7fc] py-20 text-[#071b3a]"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="partner-fade-up max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#1359a5]">
              Valores sem letra miúda
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[1] tracking-[-0.06em] sm:text-5xl">
              Quanto você recebe por cada plano.
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-slate-500">
              A comissão considera o primeiro pagamento mensal líquido elegível, depois dos 7 dias grátis. Descontos, estornos e pagamentos recusados alteram ou anulam a base.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {planCommissions.map((item, index) => (
              <article
                key={item.plan}
                data-partner-card
                className={`partner-fade-up rounded-[1.8rem] border p-5 ${
                  item.featured
                    ? "border-blue-200 bg-[#071b3a] text-white shadow-2xl shadow-blue-950/15 lg:-translate-y-3"
                    : "border-white bg-white shadow-sm"
                }`}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p
                      className={`text-xs font-black uppercase tracking-[0.15em] ${
                        item.featured ? "text-cyan-200/65" : "text-slate-400"
                      }`}
                    >
                      Plano {item.plan}
                    </p>
                    <p
                      className={`mt-2 text-sm font-bold ${
                        item.featured ? "text-white/50" : "text-slate-500"
                      }`}
                    >
                      Mensalidade {item.price}
                    </p>
                  </div>
                  {item.featured ? (
                    <span className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                      Mais vendido
                    </span>
                  ) : null}
                </div>

                <p
                  className={`mt-8 text-xs font-black uppercase tracking-[0.14em] ${
                    item.featured ? "text-white/40" : "text-slate-400"
                  }`}
                >
                  Sua comissão
                </p>
                <p className="mt-2 text-5xl font-black tracking-[-0.06em]">
                  {item.commission}
                </p>
                <p
                  className={`mt-3 text-sm font-semibold leading-6 ${
                    item.featured ? "text-white/55" : "text-slate-500"
                  }`}
                >
                  {item.detail}
                </p>

                <div
                  className={`mt-6 rounded-2xl p-4 text-sm font-bold leading-6 ${
                    item.featured
                      ? "bg-white/8 text-white/65"
                      : "bg-[#f7f9fc] text-slate-500"
                  }`}
                >
                  O valor entra em retenção após o pagamento confirmado e fica disponível quando o período de segurança termina.
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="como-funciona"
        className="relative bg-white py-20 text-[#071b3a]"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <div className="partner-fade-up lg:sticky lg:top-28">
              <p className="text-xs font-black uppercase tracking-[0.17em] text-[#1359a5]">
                Caminho da comissão
              </p>
              <h2 className="mt-3 text-4xl font-black leading-[1] tracking-[-0.06em] sm:text-5xl">
                Do clique ao Pix, sem mistério.
              </h2>
              <p className="mt-5 text-base font-semibold leading-7 text-slate-500">
                Cada etapa tem um status próprio no painel. Você sabe o que ainda é previsão, o que está protegido e o que já pode ser recebido.
              </p>
            </div>

            <div className="grid gap-3">
              {flow.map((step, index) => (
                <article
                  key={step.number}
                  data-partner-card
                  className="partner-fade-up relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-[#f8faff] p-5 sm:p-6"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#05245c] text-sm font-black text-white shadow-lg shadow-blue-950/15">
                      {step.number}
                    </span>
                    <div>
                      <h3 className="text-xl font-black tracking-[-0.03em]">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm font-semibold leading-7 text-slate-500">
                        {step.text}
                      </p>
                    </div>
                  </div>

                  {index < flow.length - 1 ? (
                    <div className="absolute bottom-[-14px] left-[43px] h-7 w-px bg-blue-200" />
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[#eef3f9] py-20 text-[#071b3a]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#1359a5]">
              Portal completo
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[1] tracking-[-0.06em] sm:text-5xl">
              Tudo o que você precisa para indicar com organização.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {portalFeatures.map((feature, index) => (
              <article
                key={feature.title}
                data-partner-card
                className="partner-fade-up rounded-[1.7rem] border border-white bg-white p-5 shadow-sm"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-xl font-black text-[#05245c]">
                  {feature.icon}
                </span>
                <h3 className="mt-5 text-xl font-black tracking-[-0.03em]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
                  {feature.text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="seguranca"
        className="relative overflow-hidden bg-[#071b3a] py-20"
      >
        <div className="pointer-events-none absolute -right-40 -top-48 h-[520px] w-[520px] rounded-full bg-blue-500/22 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
          <div className="partner-fade-up">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
              Segurança financeira
            </p>
            <h2 className="mt-3 text-4xl font-black leading-[1] tracking-[-0.06em] sm:text-5xl">
              Bom para o parceiro. Sustentável para o Orçaly.
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-white/55">
              O programa foi criado para premiar vendas reais, não apenas cadastros. Por isso, pagamentos, estornos e vínculos suspeitos passam por validações.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {safeguards.map((item, index) => (
              <div
                key={item}
                className="partner-fade-up rounded-[1.4rem] border border-white/10 bg-white/[0.065] p-4"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-300 text-xs font-black text-[#071b3a]">
                    ✓
                  </span>
                  <p className="text-sm font-bold leading-6 text-white/68">
                    {item}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="duvidas"
        className="relative bg-white py-20 text-[#071b3a]"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-[#1359a5]">
              Perguntas frequentes
            </p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.06em] sm:text-5xl">
              O que importa antes de começar.
            </h2>
          </div>

          <div className="mt-10 grid gap-3">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="group rounded-[1.5rem] border border-slate-200 bg-[#f8faff] p-5 open:border-blue-200 open:bg-white open:shadow-lg open:shadow-blue-950/5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black">
                  {item.question}
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-50 text-lg text-[#05245c] transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-slate-500">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[#eef3f9] px-4 py-16 text-[#071b3a] sm:px-6">
        <div className="partner-fade-up mx-auto max-w-6xl overflow-hidden rounded-[2.3rem] bg-[#05245c] p-6 text-white shadow-2xl shadow-blue-950/20 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
                Comece com estrutura
              </p>
              <h2 className="mt-3 text-4xl font-black leading-[1] tracking-[-0.06em] sm:text-5xl">
                Seu link pode estar pronto hoje.
              </h2>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-white/58">
                Crie sua conta, cadastre a forma de recebimento e acompanhe tudo pelo portal. Sem planilhas paralelas, mensagens perdidas ou valores no “eu acho”.
              </p>
            </div>

            <Link
              href="/parceiros/cadastro"
              className="partner-shine rounded-2xl bg-white px-7 py-4 text-center text-sm font-black text-[#05245c] shadow-xl"
            >
              Criar minha conta
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/10 bg-[#04152f] py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm font-bold text-white/40 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>© 2026 Orçaly. Programa de parceiros.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/parceiros/termos" className="hover:text-white">
              Termos do programa
            </Link>
            <a href="mailto:orcalybr@gmail.com" className="hover:text-white">
              Suporte
            </a>
            <Link href="/" className="hover:text-white">
              Voltar ao Orçaly
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
