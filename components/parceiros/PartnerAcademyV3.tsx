"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import PartnerCoursesTab from "@/components/parceiros/PartnerCoursesTab";

type QuizQuestion = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};

type GuidedLesson = {
  id: string;
  title: string;
  minutes: number;
  promise: string;
  why: string;
  bullets: string[];
  formula: string;
  example: string;
  mission: string;
  missionPlaceholder: string;
  quiz: QuizQuestion[];
};

type Track = {
  id: string;
  emoji: string;
  label: string;
  title: string;
  description: string;
  lessons: GuidedLesson[];
};

type AcademyState = {
  selectedTrackId: string;
  lessonIndex: number;
  completedIds: string[];
  missionAnswers: Record<string, string>;
  quizScores: Record<string, number>;
  quizAnswers: Record<string, number[]>;
};

const STORAGE_KEY =
  "orcaly-partner-academy-guided-v3";

const tracks: Track[] = [
  {
    id: "v3-vendas",
    emoji: "⚡",
    label: "Sprint comercial",
    title: "Venda com clareza, método e confiança",
    description:
      "Uma trilha prática para transformar conversa em diagnóstico, valor, demonstração, objeção e próximo passo.",
    lessons: [
      {
        id: "v3-vendas-atencao",
        title: "Ganhe atenção sem parecer vendedor genérico",
        minutes: 5,
        promise:
          "Em poucos minutos você vai conseguir abrir uma conversa sem despejar link, preço ou apresentação pronta.",
        why:
          "A primeira missão não é vender. É conquistar permissão para continuar a conversa. Quando a abertura exige esforço demais do cliente, ele ignora antes de entender a proposta.",
        bullets: [
          "Contexto vence mensagem genérica: mostre por que você escolheu falar com aquele negócio.",
          "Uma pergunta fácil reduz o esforço de resposta.",
          "Não tente explicar o Orçaly inteiro na primeira mensagem.",
        ],
        formula:
          "Contexto real → pergunta simples → escuta → próximo passo",
        example:
          "“Oi, Ana! Vi que vocês trabalham com encomendas pelo Instagram. Hoje vocês organizam os pedidos mais pelo direct ou pelo WhatsApp?”",
        mission:
          "Escreva uma primeira mensagem para um negócio real. Máximo de 220 caracteres e sem colocar link.",
        missionPlaceholder:
          "Ex.: Oi, Carlos! Vi a oficina de vocês...",
        quiz: [
          {
            prompt:
              "Qual é o principal objetivo da primeira mensagem?",
            options: [
              "Explicar todos os recursos.",
              "Conseguir permissão para continuar a conversa.",
              "Enviar o link de indicação.",
              "Fechar a assinatura.",
            ],
            answer: 1,
            explanation:
              "A abertura serve para iniciar uma conversa relevante. Venda vem depois de contexto e entendimento.",
          },
          {
            prompt:
              "Qual abordagem tende a exigir menos esforço do cliente?",
            options: [
              "Um áudio de quatro minutos.",
              "Um texto com dez benefícios.",
              "Uma pergunta curta sobre a rotina atual.",
              "Uma tabela com todos os planos.",
            ],
            answer: 2,
            explanation:
              "Perguntas curtas e específicas facilitam a resposta e geram informação útil.",
          },
          {
            prompt:
              "Quando o link de indicação faz mais sentido?",
            options: [
              "Sempre na primeira frase.",
              "Depois que existe contexto ou interesse.",
              "Em qualquer grupo público.",
              "Antes de perguntar o nome.",
            ],
            answer: 1,
            explanation:
              "O link funciona melhor quando a pessoa já sabe por que deveria clicar.",
          },
        ],
      },
      {
        id: "v3-vendas-diagnostico",
        title: "Diagnóstico: descubra a dor antes da solução",
        minutes: 6,
        promise:
          "Você vai aprender a fazer perguntas que revelam processo, problema, consequência e prioridade.",
        why:
          "O mesmo sistema pode ser comprado por motivos diferentes. Quem diagnostica bem evita mostrar recursos irrelevantes e faz o cliente se sentir compreendido.",
        bullets: [
          "Comece por “como funciona hoje?”, não por “você tem problema?”.",
          "Aprofunde a consequência: tempo perdido, retrabalho, esquecimento ou falta de visão.",
          "Confirme prioridade antes de apresentar solução.",
        ],
        formula:
          "Processo atual → atrito → consequência → prioridade",
        example:
          "“Como vocês sabem em que etapa está cada pedido?” → “Quando alguém esquece de atualizar, o que acontece?” → “Isso acontece com frequência?”",
        mission:
          "Crie quatro perguntas para um segmento que você quer prospectar: uma de processo, uma de problema, uma de consequência e uma de prioridade.",
        missionPlaceholder:
          "Processo: Como vocês...\nProblema: Onde costuma...",
        quiz: [
          {
            prompt:
              "Qual pergunta gera mais contexto?",
            options: [
              "Você precisa de um sistema?",
              "Seu processo é desorganizado?",
              "Como vocês acompanham os pedidos hoje?",
              "Você quer economizar dinheiro?",
            ],
            answer: 2,
            explanation:
              "Perguntas abertas sobre processo produzem informação concreta sem empurrar uma resposta.",
          },
          {
            prompt:
              "Depois de descobrir um problema, o que vem antes de mostrar o produto?",
            options: [
              "Perguntar pela consequência e prioridade.",
              "Mostrar o preço.",
              "Enviar um depoimento.",
              "Oferecer desconto.",
            ],
            answer: 0,
            explanation:
              "Entender consequência e prioridade mostra se aquela dor realmente merece atenção agora.",
          },
          {
            prompt:
              "Diagnóstico bom parece:",
            options: [
              "Interrogatório com dez perguntas seguidas.",
              "Conversa em que pergunta, escuta e resumo se alternam.",
              "Roteiro decorado sem adaptação.",
              "Apresentação longa.",
            ],
            answer: 1,
            explanation:
              "O ritmo precisa parecer conversa. A pessoa fala, você entende, resume e aprofunda.",
          },
        ],
      },
      {
        id: "v3-vendas-valor",
        title: "Transforme recurso em valor percebido",
        minutes: 5,
        promise:
          "Você vai parar de vender “menus e funções” e começar a explicar mudanças concretas na rotina.",
        why:
          "Funções informam. Consequências ajudam a pessoa a visualizar por que aquilo importa para ela.",
        bullets: [
          "Função é o que existe.",
          "Benefício é o que fica mais fácil.",
          "Impacto é como isso melhora uma situação real daquele cliente.",
        ],
        formula:
          "Função → benefício → impacto na rotina",
        example:
          "“Pedidos com status” → “a equipe sabe onde cada pedido está” → “o cliente deixa de depender de procurar mensagens antigas para descobrir andamento”.",
        mission:
          "Escolha três recursos do Orçaly e transforme cada um em função → benefício → impacto.",
        missionPlaceholder:
          "1. Função: ... | Benefício: ... | Impacto: ...",
        quiz: [
          {
            prompt:
              "Qual frase comunica melhor valor?",
            options: [
              "Temos CRM.",
              "Nosso CRM é incrível.",
              "O CRM concentra histórico e próximos contatos para a equipe depender menos da memória.",
              "Todo negócio precisa de CRM.",
            ],
            answer: 2,
            explanation:
              "Ela conecta função a uma consequência operacional concreta sem exagerar.",
          },
          {
            prompt:
              "O impacto deve ser baseado em:",
            options: [
              "Promessas genéricas.",
              "Contexto e dados que o cliente forneceu.",
              "Frases de concorrentes.",
              "Estimativas inventadas.",
            ],
            answer: 1,
            explanation:
              "Valor convincente nasce do contexto real, não de promessas que você não consegue provar.",
          },
          {
            prompt:
              "Excesso de recursos na apresentação costuma:",
            options: [
              "Aumentar clareza sempre.",
              "Reduzir carga mental.",
              "Aumentar carga mental e dispersar atenção.",
              "Garantir fechamento.",
            ],
            answer: 2,
            explanation:
              "Mostrar apenas o necessário preserva atenção e relevância.",
          },
        ],
      },
      {
        id: "v3-vendas-objecao",
        title: "Objeções sem confronto e sem desconto automático",
        minutes: 6,
        promise:
          "Você vai aprender a tratar “está caro”, “vou pensar” e “não sei” como informação, não como duelo.",
        why:
          "A frase que o cliente fala pode esconder motivos diferentes. Rebater cedo demais significa responder ao problema errado.",
        bullets: [
          "Acolha primeiro, investigue depois.",
          "Descubra a referência usada na comparação.",
          "Responda ao motivo real, não à frase superficial.",
        ],
        formula:
          "Acolher → investigar → esclarecer → combinar próximo passo",
        example:
          "“Entendo. Quando você diz caro, está comparando com outra ferramenta ou com o orçamento que separou para isso?”",
        mission:
          "Escreva uma resposta para “vou pensar” que não pressione e termine com uma pergunta útil.",
        missionPlaceholder:
          "Ex.: Tranquilo. O que você ainda precisa avaliar...",
        quiz: [
          {
            prompt:
              "Cliente diz “está caro”. Melhor primeira reação:",
            options: [
              "Dar desconto.",
              "Perguntar o que está pesando na comparação.",
              "Defender o preço imediatamente.",
              "Criar urgência.",
            ],
            answer: 1,
            explanation:
              "Você precisa descobrir se a objeção é orçamento, valor percebido, comparação ou prioridade.",
          },
          {
            prompt:
              "Qual comportamento destrói confiança?",
            options: [
              "Reconhecer uma limitação relevante.",
              "Fazer pergunta de esclarecimento.",
              "Inventar urgência que não existe.",
              "Resumir a dúvida do cliente.",
            ],
            answer: 2,
            explanation:
              "Urgência falsa pode gerar decisão ruim, arrependimento e perda de reputação.",
          },
          {
            prompt:
              "Uma objeção deve ser tratada como:",
            options: [
              "Ataque pessoal.",
              "Informação sobre a decisão.",
              "Sinal para encerrar sempre.",
              "Convite para insistir.",
            ],
            answer: 1,
            explanation:
              "Objeções revelam o que ainda impede a decisão e ajudam a orientar a conversa.",
          },
        ],
      },
      {
        id: "v3-vendas-fechamento",
        title: "Feche com um próximo passo, não com pressão",
        minutes: 5,
        promise:
          "Você vai sair de conversas vagas e terminar cada contato sabendo qual é a próxima ação.",
        why:
          "Fechamento não significa necessariamente compra. Significa transformar a conversa em uma decisão ou próximo passo claro.",
        bullets: [
          "Resuma o que ficou alinhado.",
          "Cheque dúvidas pendentes.",
          "Proponha uma ação específica e pequena.",
        ],
        formula:
          "Resumo → dúvida → próximo passo → data ou ação",
        example:
          "“Faz sentido eu te mandar o resumo dessas duas partes e amanhã a gente vê se vale testar com um pedido real?”",
        mission:
          "Escreva três finais de conversa: após interesse, após dúvida e após um “não agora”.",
        missionPlaceholder:
          "Interesse: ...\nDúvida: ...\nNão agora: ...",
        quiz: [
          {
            prompt:
              "Qual é um bom próximo passo?",
            options: [
              "“Qualquer coisa me chama.”",
              "“Vamos marcar 15 minutos amanhã para testar o fluxo de pedidos?”",
              "“Decida hoje.”",
              "“Vou mandar mensagem todo dia.”",
            ],
            answer: 1,
            explanation:
              "Próximos passos específicos reduzem ambiguidade sem pressionar.",
          },
          {
            prompt:
              "Se a pessoa precisa falar com o sócio:",
            options: [
              "Pressione para decidir sozinha.",
              "Ignore e mande cobrança amanhã.",
              "Ofereça resumo ou conversa curta com os dois.",
              "Dê desconto imediato.",
            ],
            answer: 2,
            explanation:
              "Você facilita o processo de decisão sem atropelar quem precisa participar.",
          },
          {
            prompt:
              "Nem toda conversa boa termina em:",
            options: [
              "Próximo passo.",
              "Compra imediata.",
              "Clareza.",
              "Resumo.",
            ],
            answer: 1,
            explanation:
              "Uma venda consultiva respeita o tempo da decisão. O objetivo é progresso claro, não compra forçada.",
          },
        ],
      },
    ],
  },
  {
    id: "v3-pessoal",
    emoji: "🧠",
    label: "Desenvolvimento pessoal",
    title: "Disciplina, confiança e cabeça forte para vender",
    description:
      "Treine competências pessoais que sustentam resultado comercial: foco, consistência, comunicação e tolerância à rejeição.",
    lessons: [
      {
        id: "v3-pessoal-consistencia",
        title: "Consistência vence explosões de motivação",
        minutes: 5,
        promise:
          "Você vai montar uma rotina pequena o suficiente para repetir mesmo em dias ruins.",
        why:
          "Resultados comerciais acumulam. Uma rotina curta e repetível costuma ser mais útil do que um dia intenso seguido de abandono.",
        bullets: [
          "Reduza a meta até ela caber num dia comum.",
          "Meça comportamento controlável: contatos, estudos e follow-ups.",
          "Aumente volume só depois de estabilizar a rotina.",
        ],
        formula:
          "Pequeno → repetível → medido → melhorado",
        example:
          "Em vez de “vou vender muito hoje”, use “vou iniciar 5 conversas qualificadas e registrar cada uma”.",
        mission:
          "Defina sua rotina mínima de vendas para um dia comum. Precisa caber em no máximo 30 minutos.",
        missionPlaceholder:
          "Minha rotina mínima: 5 contatos + 1 follow-up + 5 min de treino...",
        quiz: [
          {
            prompt:
              "Qual meta é mais controlável?",
            options: [
              "Fechar três vendas hoje.",
              "Ser o melhor vendedor.",
              "Iniciar cinco conversas qualificadas.",
              "Fazer todo mundo responder.",
            ],
            answer: 2,
            explanation:
              "Você controla suas ações, não a decisão final das outras pessoas.",
          },
          {
            prompt:
              "Uma rotina sustentável começa:",
            options: [
              "No volume máximo possível.",
              "Pequena o bastante para repetir.",
              "Somente quando há motivação.",
              "Com metas financeiras enormes.",
            ],
            answer: 1,
            explanation:
              "Repetição cria base. Intensidade sem continuidade costuma desaparecer rápido.",
          },
          {
            prompt:
              "Depois de estabilizar a rotina, você deve:",
            options: [
              "Parar de medir.",
              "Aumentar gradualmente e observar resultado.",
              "Trocar tudo.",
              "Depender de sorte.",
            ],
            answer: 1,
            explanation:
              "Melhorias graduais preservam consistência e deixam claro o que realmente funcionou.",
          },
        ],
      },
      {
        id: "v3-pessoal-rejeicao",
        title: "Rejeição é dado, não identidade",
        minutes: 6,
        promise:
          "Você vai aprender a separar um “não” comercial do seu valor pessoal.",
        why:
          "Vendas envolvem timing, orçamento, prioridade e adequação. Interpretar cada recusa como fracasso pessoal desgasta energia e piora a próxima conversa.",
        bullets: [
          "Um não pode ser sobre prioridade, não sobre você.",
          "Registre padrões em vez de remoer casos isolados.",
          "Revise o que era controlável e siga para a próxima ação.",
        ],
        formula:
          "Resultado → aprendizado → ajuste → próxima tentativa",
        example:
          "Após um não, registre: motivo informado, pergunta que funcionou, ponto confuso e próxima melhoria.",
        mission:
          "Escreva uma resposta profissional para um cliente que recusou e depois anote uma coisa que você pode aprender sem se atacar.",
        missionPlaceholder:
          "Resposta ao cliente: ...\nAprendizado: ...",
        quiz: [
          {
            prompt:
              "Um “não” comercial significa necessariamente:",
            options: [
              "Que você é ruim.",
              "Que a pessoa nunca comprará nada.",
              "Que aquela decisão não avançou naquele contexto.",
              "Que você deve insistir.",
            ],
            answer: 2,
            explanation:
              "Decisões dependem de contexto. Separar resultado de identidade ajuda a manter qualidade na próxima conversa.",
          },
          {
            prompt:
              "Depois de uma rejeição, o melhor foco é:",
            options: [
              "Se culpar.",
              "Procurar padrão e ação controlável.",
              "Discutir com o cliente.",
              "Parar de prospectar.",
            ],
            answer: 1,
            explanation:
              "Aprendizado útil nasce de fatos e comportamentos que você consegue ajustar.",
          },
          {
            prompt:
              "Qual resposta preserva relação?",
            options: [
              "“Você está perdendo uma oportunidade.”",
              "“Tudo bem. Obrigado pela sinceridade. Se o cenário mudar, fico à disposição.”",
              "“Qual é seu problema?”",
              "“Vou te chamar amanhã.”",
            ],
            answer: 1,
            explanation:
              "Respeito mantém reputação e deixa a porta aberta sem pressão.",
          },
        ],
      },
      {
        id: "v3-pessoal-foco",
        title: "Foco curto para quem perde energia com texto longo",
        minutes: 5,
        promise:
          "Você vai usar blocos curtos de execução para reduzir atrito e começar mais rápido.",
        why:
          "Quando uma tarefa parece grande, começar custa mais energia. Dividir em um bloco pequeno reduz a barreira de entrada e cria um fim visível.",
        bullets: [
          "Escolha uma única tarefa por bloco.",
          "Use 5 a 15 minutos, não uma sessão infinita.",
          "Pare, marque progresso e escolha conscientemente o próximo bloco.",
        ],
        formula:
          "Uma tarefa → tempo curto → conclusão visível → pausa",
        example:
          "Bloco de 10 minutos: pesquisar 3 negócios e preparar 3 primeiras mensagens. Nada de abrir CRM, anúncio e curso ao mesmo tempo.",
        mission:
          "Defina agora um bloco de 10 minutos com uma única tarefa comercial e um resultado observável.",
        missionPlaceholder:
          "Nos próximos 10 minutos eu vou...",
        quiz: [
          {
            prompt:
              "O que mais protege o foco?",
            options: [
              "Três tarefas simultâneas.",
              "Uma tarefa com final claro.",
              "Abrir todas as abas.",
              "Esperar vontade.",
            ],
            answer: 1,
            explanation:
              "Um objetivo observável reduz decisões durante a execução.",
          },
          {
            prompt:
              "Blocos curtos servem para:",
            options: [
              "Evitar qualquer tarefa difícil.",
              "Reduzir a barreira de começar e manter clareza.",
              "Trabalhar menos sempre.",
              "Eliminar pausas.",
            ],
            answer: 1,
            explanation:
              "O objetivo é facilitar início e execução, não fugir de trabalho importante.",
          },
          {
            prompt:
              "Ao terminar um bloco, faça:",
            options: [
              "Abra cinco tarefas novas.",
              "Marque o que avançou e decida o próximo passo.",
              "Ignore o progresso.",
              "Continue sem limite.",
            ],
            answer: 1,
            explanation:
              "Fechar o ciclo ajuda a perceber avanço e evita que tudo vire uma tarefa interminável.",
          },
        ],
      },
      {
        id: "v3-pessoal-comunicacao",
        title: "Presença: fale menos e comunique melhor",
        minutes: 6,
        promise:
          "Você vai treinar clareza, ritmo e segurança sem precisar fingir uma personalidade de vendedor.",
        why:
          "Confiança percebida vem muito mais de clareza e domínio do assunto do que de falar rápido ou parecer extrovertido.",
        bullets: [
          "Frases curtas deixam o raciocínio mais fácil de acompanhar.",
          "Pausa é ferramenta, não falha.",
          "Se não souber algo, diga que vai confirmar em vez de inventar.",
        ],
        formula:
          "Ponto principal → exemplo → pergunta → silêncio",
        example:
          "Explique um benefício em duas frases e pare para perguntar: “Isso conversa com o problema que você comentou?”",
        mission:
          "Grave para você um áudio de até 45 segundos explicando um benefício do Orçaly. Depois escreva uma frase que você cortaria.",
        missionPlaceholder:
          "Frase que eu cortaria: ...",
        quiz: [
          {
            prompt:
              "Confiança na comunicação depende principalmente de:",
            options: [
              "Falar sem parar.",
              "Usar palavras difíceis.",
              "Clareza, preparo e coerência.",
              "Falar mais alto.",
            ],
            answer: 2,
            explanation:
              "Comunicação segura é compreensível e consistente. Performance vazia não substitui domínio.",
          },
          {
            prompt:
              "Se você não souber uma resposta:",
            options: [
              "Invente para não perder autoridade.",
              "Mude de assunto.",
              "Diga que vai confirmar e retorne com precisão.",
              "Culpe o sistema.",
            ],
            answer: 2,
            explanation:
              "Confiabilidade cresce quando você diferencia o que sabe do que precisa verificar.",
          },
          {
            prompt:
              "Pausas na conversa podem:",
            options: [
              "Ajudar a organizar raciocínio.",
              "Sempre demonstrar insegurança.",
              "Ser proibidas em vendas.",
              "Substituir diagnóstico.",
            ],
            answer: 0,
            explanation:
              "Pausas bem usadas melhoram ritmo, compreensão e controle da conversa.",
          },
        ],
      },
      {
        id: "v3-pessoal-confianca",
        title: "Autoconfiança baseada em preparo, não em frase motivacional",
        minutes: 6,
        promise:
          "Você vai construir confiança por evidência: treino, repertório e pequenas execuções concluídas.",
        why:
          "Confiança sustentável cresce quando você acumula provas de competência. Repetir que “vai dar certo” pode animar por minutos; praticar cria referência real.",
        bullets: [
          "Treine situações antes de enfrentar situações reais.",
          "Colecione pequenas evidências de evolução.",
          "Compare seu desempenho com sua versão anterior, não com a vitrine dos outros.",
        ],
        formula:
          "Preparar → praticar → executar → revisar → repetir",
        example:
          "Grave uma demo hoje, reveja amanhã e anote três melhorias. A segunda versão vira evidência concreta de evolução.",
        mission:
          "Liste três evidências reais de que você já sabe mais hoje do que quando começou e uma habilidade que quer treinar nesta semana.",
        missionPlaceholder:
          "1. Hoje eu já consigo...\n2. ...\nNesta semana vou treinar...",
        quiz: [
          {
            prompt:
              "Autoconfiança mais estável nasce de:",
            options: [
              "Evitar situações difíceis.",
              "Evidências de preparo e prática.",
              "Comparação com todo mundo.",
              "Nunca admitir dúvida.",
            ],
            answer: 1,
            explanation:
              "Competência percebida cresce quando você acumula experiências reais de preparação e execução.",
          },
          {
            prompt:
              "Qual comparação costuma ser mais útil?",
            options: [
              "Seu início versus seu desempenho atual.",
              "Seu bastidor versus o melhor resultado alheio.",
              "Quantidade de seguidores.",
              "Quem vendeu mais em um único dia.",
            ],
            answer: 0,
            explanation:
              "Comparar evolução própria produz informação mais acionável e menos ruído.",
          },
          {
            prompt:
              "Depois de executar uma venda ou demo, faça:",
            options: [
              "Esqueça imediatamente.",
              "Revise o que funcionou e uma melhoria.",
              "Só veja o resultado financeiro.",
              "Culpe o cliente se não fechou.",
            ],
            answer: 1,
            explanation:
              "Revisão curta transforma experiência em aprendizado e acelera evolução.",
          },
        ],
      },
    ],
  },
];

function academyToken() {
  return supabase.auth
    .getSession()
    .then(({ data }) => data.session?.access_token || "");
}

async function workspaceAction(
  action: string,
  body: Record<string, unknown>,
) {
  const accessToken = await academyToken();
  if (!accessToken) return null;

  const response = await fetch(
    "/api/parceiros/workspace",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action, ...body }),
    },
  );

  return response.json().catch(() => ({}));
}

function encouragement(score: number) {
  if (score === 3) {
    return "Excelente. Você não só passou, como identificou o raciocínio por trás da técnica. É isso que permite adaptar uma venda sem depender de frase decorada.";
  }

  if (score === 2) {
    return "Muito bom. A base está firme. Revise só o ponto que escapou e siga em frente; não precisa reler tudo.";
  }

  if (score === 1) {
    return "Você já identificou uma parte importante. Revise as explicações das questões e tente de novo em poucos minutos.";
  }

  return "Você terminou a tentativa e agora sabe exatamente o que revisar. Releia apenas os três pontos-chave da aula e faça outra rodada.";
}

function badgeFor(completed: number) {
  if (completed >= 10)
    return {
      emoji: "🏆",
      label: "Sprint concluído",
      detail:
        "Você completou as duas trilhas guiadas.",
    };
  if (completed >= 8)
    return {
      emoji: "🔥",
      label: "Ritmo forte",
      detail:
        "Você está transformando conhecimento em rotina.",
    };
  if (completed >= 5)
    return {
      emoji: "⚙️",
      label: "Consistência",
      detail:
        "Metade da jornada concluída com prática.",
    };
  if (completed >= 3)
    return {
      emoji: "📈",
      label: "Em movimento",
      detail:
        "Você já passou da fase de só consumir conteúdo.",
    };
  return {
    emoji: "🚀",
    label: "Começo inteligente",
    detail:
      "Uma etapa de cada vez. O objetivo é continuidade.",
  };
}

export default function PartnerAcademyV3({
  partnerName,
}: {
  partnerName?: string;
}) {
  const [selectedTrackId, setSelectedTrackId] =
    useState(tracks[0].id);
  const [lessonIndex, setLessonIndex] =
    useState(0);
  const [completedIds, setCompletedIds] =
    useState<string[]>([]);
  const [missionAnswers, setMissionAnswers] =
    useState<Record<string, string>>({});
  const [quizScores, setQuizScores] =
    useState<Record<string, number>>({});
  const [quizAnswers, setQuizAnswers] =
    useState<Record<string, number[]>>({});
  const [focusMode, setFocusMode] =
    useState(false);
  const [showLibrary, setShowLibrary] =
    useState(false);
  const [feedback, setFeedback] =
    useState("");
  const [celebrating, setCelebrating] =
    useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw =
          window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed =
          JSON.parse(raw) as Partial<AcademyState>;

        if (
          parsed.selectedTrackId &&
          tracks.some(
            (track) =>
              track.id ===
              parsed.selectedTrackId,
          )
        ) {
          setSelectedTrackId(
            parsed.selectedTrackId,
          );
        }

        if (
          Number.isInteger(parsed.lessonIndex) &&
          Number(parsed.lessonIndex) >= 0
        ) {
          setLessonIndex(
            Number(parsed.lessonIndex),
          );
        }

        if (Array.isArray(parsed.completedIds)) {
          setCompletedIds(
            parsed.completedIds.map(String),
          );
        }

        if (
          parsed.missionAnswers &&
          typeof parsed.missionAnswers === "object"
        ) {
          setMissionAnswers(
            parsed.missionAnswers,
          );
        }

        if (
          parsed.quizScores &&
          typeof parsed.quizScores === "object"
        ) {
          setQuizScores(parsed.quizScores);
        }

        if (
          parsed.quizAnswers &&
          typeof parsed.quizAnswers === "object"
        ) {
          setQuizAnswers(parsed.quizAnswers);
        }
      } catch {
        // A academia continua funcionando sem progresso local.
      }
    }, 0);

    return () =>
      window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const state: AcademyState = {
        selectedTrackId,
        lessonIndex,
        completedIds,
        missionAnswers,
        quizScores,
        quizAnswers,
      };
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch {
      // Persistência local é conveniência, não requisito.
    }
  }, [
    completedIds,
    lessonIndex,
    missionAnswers,
    quizAnswers,
    quizScores,
    selectedTrackId,
  ]);

  const selectedTrack = useMemo(
    () =>
      tracks.find(
        (track) =>
          track.id === selectedTrackId,
      ) || tracks[0],
    [selectedTrackId],
  );

  const safeLessonIndex = Math.min(
    lessonIndex,
    selectedTrack.lessons.length - 1,
  );
  const lesson =
    selectedTrack.lessons[safeLessonIndex];
  const lessonAnswers =
    quizAnswers[lesson.id] ||
    Array(lesson.quiz.length).fill(-1);
  const lessonScore =
    quizScores[lesson.id];
  const missionAnswer =
    missionAnswers[lesson.id] || "";
  const missionReady =
    missionAnswer.trim().length >= 12;
  const quizPassed =
    typeof lessonScore === "number" &&
    lessonScore >= 2;
  const lessonDone =
    completedIds.includes(lesson.id);
  const totalLessons = tracks.reduce(
    (sum, track) =>
      sum + track.lessons.length,
    0,
  );
  const totalProgress = Math.round(
    (completedIds.length / totalLessons) *
      100,
  );
  const badge =
    badgeFor(completedIds.length);
  const shouldPause =
    completedIds.length > 0 &&
    completedIds.length % 2 === 0 &&
    !lessonDone;

  function chooseTrack(trackId: string) {
    const track =
      tracks.find(
        (item) => item.id === trackId,
      ) || tracks[0];
    setSelectedTrackId(track.id);

    const firstPending =
      track.lessons.findIndex(
        (item) =>
          !completedIds.includes(item.id),
      );

    setLessonIndex(
      firstPending >= 0 ? firstPending : 0,
    );
    setFeedback("");
  }

  function chooseLesson(index: number) {
    setLessonIndex(index);
    setFeedback("");
  }

  function answerQuestion(
    questionIndex: number,
    optionIndex: number,
  ) {
    setQuizAnswers((current) => {
      const answers = [
        ...(current[lesson.id] ||
          Array(
            lesson.quiz.length,
          ).fill(-1)),
      ];
      answers[questionIndex] =
        optionIndex;
      return {
        ...current,
        [lesson.id]: answers,
      };
    });

    if (
      typeof lessonScore === "number"
    ) {
      setQuizScores((current) => {
        const next = { ...current };
        delete next[lesson.id];
        return next;
      });
      setFeedback("");
    }
  }

  async function submitQuiz() {
    if (
      lessonAnswers.some(
        (answer) => answer < 0,
      )
    ) {
      setFeedback(
        "Responda as três questões antes de corrigir. É rápido, prometo.",
      );
      return;
    }

    const score =
      lesson.quiz.reduce(
        (sum, question, index) =>
          sum +
          (lessonAnswers[index] ===
          question.answer
            ? 1
            : 0),
        0,
      );

    setQuizScores((current) => ({
      ...current,
      [lesson.id]: score,
    }));
    setFeedback(encouragement(score));

    void workspaceAction("save_training", {
      mode: "quiz",
      scenarioId: lesson.id,
      totalScore:
        (score / lesson.quiz.length) *
        100,
      answer: JSON.stringify(
        lessonAnswers,
      ),
      scoreJson: {
        correct: score,
        total: lesson.quiz.length,
        trackId: selectedTrack.id,
      },
      feedback: encouragement(score),
    });
  }

  async function completeLesson() {
    if (!missionReady || !quizPassed) {
      setFeedback(
        "Para concluir: faça a missão curta e acerte pelo menos 2 de 3 na miniprova.",
      );
      return;
    }

    if (!lessonDone) {
      setCompletedIds((current) => [
        ...current,
        lesson.id,
      ]);

      void workspaceAction(
        "complete_lesson",
        {
          courseId: selectedTrack.id,
          lessonId: lesson.id,
        },
      );
    }

    setCelebrating(true);
    setFeedback(
      "Etapa concluída. Bom trabalho: você estudou, praticou e verificou se realmente entendeu. Isso vale muito mais que só marcar uma aula como vista.",
    );

    window.setTimeout(
      () => setCelebrating(false),
      1100,
    );

    if (
      safeLessonIndex <
      selectedTrack.lessons.length - 1
    ) {
      window.setTimeout(() => {
        setLessonIndex(
          safeLessonIndex + 1,
        );
        setFeedback("");
      }, 800);
    }
  }

  return (
    <div className="space-y-5">
      <style>{`
        @keyframes academyFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes academyGlow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }
        .academy-enter {
          animation: academyFadeUp .38s ease-out both;
        }
        .academy-celebrate {
          animation: academyGlow .55s ease-in-out 2;
        }
      `}</style>

      <section
        className={`academy-enter relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7 ${
          celebrating
            ? "academy-celebrate"
            : ""
        }`}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-16 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1fr_330px] xl:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
                Academia 3.0
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">
                microlições + prática
              </span>
            </div>

            <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-[-0.05em] sm:text-5xl">
              Treine vendas sem transformar estudo em castigo.
            </h1>

            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/60 sm:text-base">
              {partnerName
                ? `${partnerName}, `
                : ""}
              aqui você avança em blocos curtos:
              entende uma ideia, pratica, faz
              uma miniprova e recebe feedback
              imediato. Sem muralha de texto.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/45">
                  Progresso guiado
                </p>
                <p className="mt-2 text-4xl font-black">
                  {totalProgress}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl">
                  {badge.emoji}
                </p>
                <p className="mt-1 text-xs font-black text-cyan-100">
                  {badge.label}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-700"
                style={{
                  width: `${totalProgress}%`,
                }}
              />
            </div>

            <p className="mt-3 text-xs font-semibold leading-5 text-white/45">
              {completedIds.length} de{" "}
              {totalLessons} etapas.{" "}
              {badge.detail}
            </p>
          </div>
        </div>
      </section>

      <section className="academy-enter grid gap-3 sm:grid-cols-2">
        {tracks.map((track) => {
          const done =
            track.lessons.filter((item) =>
              completedIds.includes(item.id),
            ).length;
          const active =
            track.id === selectedTrack.id;

          return (
            <button
              key={track.id}
              type="button"
              onClick={() =>
                chooseTrack(track.id)
              }
              className={`group rounded-[1.6rem] border p-5 text-left transition duration-300 hover:-translate-y-1 ${
                active
                  ? "border-[#05245c] bg-[#05245c] text-white shadow-xl shadow-blue-950/10"
                  : "border-white bg-white text-[#071b3a] shadow-sm hover:border-blue-100"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-3xl">
                  {track.emoji}
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                    active
                      ? "bg-white/10 text-cyan-100"
                      : "bg-blue-50 text-[#05245c]"
                  }`}
                >
                  {done}/{track.lessons.length}
                </span>
              </div>
              <p
                className={`mt-4 text-[10px] font-black uppercase tracking-[0.15em] ${
                  active
                    ? "text-cyan-200/70"
                    : "text-slate-400"
                }`}
              >
                {track.label}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.03em]">
                {track.title}
              </h2>
              <p
                className={`mt-2 text-sm font-semibold leading-6 ${
                  active
                    ? "text-white/55"
                    : "text-slate-500"
                }`}
              >
                {track.description}
              </p>
            </button>
          );
        })}
      </section>

      <section className="academy-enter rounded-[1.8rem] border border-white bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-[#1359a5]">
              Próximos 5 minutos
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
              Uma única etapa. Sem maratona.
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setFocusMode(
                (current) => !current,
              )
            }
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              focusMode
                ? "bg-violet-100 text-violet-800"
                : "bg-[#071b3a] text-white"
            }`}
          >
            {focusMode
              ? "Sair do modo foco"
              : "🎯 Ativar modo foco"}
          </button>
        </div>

        {!focusMode ? (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {selectedTrack.lessons.map(
              (item, index) => {
                const done =
                  completedIds.includes(
                    item.id,
                  );
                const active =
                  index === safeLessonIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      chooseLesson(index)
                    }
                    className={`min-w-[175px] rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-100 bg-[#f8faff]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-black ${
                          done
                            ? "bg-emerald-100 text-emerald-700"
                            : active
                              ? "bg-[#05245c] text-white"
                              : "bg-white text-slate-500"
                        }`}
                      >
                        {done
                          ? "✓"
                          : index + 1}
                      </span>
                      <span className="text-[10px] font-black text-slate-400">
                        {item.minutes} min
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs font-black leading-5 text-[#071b3a]">
                      {item.title}
                    </p>
                  </button>
                );
              },
            )}
          </div>
        ) : null}
      </section>

      {shouldPause ? (
        <section className="academy-enter rounded-[1.6rem] border border-cyan-100 bg-cyan-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-700">
            Pausa inteligente
          </p>
          <p className="mt-2 font-black text-cyan-950">
            Você concluiu duas etapas.
            Levante, beba água e volte em
            dois minutos.
          </p>
          <p className="mt-1 text-sm font-semibold text-cyan-900/65">
            Descanso curto faz parte da
            estratégia. Heroísmo acadêmico
            raramente melhora memória.
          </p>
        </section>
      ) : null}

      <article
        key={lesson.id}
        className="academy-enter overflow-hidden rounded-[2rem] border border-white bg-white shadow-sm"
      >
        <div className="border-b border-blue-50 bg-gradient-to-br from-[#f8fbff] to-white p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1359a5]">
                Etapa {safeLessonIndex + 1} ·{" "}
                {lesson.minutes} minutos
              </p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.05em] text-[#071b3a]">
                {lesson.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-500">
                {lesson.promise}
              </p>
            </div>

            {lessonDone ? (
              <span className="self-start rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-700">
                ✓ concluída
              </span>
            ) : (
              <span className="self-start rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700">
                em treino
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[1fr_.9fr]">
          <div className="space-y-4">
            <section className="rounded-[1.5rem] border border-blue-100 bg-blue-50/55 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                Por que isso importa
              </p>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                {lesson.why}
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-slate-100 bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Grave só estes 3 pontos
              </p>
              <div className="mt-4 grid gap-3">
                {lesson.bullets.map(
                  (bullet, index) => (
                    <div
                      key={bullet}
                      className="flex gap-3 rounded-2xl bg-[#f8faff] p-3"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#05245c] text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <p className="text-sm font-semibold leading-6 text-slate-600">
                        {bullet}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-violet-100 bg-violet-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                Fórmula mental
              </p>
              <p className="mt-3 text-lg font-black tracking-[-0.02em] text-violet-950">
                {lesson.formula}
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                Exemplo realista
              </p>
              <p className="mt-3 text-sm font-semibold leading-7 text-emerald-950/75">
                {lesson.example}
              </p>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                    Missão prática
                  </p>
                  <p className="mt-2 text-sm font-black leading-6 text-amber-950">
                    {lesson.mission}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-amber-700">
                  2 min
                </span>
              </div>

              <textarea
                value={missionAnswer}
                onChange={(event) =>
                  setMissionAnswers(
                    (current) => ({
                      ...current,
                      [lesson.id]:
                        event.target.value,
                    }),
                  )
                }
                rows={5}
                placeholder={
                  lesson.missionPlaceholder
                }
                className="mt-4 w-full resize-y rounded-2xl border border-amber-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-amber-400"
              />

              <p
                className={`mt-2 text-xs font-black ${
                  missionReady
                    ? "text-emerald-700"
                    : "text-amber-700/65"
                }`}
              >
                {missionReady
                  ? "✓ Missão pronta para validação"
                  : "Escreva uma resposta curta para transformar leitura em prática."}
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-[#fbfcfe] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                    Miniprova
                  </p>
                  <h3 className="mt-1 text-xl font-black text-[#071b3a]">
                    3 questões. Sem drama.
                  </h3>
                </div>
                {typeof lessonScore ===
                "number" ? (
                  <span
                    className={`rounded-full px-3 py-2 text-xs font-black ${
                      lessonScore >= 2
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {lessonScore}/3
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-5">
                {lesson.quiz.map(
                  (question, questionIndex) => (
                    <fieldset
                      key={question.prompt}
                      className="rounded-2xl border border-slate-100 bg-white p-4"
                    >
                      <legend className="px-1 text-sm font-black leading-6 text-[#071b3a]">
                        {questionIndex + 1}.{" "}
                        {question.prompt}
                      </legend>

                      <div className="mt-3 grid gap-2">
                        {question.options.map(
                          (
                            option,
                            optionIndex,
                          ) => {
                            const selected =
                              lessonAnswers[
                                questionIndex
                              ] ===
                              optionIndex;
                            const graded =
                              typeof lessonScore ===
                              "number";
                            const correct =
                              graded &&
                              optionIndex ===
                                question.answer;
                            const wrongSelected =
                              graded &&
                              selected &&
                              optionIndex !==
                                question.answer;

                            return (
                              <label
                                key={option}
                                className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm font-semibold leading-5 transition ${
                                  correct
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                    : wrongSelected
                                      ? "border-red-200 bg-red-50 text-red-900"
                                      : selected
                                        ? "border-blue-200 bg-blue-50 text-[#05245c]"
                                        : "border-slate-100 bg-[#f8faff] text-slate-600 hover:border-blue-100"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`${lesson.id}-${questionIndex}`}
                                  checked={
                                    selected
                                  }
                                  onChange={() =>
                                    answerQuestion(
                                      questionIndex,
                                      optionIndex,
                                    )
                                  }
                                  className="mt-0.5"
                                />
                                <span>
                                  {option}
                                </span>
                              </label>
                            );
                          },
                        )}
                      </div>

                      {typeof lessonScore ===
                      "number" ? (
                        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                          <strong>
                            Entenda:
                          </strong>{" "}
                          {
                            question.explanation
                          }
                        </p>
                      ) : null}
                    </fieldset>
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  void submitQuiz()
                }
                className="mt-5 w-full rounded-2xl bg-[#05245c] px-5 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-[#031a43]"
              >
                Corrigir miniprova
              </button>
            </section>
          </div>
        </div>

        <div className="border-t border-slate-100 p-4 sm:p-6">
          {feedback ? (
            <div
              aria-live="polite"
              className={`mb-4 rounded-2xl border p-4 text-sm font-bold leading-6 ${
                quizPassed || lessonDone
                  ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                  : "border-amber-100 bg-amber-50 text-amber-800"
              }`}
            >
              {feedback}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-slate-500">
                Para concluir esta etapa:
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                missão escrita + pelo menos 2
                acertos na miniprova.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void completeLesson()
              }
              disabled={
                !missionReady ||
                !quizPassed
              }
              className="rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {lessonDone
                ? "✓ Etapa concluída"
                : "Concluir e avançar →"}
            </button>
          </div>
        </div>
      </article>

      <section className="academy-enter rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-violet-600">
              Biblioteca avançada
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#071b3a]">
              Quer aprofundar? O conteúdo
              completo continua aqui.
            </h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
              Os cursos longos, exemplos,
              exercícios e fundamentos
              existentes não foram removidos.
              Use depois do treino guiado ou
              quando quiser estudar um tema em
              profundidade.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowLibrary(
                (current) => !current,
              )
            }
            className="rounded-2xl border border-violet-100 bg-violet-50 px-5 py-3 text-sm font-black text-violet-700 transition hover:-translate-y-0.5"
          >
            {showLibrary
              ? "Fechar biblioteca"
              : "Abrir biblioteca completa"}
          </button>
        </div>
      </section>

      {showLibrary ? (
        <div className="academy-enter">
          <PartnerCoursesTab />
        </div>
      ) : null}
    </div>
  );
}
