param(
    [switch]$Push = $true
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
} catch {}

$Root = "C:\Users\arauj\grafica-flash"
Set-Location -LiteralPath $Root

function Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Cmd([string]$Name) {
    foreach ($candidate in @("$Name.cmd", $Name)) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "Comando não encontrado: $Name"
}

function Run([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falhou: $Command $($Arguments -join ' ')"
    }
}

function Write-Utf8([string]$Path, [string]$Content) {
    $dir = Split-Path -Parent $Path
    if ($dir) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    [System.IO.File]::WriteAllText(
        $Path,
        $Content.TrimEnd("`r", "`n", " ", "`t") + "`n",
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$Git = Resolve-Cmd "git"
$Npm = Resolve-Cmd "npm"
$Npx = Resolve-Cmd "npx"

$branch = (& $Git branch --show-current).Trim()
if (-not $branch) {
    throw "Não foi possível identificar a branch atual."
}

# ----------------------------------------------------------------------
# 1. Finaliza, se necessário, o trabalho anterior que já está staged.
# ----------------------------------------------------------------------

Step "Conferindo staging pendente da etapa anterior"

$staged = @(& $Git diff --cached --name-only)

if ($staged.Count -gt 0) {
    $allowedPrevious = @(
        "app/api/marketplace/payments/webhook/asaas/route.ts",
        "app/api/payments/asaas/account/route.ts",
        "app/api/payments/asaas/account/status/route.ts",
        "app/painel/pagamentos/asaas/page.tsx",
        "components/painel/AsaasMarketplaceSetup.tsx",
        "lib/payments/asaas-config.ts",
        "lib/payments/asaas.ts",
        "lib/payments/checkout-service.ts"
    )

    $unexpected = @(
        $staged | Where-Object {
            $_ -notin $allowedPrevious
        }
    )

    if ($unexpected.Count -gt 0) {
        throw "Existem arquivos staged inesperados: $($unexpected -join ', '). Finalize-os antes para não misturar alterações."
    }

    $AsaasConfig = Join-Path $Root "lib/payments/asaas-config.ts"
    if (Test-Path -LiteralPath $AsaasConfig) {
        $asaasContent = [System.IO.File]::ReadAllText($AsaasConfig)
        Write-Utf8 $AsaasConfig $asaasContent
        Run $Git @("add", "--", "lib/payments/asaas-config.ts")
    }

    Run $Git @("diff", "--cached", "--check")

    Step "Finalizando taxa zero e remoção recente do Asaas"
    Run $Git @(
        "commit",
        "-m",
        "Pausa taxa do marketplace e remove migracao Asaas"
    )
}
else {
    Write-Host "Nenhuma alteração staged anterior pendente." -ForegroundColor DarkGray
}

# ----------------------------------------------------------------------
# 2. Centro de cursos
# ----------------------------------------------------------------------

$CoursesPath = Join-Path $Root "components/parceiros/PartnerCoursesTab.tsx"

$CoursesContent = @'
"use client";

import { useMemo, useState } from "react";

type Course = {
  id: string;
  category: string;
  title: string;
  duration: string;
  description: string;
  objectives: string[];
  lessons: string[];
  practice: string;
};

const courses: Course[] = [
  {
    id: "produto",
    category: "Produto",
    title: "Domine o Orçaly antes de vender",
    duration: "35 min",
    description:
      "Aprenda a explicar o sistema sem decorar um discurso. O foco é ligar cada recurso a um problema real do empreendedor.",
    objectives: [
      "Explicar a proposta de valor do Orçaly em menos de 60 segundos.",
      "Identificar quais áreas do sistema importam para cada tipo de empresa.",
      "Evitar promessas que o produto não faz.",
    ],
    lessons: [
      "O que o Orçaly resolve: centralização de site, catálogo, pedidos, clientes, financeiro e operação.",
      "Como apresentar o sistema por problema, e não por uma lista interminável de funções.",
      "Como descobrir o segmento e escolher quais telas mostrar primeiro.",
      "Como diferenciar demonstração, teste e contratação real.",
    ],
    practice:
      "Escolha três negócios diferentes e explique, em uma frase para cada um, qual problema do dia a dia o Orçaly ajudaria a organizar.",
  },
  {
    id: "consultiva",
    category: "Vendas",
    title: "Venda consultiva: diagnostique antes de oferecer",
    duration: "30 min",
    description:
      "Uma boa conversa comercial começa entendendo a operação do cliente. O sistema entra depois, como resposta ao que ele contou.",
    objectives: [
      "Fazer perguntas que revelem dor, urgência e impacto.",
      "Evitar apresentar recursos irrelevantes.",
      "Construir valor antes de falar de preço.",
    ],
    lessons: [
      "Perguntas de diagnóstico: como chegam os pedidos, como controlam clientes, como divulgam e onde perdem tempo.",
      "Perguntas de impacto: o que acontece quando um pedido se perde, um orçamento demora ou o cliente não recebe retorno.",
      "Como resumir a dor do cliente com as próprias palavras antes de apresentar a solução.",
      "Como conduzir a conversa sem transformar o atendimento em interrogatório.",
    ],
    practice:
      "Monte cinco perguntas de diagnóstico para um restaurante, uma gráfica ou uma assistência técnica e pratique a sequência em voz alta.",
  },
  {
    id: "psicologia",
    category: "Comportamento",
    title: "Psicologia de compra sem manipulação",
    duration: "30 min",
    description:
      "Entenda como clareza, risco percebido, confiança e prova influenciam decisões. Persuasão boa reduz dúvida; não fabrica medo.",
    objectives: [
      "Reconhecer o que aumenta ou reduz confiança.",
      "Apresentar benefícios de forma concreta.",
      "Usar prova e comparação sem exagero.",
    ],
    lessons: [
      "Risco percebido: quanto menos claro o próximo passo, maior a chance de o cliente adiar.",
      "Carga mental: demonstrações simples e ordenadas convencem melhor do que cinquenta recursos apresentados de uma vez.",
      "Prova: mostre a interface e exemplos de uso em vez de depender de adjetivos como 'revolucionário'.",
      "Coerência: adapte a apresentação ao que o cliente disse que precisa, não ao roteiro que você queria usar.",
    ],
    practice:
      "Pegue uma frase genérica como 'o Orçaly é muito completo' e transforme em três benefícios observáveis e específicos.",
  },
  {
    id: "presencial",
    category: "Abordagem",
    title: "Como falar com um possível cliente pessoalmente",
    duration: "25 min",
    description:
      "Uma abordagem presencial precisa ser curta, respeitosa e fácil de interromper. O objetivo inicial é ganhar permissão para continuar.",
    objectives: [
      "Abrir a conversa sem invadir o espaço do cliente.",
      "Criar uma apresentação de 30 segundos.",
      "Passar naturalmente da conversa para a demonstração.",
    ],
    lessons: [
      "Comece pelo contexto: mostre que você entende o tipo de negócio que está visitando.",
      "Peça permissão: 'Posso te mostrar em dois minutos uma forma de organizar isso?' é melhor do que monopolizar a conversa.",
      "Evite despejar preço e função antes de descobrir como a empresa trabalha.",
      "Se houver interesse, abra o demonstrativo e mostre apenas duas ou três telas ligadas à dor percebida.",
    ],
    practice:
      "Grave um áudio de 30 segundos simulando sua apresentação. Ouça e corte qualquer parte que pareça longa, vaga ou ensaiada demais.",
  },
  {
    id: "virtual",
    category: "Abordagem",
    title: "WhatsApp, Instagram e conversa virtual",
    duration: "30 min",
    description:
      "No digital, a primeira mensagem precisa parecer conversa, não disparo. Contexto e personalização importam mais do que texto enorme.",
    objectives: [
      "Escrever uma primeira mensagem curta.",
      "Conduzir a conversa sem spam.",
      "Saber quando enviar link, vídeo ou demonstração.",
    ],
    lessons: [
      "Primeiro contato: motivo claro, mensagem curta e uma pergunta simples.",
      "Evite mandar catálogo, preço, link e três áudios antes de a pessoa responder.",
      "Depois da resposta, faça uma pergunta de diagnóstico e conecte a dor a uma parte do sistema.",
      "Use o demonstrativo quando a pessoa quiser ver como funciona; use seu link de indicação quando ela quiser testar ou contratar.",
    ],
    practice:
      "Escreva uma mensagem inicial para um negócio que você realmente conhece. Depois reduza o texto pela metade sem perder o contexto.",
  },
  {
    id: "objecoes",
    category: "Fechamento",
    title: "Objeções, preço e fechamento",
    duration: "35 min",
    description:
      "Objeção não é convite para discutir. É informação sobre o que ainda não ficou claro para o cliente.",
    objectives: [
      "Separar dúvida real de falta de prioridade.",
      "Responder preço sem desvalorizar o produto.",
      "Encerrar a conversa com um próximo passo objetivo.",
    ],
    lessons: [
      "'Está caro': volte ao problema e compare o valor com o custo de continuar fazendo tudo separado ou manualmente.",
      "'Vou pensar': descubra o que exatamente a pessoa ainda precisa avaliar.",
      "'Já uso outro sistema': pergunte o que funciona bem e o que ainda incomoda antes de comparar.",
      "Fechamento: proponha uma ação pequena e concreta, como abrir o teste, cadastrar a empresa ou marcar uma demonstração.",
    ],
    practice:
      "Escolha três objeções que você mais teme ouvir e escreva respostas que começam com uma pergunta, não com uma defesa.",
  },
  {
    id: "persuasao",
    category: "Comunicação",
    title: "Persuasão ética e linguagem de valor",
    duration: "25 min",
    description:
      "Persuadir é organizar a informação para a pessoa decidir melhor. Escassez falsa, promessa inventada e pressão desnecessária só criam cliente arrependido.",
    objectives: [
      "Transformar função em benefício.",
      "Usar contraste e exemplos com honestidade.",
      "Evitar técnicas manipulativas.",
    ],
    lessons: [
      "Função → benefício → impacto: 'catálogo online' vira 'cliente encontra e escolhe sem depender de você responder cada item'.",
      "Contraste legítimo: compare processo atual e processo organizado, não invente concorrente pior.",
      "Especificidade gera confiança: exemplos concretos são melhores do que superlativos.",
      "Nunca use contagem regressiva falsa, depoimento inventado, preço fictício ou promessa de faturamento garantido.",
    ],
    practice:
      "Escolha cinco recursos do Orçaly e escreva cada um no formato função → benefício → impacto no trabalho do cliente.",
  },
  {
    id: "organico",
    category: "Aquisição",
    title: "Tráfego gratuito e prospecção orgânica",
    duration: "35 min",
    description:
      "Aprenda a encontrar pessoas certas sem depender de mídia paga: conteúdo, networking, indicação, grupos e abordagem contextual.",
    objectives: [
      "Criar uma rotina simples de prospecção.",
      "Produzir conteúdo baseado em dores reais.",
      "Usar o link de indicação sem parecer spam.",
    ],
    lessons: [
      "Liste nichos locais ou digitais em que você entende a rotina do negócio.",
      "Publique conteúdo útil: erros de organização, atendimento, pedidos e presença digital.",
      "Transforme conversas reais em temas para conteúdo, sem expor o cliente.",
      "Use o link de indicação depois de gerar interesse, não como primeira e única mensagem.",
    ],
    practice:
      "Planeje sete conteúdos curtos: três dores, dois antes/depois de processo, uma demonstração e um convite para teste.",
  },
  {
    id: "pago",
    category: "Aquisição",
    title: "Tráfego pago para parceiros",
    duration: "40 min",
    description:
      "Uma campanha simples precisa de público, mensagem, página e medição. Apertar 'impulsionar' sem hipótese costuma ser apenas uma doação para a plataforma de anúncios.",
    objectives: [
      "Montar uma campanha pequena e mensurável.",
      "Escolher uma promessa compatível com o produto.",
      "Separar teste de criativo, público e oferta.",
    ],
    lessons: [
      "Defina um nicho por campanha para que a mensagem fale com uma rotina específica.",
      "Criativo: mostre problema e interface; evite promessas de renda, economia garantida ou resultados impossíveis de comprovar.",
      "Destino: leve para uma página clara ou para seu link de indicação, mantendo a mensagem coerente com o anúncio.",
      "Teste com orçamento controlado, compare custo por conversa/cadastro e pause o que não traz sinal de intenção.",
    ],
    practice:
      "Escreva uma campanha para apenas um nicho com: público, problema, criativo, chamada e métrica que determinará se o teste continua.",
  },
  {
    id: "demo",
    category: "Demonstração",
    title: "Demonstração, follow-up e próximo passo",
    duration: "30 min",
    description:
      "A demonstração não deve ser um passeio por menus. Ela deve reproduzir uma pequena história de uso que o cliente reconhece.",
    objectives: [
      "Conduzir uma demo de cinco minutos.",
      "Escolher o que mostrar por segmento.",
      "Fazer follow-up com contexto.",
    ],
    lessons: [
      "Antes da demo, confirme a principal dor que a pessoa quer resolver.",
      "Mostre uma sequência: entrada do pedido → organização → acompanhamento → visão financeira ou operacional.",
      "Durante a demo, faça perguntas curtas para manter a conversa bilateral.",
      "No follow-up, relembre o problema discutido, o que foi mostrado e proponha um próximo passo simples.",
    ],
    practice:
      "Abra o demonstrativo do Portal de Parceiros e pratique uma apresentação de cinco minutos sem tentar mostrar todas as telas.",
  },
];

export default function PartnerCoursesTab() {
  const [selectedId, setSelectedId] = useState(courses[0].id);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const selected = useMemo(
    () => courses.find((course) => course.id === selectedId) || courses[0],
    [selectedId],
  );

  const progress = Math.round((completed.size / courses.length) * 100);

  function toggleCompleted(courseId: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  }

  return (
    <div className="partner-fade-up space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_280px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
              Academia do Parceiro
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Aprenda o produto, a conversa e a venda.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/58">
              Uma trilha prática para apresentar o Orçaly com segurança, entender o cliente e divulgar sem depender de improviso.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
            <div className="flex items-center justify-between text-xs font-black">
              <span>Progresso nesta sessão</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-xs font-bold text-white/45">
              {completed.size} de {courses.length} cursos marcados como concluídos.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <section className="rounded-[1.8rem] border border-white bg-white p-3 shadow-sm">
          <div className="px-3 py-3">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
              Trilha completa
            </p>
            <h2 className="mt-1 text-xl font-black text-[#071b3a]">
              10 cursos essenciais
            </h2>
          </div>

          <div className="grid gap-2">
            {courses.map((course, index) => {
              const active = course.id === selected.id;
              const done = completed.has(course.id);

              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => setSelectedId(course.id)}
                  className={`rounded-[1.2rem] border p-4 text-left transition ${
                    active
                      ? "border-[#05245c] bg-[#05245c] text-white shadow-lg"
                      : "border-slate-100 bg-[#f8faff] text-[#071b3a] hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${
                        active
                          ? "bg-white/15 text-white"
                          : done
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-white text-[#05245c]"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-[10px] font-black uppercase tracking-[0.13em] ${
                          active ? "text-cyan-200/70" : "text-slate-400"
                        }`}
                      >
                        {course.category} · {course.duration}
                      </span>
                      <strong className="mt-1 block text-sm leading-5">
                        {course.title}
                      </strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                {selected.category} · {selected.duration}
              </p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.045em] text-[#071b3a]">
                {selected.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                {selected.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => toggleCompleted(selected.id)}
              className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black transition ${
                completed.has(selected.id)
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[#05245c] text-white"
              }`}
            >
              {completed.has(selected.id)
                ? "✓ Concluído"
                : "Marcar como concluído"}
            </button>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <div className="rounded-[1.4rem] border border-blue-100 bg-[#f7faff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                O que você deve dominar
              </p>
              <ul className="mt-4 grid gap-3">
                {selected.objectives.map((objective) => (
                  <li
                    key={objective}
                    className="flex gap-3 text-sm font-semibold leading-6 text-slate-600"
                  >
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#05245c] text-[10px] font-black text-white">
                      ✓
                    </span>
                    {objective}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.4rem] border border-amber-100 bg-amber-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                Exercício prático
              </p>
              <p className="mt-4 text-sm font-bold leading-6 text-amber-950/75">
                {selected.practice}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Aulas do curso
            </p>
            <div className="mt-3 grid gap-3">
              {selected.lessons.map((lesson, index) => (
                <article
                  key={lesson}
                  className="rounded-[1.25rem] border border-slate-100 bg-[#fbfcfe] p-4"
                >
                  <div className="flex gap-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-xs font-black text-[#05245c]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Aula {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-650">
                        {lesson}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-emerald-100 bg-emerald-50 p-5">
            <p className="font-black text-emerald-800">
              Regra de ouro do parceiro
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-emerald-800/75">
              Nunca invente funcionalidades, resultados, descontos, urgência ou depoimentos. Uma venda clara traz cliente que permanece; uma venda manipulada só antecipa cancelamento e problema.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
'@

Write-Utf8 $CoursesPath $CoursesContent

# ----------------------------------------------------------------------
# 3. Central de divulgação
# ----------------------------------------------------------------------

$PromotionPath = Join-Path $Root "components/parceiros/PartnerPromotionTab.tsx"

$PromotionContent = @'
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
'@

Write-Utf8 $PromotionPath $PromotionContent

# ----------------------------------------------------------------------
# 4. Demonstrativo read-only
# ----------------------------------------------------------------------

$DemoComponentPath = Join-Path $Root "components/parceiros/PartnerSystemDemo.tsx"

$DemoComponentContent = @'
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type DemoTab = "overview" | "orders" | "products" | "clients" | "finance";

const nav: Array<{ id: DemoTab; label: string; icon: string }> = [
  { id: "overview", label: "Visão geral", icon: "⌂" },
  { id: "orders", label: "Pedidos", icon: "▤" },
  { id: "products", label: "Produtos", icon: "□" },
  { id: "clients", label: "Clientes", icon: "◎" },
  { id: "finance", label: "Financeiro", icon: "$" },
];

const orders = [
  { id: "#1048", customer: "Marina C.", value: "R$ 189,90", status: "Recebido", when: "há 4 min" },
  { id: "#1047", customer: "João R.", value: "R$ 74,50", status: "Em produção", when: "há 18 min" },
  { id: "#1046", customer: "Amanda S.", value: "R$ 248,00", status: "Pronto", when: "há 42 min" },
  { id: "#1045", customer: "Carlos M.", value: "R$ 119,90", status: "Entregue", when: "há 1 h" },
];

const products = [
  { name: "Kit promocional", category: "Mais vendido", price: "R$ 89,90", stock: "24 un." },
  { name: "Produto personalizado", category: "Sob encomenda", price: "R$ 149,90", stock: "Produção" },
  { name: "Pacote empresarial", category: "Serviço", price: "R$ 299,00", stock: "Disponível" },
  { name: "Item rápido", category: "Catálogo", price: "R$ 39,90", stock: "61 un." },
];

const clients = [
  { name: "Marina Costa", detail: "5 pedidos", value: "R$ 684,20", tag: "Recorrente" },
  { name: "João Rocha", detail: "2 pedidos", value: "R$ 218,40", tag: "Ativo" },
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
        AMBIENTE DE DEMONSTRAÇÃO · DADOS FICTÍCIOS · NENHUMA ALTERAÇÃO É SALVA
      </div>

      <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1550px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/parceiros">
            <Image
              src="/logo-orcaly.png"
              alt="Orçaly"
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
              Dados criados apenas para apresentação
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
              Botões e dados desta tela não atingem banco, pagamentos ou empresas reais.
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
                    Visão operacional
                  </p>
                  <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.055em] sm:text-4xl">
                    Bom dia. Sua empresa está em movimento.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/55">
                    A ideia do Orçaly é reunir as informações que o empreendedor normalmente espalha entre planilhas, mensagens e ferramentas diferentes.
                  </p>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Pedidos hoje" value="18" detail="+4 desde ontem" />
                <Metric label="Faturamento do dia" value="R$ 2.846" detail="dados ilustrativos" />
                <Metric label="Clientes ativos" value="327" detail="base organizada" />
                <Metric label="Pendências" value="6" detail="itens para acompanhar" />
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
                            {order.id} · {order.customer}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {order.when} · {order.status}
                          </p>
                        </div>
                        <p className="font-black text-[#05245c]">{order.value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.7rem] border border-white bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Fluxo da operação
                  </p>
                  <h2 className="mt-1 text-xl font-black">Do pedido ao acompanhamento</h2>

                  <div className="mt-5 grid gap-3">
                    {[
                      ["01", "Pedido recebido", "Cliente entra no fluxo organizado."],
                      ["02", "Equipe acompanha", "Status e informações ficam centralizados."],
                      ["03", "Cliente é registrado", "Histórico ajuda em novas vendas e atendimento."],
                      ["04", "Gestão enxerga", "Indicadores resumem a operação."],
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
                Demonstração: clicar, editar ou mudar status aqui não produz nenhuma alteração real.
              </div>
            </section>
          ) : null}

          {tab === "products" ? (
            <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
                Catálogo e produtos
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
                Histórico para atender melhor e vender novamente.
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
                          {client.detail} · {client.tag}
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
                  Uma visão simples do que entrou, saiu e está previsto.
                </h1>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Entradas do mês" value="R$ 24,8 mil" detail="dados fictícios" />
                  <Metric label="Saídas" value="R$ 9,4 mil" detail="custos demonstrativos" />
                  <Metric label="A receber" value="R$ 5,7 mil" detail="pedidos em aberto" />
                  <Metric label="Saldo projetado" value="R$ 15,4 mil" detail="exemplo visual" />
                </div>
              </section>

              <section className="rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
                <p className="font-black">Últimos lançamentos</p>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Pedido #1048", "Entrada", "+ R$ 189,90"],
                    ["Fornecedor de material", "Saída", "- R$ 420,00"],
                    ["Pedido #1046", "Entrada", "+ R$ 248,00"],
                    ["Serviço recorrente", "Saída", "- R$ 99,90"],
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
            Este ambiente é apenas um demonstrativo comercial do Orçaly. Todos os nomes, valores e operações exibidos são fictícios.
          </div>
        </section>
      </div>
    </main>
  );
}
'@

Write-Utf8 $DemoComponentPath $DemoComponentContent

$DemoPagePath = Join-Path $Root "app/parceiros/demo/page.tsx"

$DemoPageContent = @'
import type { Metadata } from "next";
import PartnerSystemDemo from "@/components/parceiros/PartnerSystemDemo";

export const metadata: Metadata = {
  title: "Demonstração Orçaly",
  description:
    "Ambiente demonstrativo e somente leitura do Orçaly para apresentações comerciais.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ParceirosDemoPage() {
  return <PartnerSystemDemo />;
}
'@

Write-Utf8 $DemoPagePath $DemoPageContent

# ----------------------------------------------------------------------
# 5. Integra Cursos e Divulgação no painel existente
# ----------------------------------------------------------------------

$PanelPath = Join-Path $Root "app/parceiros/painel/page.tsx"
$PanelContent = [System.IO.File]::ReadAllText($PanelPath)

$OldImports = @'
import { supabase } from "@/lib/supabase";
'@

$NewImports = @'
import { supabase } from "@/lib/supabase";
import PartnerCoursesTab from "@/components/parceiros/PartnerCoursesTab";
import PartnerPromotionTab from "@/components/parceiros/PartnerPromotionTab";
'@

if (-not $PanelContent.Contains($OldImports)) {
    throw "Não encontrei o ponto de importação esperado no painel de parceiros."
}

$PanelContent = $PanelContent.Replace($OldImports, $NewImports)

$OldTabType = @'
  const [tab, setTab] = useState<
    "overview" | "referrals" | "payments" | "ranking"
  >("overview");
'@

$NewTabType = @'
  const [tab, setTab] = useState<
    | "overview"
    | "referrals"
    | "courses"
    | "promotion"
    | "payments"
    | "ranking"
  >("overview");
'@

if (-not $PanelContent.Contains($OldTabType)) {
    throw "Não encontrei o tipo atual das abas no painel de parceiros."
}

$PanelContent = $PanelContent.Replace($OldTabType, $NewTabType)

$OldNav = @'
  const nav = [
    ["overview", "Visão geral"],
    ["referrals", "Indicações"],
    ["payments", "Pagamentos e Pix"],
    ["ranking", "Ranking"],
  ];
'@

$NewNav = @'
  const nav = [
    ["overview", "Visão geral"],
    ["referrals", "Indicações"],
    ["courses", "Cursos"],
    ["promotion", "Divulgação"],
    ["payments", "Pagamentos e Pix"],
    ["ranking", "Ranking"],
  ];
'@

if (-not $PanelContent.Contains($OldNav)) {
    throw "Não encontrei a navegação atual do painel de parceiros."
}

$PanelContent = $PanelContent.Replace($OldNav, $NewNav)

$PaymentMarker = @'
          {tab === "payments" ? (
'@

$NewTabs = @'
          {tab === "courses" ? (
            <PartnerCoursesTab />
          ) : null}

          {tab === "promotion" ? (
            <PartnerPromotionTab
              referralLink={dashboard.profile.referralLink}
              partnerName={dashboard.profile.name}
            />
          ) : null}

          {tab === "payments" ? (
'@

if (-not $PanelContent.Contains($PaymentMarker)) {
    throw "Não encontrei o ponto de inserção das novas abas."
}

$PanelContent = $PanelContent.Replace($PaymentMarker, $NewTabs)

Write-Utf8 $PanelPath $PanelContent

# ----------------------------------------------------------------------
# 6. Validações
# ----------------------------------------------------------------------

$Targets = @(
    "app/parceiros/painel/page.tsx",
    "app/parceiros/demo/page.tsx",
    "components/parceiros/PartnerCoursesTab.tsx",
    "components/parceiros/PartnerPromotionTab.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

Step "ESLint das novas áreas"
Run $Npx (@("eslint") + $Targets)

Step "Build completo"
Run $Npm @("run", "build")

Step "Validando diff"
Run $Git (@("diff", "--check", "--") + $Targets)

Write-Host ""
Write-Host "Resumo do Centro do Parceiro:" -ForegroundColor Yellow
& $Git --no-pager diff --stat -- $Targets

# ----------------------------------------------------------------------
# 7. Commit separado do Centro do Parceiro
# ----------------------------------------------------------------------

Step "Preparando commit do Centro do Parceiro"
Run $Git (@("add", "--") + $Targets)
Run $Git (@("diff", "--cached", "--check", "--") + $Targets)

Run $Git @(
    "commit",
    "-m",
    "Adiciona cursos divulgacao e demo aos parceiros",
    "--",
    "app/parceiros/painel/page.tsx",
    "app/parceiros/demo/page.tsx",
    "components/parceiros/PartnerCoursesTab.tsx",
    "components/parceiros/PartnerPromotionTab.tsx",
    "components/parceiros/PartnerSystemDemo.tsx"
)

if ($Push) {
    Step "Push"
    Run $Git @(
        "push",
        "-u",
        "origin",
        $branch
    )
}

Write-Host ""
Write-Host "ORCALY_PARTNER_ACADEMY_OK=1" -ForegroundColor Green
Write-Host "Novas abas: Cursos e Divulgação" -ForegroundColor Cyan
Write-Host "Demo: /parceiros/demo" -ForegroundColor Cyan
Write-Host "Dados do demo: 100% fictícios e somente leitura" -ForegroundColor Cyan
