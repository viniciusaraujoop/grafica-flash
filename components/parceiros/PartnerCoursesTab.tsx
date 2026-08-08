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
              Nunca invente funcionalidades, resultados, descontos, urgência ou depoimentos. Uma venda clara traz cliente que permanece; uma venda manipulada só antecipa cancelamento e problema.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
