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
    title: "Domine o OrÃ§aly antes de vender",
    duration: "35 min",
    description:
      "Aprenda a explicar o sistema sem decorar um discurso. O foco Ã© ligar cada recurso a um problema real do empreendedor.",
    objectives: [
      "Explicar a proposta de valor do OrÃ§aly em menos de 60 segundos.",
      "Identificar quais Ã¡reas do sistema importam para cada tipo de empresa.",
      "Evitar promessas que o produto nÃ£o faz.",
    ],
    lessons: [
      "O que o OrÃ§aly resolve: centralizaÃ§Ã£o de site, catÃ¡logo, pedidos, clientes, financeiro e operaÃ§Ã£o.",
      "Como apresentar o sistema por problema, e nÃ£o por uma lista interminÃ¡vel de funÃ§Ãµes.",
      "Como descobrir o segmento e escolher quais telas mostrar primeiro.",
      "Como diferenciar demonstraÃ§Ã£o, teste e contrataÃ§Ã£o real.",
    ],
    practice:
      "Escolha trÃªs negÃ³cios diferentes e explique, em uma frase para cada um, qual problema do dia a dia o OrÃ§aly ajudaria a organizar.",
  },
  {
    id: "consultiva",
    category: "Vendas",
    title: "Venda consultiva: diagnostique antes de oferecer",
    duration: "30 min",
    description:
      "Uma boa conversa comercial comeÃ§a entendendo a operaÃ§Ã£o do cliente. O sistema entra depois, como resposta ao que ele contou.",
    objectives: [
      "Fazer perguntas que revelem dor, urgÃªncia e impacto.",
      "Evitar apresentar recursos irrelevantes.",
      "Construir valor antes de falar de preÃ§o.",
    ],
    lessons: [
      "Perguntas de diagnÃ³stico: como chegam os pedidos, como controlam clientes, como divulgam e onde perdem tempo.",
      "Perguntas de impacto: o que acontece quando um pedido se perde, um orÃ§amento demora ou o cliente nÃ£o recebe retorno.",
      "Como resumir a dor do cliente com as prÃ³prias palavras antes de apresentar a soluÃ§Ã£o.",
      "Como conduzir a conversa sem transformar o atendimento em interrogatÃ³rio.",
    ],
    practice:
      "Monte cinco perguntas de diagnÃ³stico para um restaurante, uma grÃ¡fica ou uma assistÃªncia tÃ©cnica e pratique a sequÃªncia em voz alta.",
  },
  {
    id: "psicologia",
    category: "Comportamento",
    title: "Psicologia de compra sem manipulaÃ§Ã£o",
    duration: "30 min",
    description:
      "Entenda como clareza, risco percebido, confianÃ§a e prova influenciam decisÃµes. PersuasÃ£o boa reduz dÃºvida; nÃ£o fabrica medo.",
    objectives: [
      "Reconhecer o que aumenta ou reduz confianÃ§a.",
      "Apresentar benefÃ­cios de forma concreta.",
      "Usar prova e comparaÃ§Ã£o sem exagero.",
    ],
    lessons: [
      "Risco percebido: quanto menos claro o prÃ³ximo passo, maior a chance de o cliente adiar.",
      "Carga mental: demonstraÃ§Ãµes simples e ordenadas convencem melhor do que cinquenta recursos apresentados de uma vez.",
      "Prova: mostre a interface e exemplos de uso em vez de depender de adjetivos como 'revolucionÃ¡rio'.",
      "CoerÃªncia: adapte a apresentaÃ§Ã£o ao que o cliente disse que precisa, nÃ£o ao roteiro que vocÃª queria usar.",
    ],
    practice:
      "Pegue uma frase genÃ©rica como 'o OrÃ§aly Ã© muito completo' e transforme em trÃªs benefÃ­cios observÃ¡veis e especÃ­ficos.",
  },
  {
    id: "presencial",
    category: "Abordagem",
    title: "Como falar com um possÃ­vel cliente pessoalmente",
    duration: "25 min",
    description:
      "Uma abordagem presencial precisa ser curta, respeitosa e fÃ¡cil de interromper. O objetivo inicial Ã© ganhar permissÃ£o para continuar.",
    objectives: [
      "Abrir a conversa sem invadir o espaÃ§o do cliente.",
      "Criar uma apresentaÃ§Ã£o de 30 segundos.",
      "Passar naturalmente da conversa para a demonstraÃ§Ã£o.",
    ],
    lessons: [
      "Comece pelo contexto: mostre que vocÃª entende o tipo de negÃ³cio que estÃ¡ visitando.",
      "PeÃ§a permissÃ£o: 'Posso te mostrar em dois minutos uma forma de organizar isso?' Ã© melhor do que monopolizar a conversa.",
      "Evite despejar preÃ§o e funÃ§Ã£o antes de descobrir como a empresa trabalha.",
      "Se houver interesse, abra o demonstrativo e mostre apenas duas ou trÃªs telas ligadas Ã  dor percebida.",
    ],
    practice:
      "Grave um Ã¡udio de 30 segundos simulando sua apresentaÃ§Ã£o. OuÃ§a e corte qualquer parte que pareÃ§a longa, vaga ou ensaiada demais.",
  },
  {
    id: "virtual",
    category: "Abordagem",
    title: "WhatsApp, Instagram e conversa virtual",
    duration: "30 min",
    description:
      "No digital, a primeira mensagem precisa parecer conversa, nÃ£o disparo. Contexto e personalizaÃ§Ã£o importam mais do que texto enorme.",
    objectives: [
      "Escrever uma primeira mensagem curta.",
      "Conduzir a conversa sem spam.",
      "Saber quando enviar link, vÃ­deo ou demonstraÃ§Ã£o.",
    ],
    lessons: [
      "Primeiro contato: motivo claro, mensagem curta e uma pergunta simples.",
      "Evite mandar catÃ¡logo, preÃ§o, link e trÃªs Ã¡udios antes de a pessoa responder.",
      "Depois da resposta, faÃ§a uma pergunta de diagnÃ³stico e conecte a dor a uma parte do sistema.",
      "Use o demonstrativo quando a pessoa quiser ver como funciona; use seu link de indicaÃ§Ã£o quando ela quiser testar ou contratar.",
    ],
    practice:
      "Escreva uma mensagem inicial para um negÃ³cio que vocÃª realmente conhece. Depois reduza o texto pela metade sem perder o contexto.",
  },
  {
    id: "objecoes",
    category: "Fechamento",
    title: "ObjeÃ§Ãµes, preÃ§o e fechamento",
    duration: "35 min",
    description:
      "ObjeÃ§Ã£o nÃ£o Ã© convite para discutir. Ã‰ informaÃ§Ã£o sobre o que ainda nÃ£o ficou claro para o cliente.",
    objectives: [
      "Separar dÃºvida real de falta de prioridade.",
      "Responder preÃ§o sem desvalorizar o produto.",
      "Encerrar a conversa com um prÃ³ximo passo objetivo.",
    ],
    lessons: [
      "'EstÃ¡ caro': volte ao problema e compare o valor com o custo de continuar fazendo tudo separado ou manualmente.",
      "'Vou pensar': descubra o que exatamente a pessoa ainda precisa avaliar.",
      "'JÃ¡ uso outro sistema': pergunte o que funciona bem e o que ainda incomoda antes de comparar.",
      "Fechamento: proponha uma aÃ§Ã£o pequena e concreta, como abrir o teste, cadastrar a empresa ou marcar uma demonstraÃ§Ã£o.",
    ],
    practice:
      "Escolha trÃªs objeÃ§Ãµes que vocÃª mais teme ouvir e escreva respostas que comeÃ§am com uma pergunta, nÃ£o com uma defesa.",
  },
  {
    id: "persuasao",
    category: "ComunicaÃ§Ã£o",
    title: "PersuasÃ£o Ã©tica e linguagem de valor",
    duration: "25 min",
    description:
      "Persuadir Ã© organizar a informaÃ§Ã£o para a pessoa decidir melhor. Escassez falsa, promessa inventada e pressÃ£o desnecessÃ¡ria sÃ³ criam cliente arrependido.",
    objectives: [
      "Transformar funÃ§Ã£o em benefÃ­cio.",
      "Usar contraste e exemplos com honestidade.",
      "Evitar tÃ©cnicas manipulativas.",
    ],
    lessons: [
      "FunÃ§Ã£o â†’ benefÃ­cio â†’ impacto: 'catÃ¡logo online' vira 'cliente encontra e escolhe sem depender de vocÃª responder cada item'.",
      "Contraste legÃ­timo: compare processo atual e processo organizado, nÃ£o invente concorrente pior.",
      "Especificidade gera confianÃ§a: exemplos concretos sÃ£o melhores do que superlativos.",
      "Nunca use contagem regressiva falsa, depoimento inventado, preÃ§o fictÃ­cio ou promessa de faturamento garantido.",
    ],
    practice:
      "Escolha cinco recursos do OrÃ§aly e escreva cada um no formato funÃ§Ã£o â†’ benefÃ­cio â†’ impacto no trabalho do cliente.",
  },
  {
    id: "organico",
    category: "AquisiÃ§Ã£o",
    title: "TrÃ¡fego gratuito e prospecÃ§Ã£o orgÃ¢nica",
    duration: "35 min",
    description:
      "Aprenda a encontrar pessoas certas sem depender de mÃ­dia paga: conteÃºdo, networking, indicaÃ§Ã£o, grupos e abordagem contextual.",
    objectives: [
      "Criar uma rotina simples de prospecÃ§Ã£o.",
      "Produzir conteÃºdo baseado em dores reais.",
      "Usar o link de indicaÃ§Ã£o sem parecer spam.",
    ],
    lessons: [
      "Liste nichos locais ou digitais em que vocÃª entende a rotina do negÃ³cio.",
      "Publique conteÃºdo Ãºtil: erros de organizaÃ§Ã£o, atendimento, pedidos e presenÃ§a digital.",
      "Transforme conversas reais em temas para conteÃºdo, sem expor o cliente.",
      "Use o link de indicaÃ§Ã£o depois de gerar interesse, nÃ£o como primeira e Ãºnica mensagem.",
    ],
    practice:
      "Planeje sete conteÃºdos curtos: trÃªs dores, dois antes/depois de processo, uma demonstraÃ§Ã£o e um convite para teste.",
  },
  {
    id: "pago",
    category: "AquisiÃ§Ã£o",
    title: "TrÃ¡fego pago para parceiros",
    duration: "40 min",
    description:
      "Uma campanha simples precisa de pÃºblico, mensagem, pÃ¡gina e mediÃ§Ã£o. Apertar 'impulsionar' sem hipÃ³tese costuma ser apenas uma doaÃ§Ã£o para a plataforma de anÃºncios.",
    objectives: [
      "Montar uma campanha pequena e mensurÃ¡vel.",
      "Escolher uma promessa compatÃ­vel com o produto.",
      "Separar teste de criativo, pÃºblico e oferta.",
    ],
    lessons: [
      "Defina um nicho por campanha para que a mensagem fale com uma rotina especÃ­fica.",
      "Criativo: mostre problema e interface; evite promessas de renda, economia garantida ou resultados impossÃ­veis de comprovar.",
      "Destino: leve para uma pÃ¡gina clara ou para seu link de indicaÃ§Ã£o, mantendo a mensagem coerente com o anÃºncio.",
      "Teste com orÃ§amento controlado, compare custo por conversa/cadastro e pause o que nÃ£o traz sinal de intenÃ§Ã£o.",
    ],
    practice:
      "Escreva uma campanha para apenas um nicho com: pÃºblico, problema, criativo, chamada e mÃ©trica que determinarÃ¡ se o teste continua.",
  },
  {
    id: "demo",
    category: "DemonstraÃ§Ã£o",
    title: "DemonstraÃ§Ã£o, follow-up e prÃ³ximo passo",
    duration: "30 min",
    description:
      "A demonstraÃ§Ã£o nÃ£o deve ser um passeio por menus. Ela deve reproduzir uma pequena histÃ³ria de uso que o cliente reconhece.",
    objectives: [
      "Conduzir uma demo de cinco minutos.",
      "Escolher o que mostrar por segmento.",
      "Fazer follow-up com contexto.",
    ],
    lessons: [
      "Antes da demo, confirme a principal dor que a pessoa quer resolver.",
      "Mostre uma sequÃªncia: entrada do pedido â†’ organizaÃ§Ã£o â†’ acompanhamento â†’ visÃ£o financeira ou operacional.",
      "Durante a demo, faÃ§a perguntas curtas para manter a conversa bilateral.",
      "No follow-up, relembre o problema discutido, o que foi mostrado e proponha um prÃ³ximo passo simples.",
    ],
    practice:
      "Abra o demonstrativo do Portal de Parceiros e pratique uma apresentaÃ§Ã£o de cinco minutos sem tentar mostrar todas as telas.",
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
              Uma trilha prÃ¡tica para apresentar o OrÃ§aly com seguranÃ§a, entender o cliente e divulgar sem depender de improviso.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
            <div className="flex items-center justify-between text-xs font-black">
              <span>Progresso nesta sessÃ£o</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-3 text-xs font-bold text-white/45">
              {completed.size} de {courses.length} cursos marcados como concluÃ­dos.
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
                      {done ? "âœ“" : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-[10px] font-black uppercase tracking-[0.13em] ${
                          active ? "text-cyan-200/70" : "text-slate-400"
                        }`}
                      >
                        {course.category} Â· {course.duration}
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
                {selected.category} Â· {selected.duration}
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
                ? "âœ“ ConcluÃ­do"
                : "Marcar como concluÃ­do"}
            </button>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <div className="rounded-[1.4rem] border border-blue-100 bg-[#f7faff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                O que vocÃª deve dominar
              </p>
              <ul className="mt-4 grid gap-3">
                {selected.objectives.map((objective) => (
                  <li
                    key={objective}
                    className="flex gap-3 text-sm font-semibold leading-6 text-slate-600"
                  >
                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#05245c] text-[10px] font-black text-white">
                      âœ“
                    </span>
                    {objective}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.4rem] border border-amber-100 bg-amber-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                ExercÃ­cio prÃ¡tico
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
                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
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
              Nunca invente funcionalidades, resultados, descontos, urgÃªncia ou depoimentos. Uma venda clara traz cliente que permanece; uma venda manipulada sÃ³ antecipa cancelamento e problema.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
