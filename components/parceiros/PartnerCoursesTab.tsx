"use client";

import { useEffect, useMemo, useState } from "react";

type Lesson = {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  concept: string[];
  steps: string[];
  example: {
    title: string;
    scenario: string;
    response: string;
  };
  mistakes: string[];
  exercise: string;
  lifeSkill: string;
};

type Course = {
  id: string;
  category: string;
  title: string;
  description: string;
  level: "Fundamentos" | "Intermediário" | "Avançado";
  objectives: string[];
  lessons: Lesson[];
};

const STORAGE_KEY = "orcaly-partner-academy-v2";

const courses: Course[] = [
  {
    id: "produto",
    category: "Produto",
    title: "Domine o Orçaly antes de vender",
    description:
      "Aprenda a entender um produto de verdade, transformar funções em valor e apresentar apenas o que faz sentido para cada pessoa.",
    level: "Fundamentos",
    objectives: [
      "Explicar o Orçaly sem depender de um roteiro decorado.",
      "Conectar recursos do sistema a problemas reais de uma empresa.",
      "Conduzir uma demonstração curta, clara e confiável.",
    ],
    lessons: [
      {
        id: "produto-proposta",
        title: "O que você realmente vende",
        minutes: 12,
        summary:
          "Produto não é uma lista de telas. O cliente compra mudança, organização e redução de atrito no trabalho.",
        concept: [
          "Uma função só ganha valor quando resolve um problema percebido. Dizer 'tem catálogo' informa. Dizer 'seu cliente consegue consultar os produtos sem esperar você responder item por item' mostra utilidade.",
          "O parceiro precisa entender três camadas: o que a ferramenta faz, qual problema ela reduz e qual impacto isso pode ter na rotina.",
          "A melhor apresentação começa pelo negócio do cliente e termina no recurso. Não o contrário.",
        ],
        steps: [
          "Escolha uma função do sistema.",
          "Pergunte qual tarefa humana ela substitui, organiza ou acelera.",
          "Descreva o impacto com uma frase simples e verificável.",
          "Adapte o exemplo ao segmento de quem está ouvindo.",
        ],
        example: {
          title: "De função para valor",
          scenario:
            "Você está falando com uma pequena loja que recebe pedidos pelo WhatsApp e perde informações entre conversas.",
          response:
            "Em vez de dizer 'o Orçaly tem pedidos', explique: 'Você consegue concentrar os pedidos e acompanhar a situação de cada um sem depender de procurar mensagens antigas no WhatsApp.'",
        },
        mistakes: [
          "Recitar todas as funções do sistema de uma vez.",
          "Usar palavras vagas como 'revolucionário', 'completo' ou 'o melhor' sem explicar por quê.",
          "Prometer resultado financeiro que depende de fatores fora do sistema.",
        ],
        exercise:
          "Escolha cinco recursos do Orçaly. Para cada um, escreva: função → problema que resolve → impacto na rotina.",
        lifeSkill:
          "Essa forma de pensar serve para qualquer venda, apresentação profissional ou entrevista: explique valor e consequência, não apenas características.",
      },
      {
        id: "produto-diagnostico",
        title: "Descubra o que mostrar para cada negócio",
        minutes: 14,
        summary:
          "Uma demonstração boa é personalizada. Você precisa descobrir a rotina da pessoa antes de escolher as telas.",
        concept: [
          "Empresas diferentes podem comprar o mesmo software por motivos completamente diferentes.",
          "Diagnóstico significa fazer perguntas para entender processo atual, dificuldade, frequência do problema e prioridade.",
          "Quanto mais específico o problema relatado pelo cliente, mais específica deve ser a demonstração.",
        ],
        steps: [
          "Pergunte como os pedidos, clientes e informações são organizados hoje.",
          "Descubra qual parte mais gera atraso, retrabalho ou confusão.",
          "Pergunte o que a pessoa já tentou fazer para melhorar.",
          "Escolha duas ou três áreas do sistema ligadas diretamente ao problema relatado.",
        ],
        example: {
          title: "O mesmo sistema, duas apresentações",
          scenario:
            "Uma gráfica reclama de orçamentos demorados. Um restaurante reclama de pedidos espalhados.",
          response:
            "Para a gráfica, priorize orçamento, pedidos e acompanhamento. Para o restaurante, priorize catálogo/cardápio, pedido e entrega. Mostrar o mesmo roteiro para ambos desperdiça atenção.",
        },
        mistakes: [
          "Perguntar apenas 'você precisa de um sistema?'",
          "Mostrar módulo financeiro para alguém cuja dor principal é atendimento.",
          "Interromper a pessoa para encaixar a resposta no seu roteiro.",
        ],
        exercise:
          "Escolha três segmentos. Para cada um, escreva quatro perguntas de diagnóstico e três telas que você mostraria primeiro.",
        lifeSkill:
          "Diagnóstico é uma habilidade útil em vendas, liderança, suporte, consultoria e até relações pessoais: entender antes de propor.",
      },
      {
        id: "produto-demo",
        title: "Faça uma demonstração que conta uma história",
        minutes: 15,
        summary:
          "Em vez de passear pelo menu, mostre um fluxo que imita o dia a dia do cliente.",
        concept: [
          "Pessoas entendem melhor processos em sequência do que listas desconectadas de recursos.",
          "Uma boa demo tem começo, meio e fim: algo acontece, o sistema organiza e alguém acompanha o resultado.",
          "O objetivo não é provar que você conhece todos os menus. É fazer o cliente se enxergar usando o produto.",
        ],
        steps: [
          "Relembre a principal dor em uma frase.",
          "Mostre onde o processo começa no sistema.",
          "Mostre como a informação avança e fica organizada.",
          "Termine com a visão que o dono ou equipe recebe.",
        ],
        example: {
          title: "Demo de cinco minutos",
          scenario:
            "Cliente quer reduzir a confusão entre orçamento, pedido e acompanhamento.",
          response:
            "Mostre um orçamento entrando, virando pedido, mudando de status e aparecendo na visão operacional. Depois pergunte: 'Hoje, em qual dessas etapas vocês mais perdem tempo?'",
        },
        mistakes: [
          "Abrir dez menus sem contexto.",
          "Ficar mais tempo explicando configurações do que o fluxo principal.",
          "Não deixar espaço para perguntas.",
        ],
        exercise:
          "Abra o ambiente demonstrativo e pratique uma demo de cinco minutos com cronômetro. Depois repita tentando explicar com 20% menos palavras.",
        lifeSkill:
          "Storytelling de processo ajuda em reuniões, apresentações, aulas e explicações técnicas: contexto → ação → resultado.",
      },
    ],
  },
  {
    id: "consultiva",
    category: "Vendas",
    title: "Venda consultiva: diagnostique antes de oferecer",
    description:
      "Aprenda a conduzir uma conversa comercial sem pressionar, identificando necessidade, impacto e prioridade antes de apresentar solução.",
    level: "Fundamentos",
    objectives: [
      "Fazer perguntas que geram informação útil.",
      "Separar problema, impacto e prioridade.",
      "Apresentar uma solução proporcional ao que foi descoberto.",
    ],
    lessons: [
      {
        id: "consultiva-perguntas",
        title: "Perguntas que fazem o cliente pensar",
        minutes: 16,
        summary:
          "Perguntas boas revelam processo, incômodo e consequência. Perguntas ruins apenas empurram a pessoa para um 'sim' ou 'não'.",
        concept: [
          "Pergunta aberta produz contexto. 'Como vocês controlam os pedidos hoje?' ensina muito mais que 'vocês têm dificuldade com pedidos?'",
          "Perguntas de consequência ajudam a pessoa a perceber o custo do problema sem você dramatizar.",
          "Perguntas precisam parecer conversa. Se você disparar dez em sequência, vira interrogatório.",
        ],
        steps: [
          "Comece pelo processo atual.",
          "Aprofunde onde há falha ou retrabalho.",
          "Pergunte o que acontece quando a falha ocorre.",
          "Descubra se resolver aquilo é prioridade agora.",
        ],
        example: {
          title: "Sequência natural",
          scenario:
            "Você quer entender se a empresa tem problema com acompanhamento.",
          response:
            "Pergunte: 'Como vocês sabem em que etapa está cada pedido?' Depois: 'Quando alguém esquece de atualizar, o que costuma acontecer?' E então: 'Isso acontece com frequência suficiente para incomodar vocês?'",
        },
        mistakes: [
          "Perguntas que já carregam a resposta que você quer ouvir.",
          "Perguntar sobre preço antes de entender necessidade.",
          "Transformar cada resposta em oportunidade para interromper e vender.",
        ],
        exercise:
          "Escreva dez perguntas abertas para um segmento e marque quais investigam processo, problema, consequência e prioridade.",
        lifeSkill:
          "Saber perguntar melhora conversas profissionais, entrevistas, gestão de pessoas e solução de conflitos.",
      },
      {
        id: "consultiva-escuta",
        title: "Escuta ativa e resumo da necessidade",
        minutes: 14,
        summary:
          "Escutar bem não é ficar em silêncio esperando sua vez de falar. É mostrar que você entendeu e conferir se entendeu certo.",
        concept: [
          "A pessoa confia mais quando percebe que sua situação foi compreendida com precisão.",
          "Resumir ajuda a evitar mal-entendidos e também organiza a própria decisão do cliente.",
          "Escuta ativa envolve observar palavras, exemplos, prioridades e emoções, sem tentar diagnosticar psicologicamente a pessoa.",
        ],
        steps: [
          "Deixe a pessoa concluir.",
          "Anote mentalmente ou por escrito os pontos centrais.",
          "Resuma usando palavras simples.",
          "Pergunte se sua leitura está correta antes de sugerir solução.",
        ],
        example: {
          title: "Resumo que gera confiança",
          scenario:
            "O cliente contou que recebe pedido por Instagram, WhatsApp e telefone e esquece alguns retornos.",
          response:
            "Diga: 'Então o maior problema não é falta de cliente. É que os pedidos chegam por lugares diferentes e fica difícil acompanhar tudo. É isso?'",
        },
        mistakes: [
          "Repetir palavra por palavra como um robô.",
          "Interpretar intenção sem confirmar.",
          "Preparar a resposta enquanto a outra pessoa ainda está falando.",
        ],
        exercise:
          "Em uma conversa real hoje, pratique resumir o que a pessoa disse antes de dar sua opinião.",
        lifeSkill:
          "Escuta ativa melhora vendas, relacionamentos, liderança, atendimento e negociações.",
      },
      {
        id: "consultiva-solucao",
        title: "Apresente a solução na medida certa",
        minutes: 15,
        summary:
          "Depois do diagnóstico, mostre apenas o necessário para responder ao problema identificado.",
        concept: [
          "Valor percebido aumenta quando a solução parece feita para o contexto da pessoa.",
          "Excesso de informação pode diminuir clareza e aumentar insegurança.",
          "Uma boa recomendação explica o porquê da escolha e também reconhece limites.",
        ],
        steps: [
          "Retome o problema principal.",
          "Escolha o recurso mais diretamente relacionado.",
          "Mostre o fluxo em contexto.",
          "Explique o que o recurso não resolve sozinho.",
        ],
        example: {
          title: "Recomendação proporcional",
          scenario:
            "A empresa quer principalmente organizar pedidos, não fazer uma transformação digital completa.",
          response:
            "Concentre a conversa em entrada, status e acompanhamento dos pedidos. Deixe módulos secundários para outro momento.",
        },
        mistakes: [
          "Tentar aumentar complexidade para parecer mais valioso.",
          "Fingir que toda funcionalidade é indispensável.",
          "Esconder limitações que podem ser relevantes.",
        ],
        exercise:
          "Pegue um caso fictício e prepare duas versões da apresentação: uma de três minutos e outra de dez. Compare o que realmente precisa entrar.",
        lifeSkill:
          "Comunicação proporcional é útil sempre que você precisa explicar algo complexo sem sobrecarregar quem está ouvindo.",
      },
    ],
  },
  {
    id: "psicologia",
    category: "Comportamento",
    title: "Psicologia de compra sem manipulação",
    description:
      "Entenda como atenção, risco, confiança, escolha e prova afetam decisões, usando psicologia para clareza e não para enganar.",
    level: "Intermediário",
    objectives: [
      "Reconhecer fatores que aumentam confiança.",
      "Reduzir incerteza sem fabricar urgência.",
      "Organizar informação para facilitar decisões conscientes.",
    ],
    lessons: [
      {
        id: "psicologia-risco",
        title: "Risco percebido: por que pessoas adiam decisões",
        minutes: 16,
        summary:
          "Muitas vezes o cliente não rejeita a solução. Ele rejeita a incerteza sobre dinheiro, tempo, adaptação ou arrependimento.",
        concept: [
          "Quanto maior a mudança percebida, maior a necessidade de clareza.",
          "Risco pode ser financeiro, operacional, social ou emocional.",
          "Reduzir risco é explicar processo, limite, próximo passo e expectativa realista.",
        ],
        steps: [
          "Descubra o que a pessoa teme perder.",
          "Explique o processo de adoção de forma concreta.",
          "Mostre demonstração ou evidência verificável.",
          "Não pressione quando ainda existe dúvida legítima.",
        ],
        example: {
          title: "Cliente com medo de perder tempo",
          scenario:
            "A pessoa gosta do sistema, mas teme ter trabalho para aprender e cadastrar tudo.",
          response:
            "Em vez de insistir no preço, explique o processo de entrada, o que precisa ser configurado primeiro e quais partes podem ser adotadas aos poucos.",
        },
        mistakes: [
          "Chamar qualquer hesitação de 'objeção'.",
          "Usar urgência falsa para impedir reflexão.",
          "Minimizar uma preocupação real do cliente.",
        ],
        exercise:
          "Liste cinco riscos que alguém pode perceber ao contratar um software e escreva uma resposta honesta para cada um.",
        lifeSkill:
          "Entender risco percebido ajuda em negociações, mudanças de carreira, liderança e tomada de decisão.",
      },
      {
        id: "psicologia-carga",
        title: "Carga mental, atenção e excesso de escolha",
        minutes: 15,
        summary:
          "Mais informação não significa mais convencimento. Muitas opções e detalhes podem dificultar a decisão.",
        concept: [
          "A memória de trabalho é limitada. Quando muita coisa compete pela atenção, a compreensão cai.",
          "Organizar informação em blocos e prioridades reduz esforço mental.",
          "Uma apresentação deve responder primeiro às perguntas mais importantes: o que é, por que importa e o que faço depois.",
        ],
        steps: [
          "Defina uma mensagem principal.",
          "Agrupe detalhes por assunto.",
          "Mostre uma coisa por vez.",
          "Dê espaço para a pessoa perguntar antes de acrescentar mais.",
        ],
        example: {
          title: "De 20 funções para 3 ideias",
          scenario:
            "Você tem vontade de mostrar todo o sistema porque ele possui muitos recursos.",
          response:
            "Resuma em três blocos: vender/receber pedidos, organizar operação, acompanhar gestão. Depois aprofunde apenas onde houver interesse.",
        },
        mistakes: [
          "Tela cheia de números sem explicar o que importa.",
          "Falar rápido para 'caber tudo'.",
          "Apresentar cinco planos, dez bônus e muitas condições ao mesmo tempo.",
        ],
        exercise:
          "Pegue uma explicação sua de um minuto e reduza para três ideias principais. Depois veja se a mensagem ficou mais clara.",
        lifeSkill:
          "Simplificar sem distorcer é uma das competências mais valiosas em ensino, gestão, comunicação e tecnologia.",
      },
      {
        id: "psicologia-confianca",
        title: "Confiança, prova e coerência",
        minutes: 16,
        summary:
          "Confiança vem de consistência entre o que você diz, o que mostra e o que a pessoa consegue verificar.",
        concept: [
          "Prova concreta tende a ser mais forte que adjetivo.",
          "Coerência significa não mudar a história apenas para fechar a venda.",
          "Admitir um limite relevante pode aumentar credibilidade quando feito com clareza.",
        ],
        steps: [
          "Troque afirmações vagas por demonstrações.",
          "Use exemplos reais ou explicitamente demonstrativos.",
          "Diferencie fato, estimativa e opinião.",
          "Mantenha a mesma promessa no anúncio, conversa e produto.",
        ],
        example: {
          title: "Prova em vez de superlativo",
          scenario:
            "Você quer dizer que o sistema é simples.",
          response:
            "Abra o demonstrativo e faça uma tarefa comum em poucos passos. Deixe a pessoa observar e concluir se considera simples.",
        },
        mistakes: [
          "Depoimento inventado.",
          "Número sem fonte ou contexto.",
          "Promessa diferente em cada canal.",
        ],
        exercise:
          "Liste cinco afirmações de marketing comuns e substitua cada uma por algo demonstrável ou verificável.",
        lifeSkill:
          "Distinguir prova de retórica melhora pensamento crítico, comunicação e decisões de compra na própria vida.",
      },
    ],
  },
  {
    id: "presencial",
    category: "Abordagem",
    title: "Como falar com um possível cliente pessoalmente",
    description:
      "Aprenda presença, abertura, leitura de contexto e conversa respeitosa para abordar pessoas sem parecer invasivo.",
    level: "Fundamentos",
    objectives: [
      "Abrir uma conversa com naturalidade.",
      "Perceber sinais de interesse ou indisponibilidade.",
      "Conduzir a conversa para uma demonstração curta.",
    ],
    lessons: [
      {
        id: "presencial-abertura",
        title: "Os primeiros 30 segundos",
        minutes: 12,
        summary:
          "Sua primeira meta não é vender. É conseguir permissão para ter uma conversa.",
        concept: [
          "Abordagens curtas respeitam tempo e reduzem resistência.",
          "Contexto mostra que você não está repetindo uma frase automática.",
          "Permissão devolve controle à outra pessoa.",
        ],
        steps: [
          "Cumprimente e identifique rapidamente o motivo.",
          "Conecte sua fala ao tipo de negócio.",
          "Faça uma pergunta simples.",
          "Se houver abertura, continue. Se não, encerre com respeito.",
        ],
        example: {
          title: "Abordagem em uma loja",
          scenario:
            "O dono está no balcão e parece ocupado.",
          response:
            "Diga: 'Boa tarde. Trabalho com uma plataforma de organização para pequenos negócios. Posso te fazer uma pergunta rápida sobre como vocês recebem os pedidos? Se estiver corrido, eu volto em outro momento.'",
        },
        mistakes: [
          "Começar com um monólogo.",
          "Bloquear fisicamente a passagem ou insistir.",
          "Fingir intimidade que não existe.",
        ],
        exercise:
          "Crie três aberturas de 20 segundos para três tipos de negócio. Grave e ouça se soam naturais.",
        lifeSkill:
          "Saber iniciar conversas respeitosamente ajuda em networking, eventos, entrevistas e situações sociais.",
      },
      {
        id: "presencial-presenca",
        title: "Postura, voz e leitura do ambiente",
        minutes: 14,
        summary:
          "Comunicação não verbal influencia como sua mensagem é recebida, mas não existe gesto mágico que 'revele' o que alguém pensa.",
        concept: [
          "Voz clara, ritmo moderado e postura aberta ajudam compreensão.",
          "Sinais corporais devem ser lidos em conjunto com contexto, nunca como detector de mentira ou fórmula psicológica.",
          "Respeitar distância, interrupções e rotina do local é parte da venda.",
        ],
        steps: [
          "Fale um pouco mais devagar do que sua ansiedade pede.",
          "Mantenha volume adequado ao ambiente.",
          "Observe se a pessoa está olhando, respondendo e fazendo perguntas.",
          "Se ela estiver ocupada, proponha outro momento.",
        ],
        example: {
          title: "Pessoa olhando para o caixa",
          scenario:
            "Durante sua explicação, o cliente começa a atender funcionários e olhar repetidamente para outro ponto.",
          response:
            "Em vez de interpretar como rejeição, diga: 'Acho que peguei você em um momento corrido. Prefere que eu te deixe meu contato e volte depois?'",
        },
        mistakes: [
          "Tratar linguagem corporal como ciência exata.",
          "Falar mais alto quando a pessoa demonstra pressa.",
          "Continuar a apresentação ignorando o ambiente.",
        ],
        exercise:
          "Em uma conversa cotidiana, pratique reduzir 10% da velocidade da fala e observar se sua clareza melhora.",
        lifeSkill:
          "Presença e leitura de contexto são úteis em apresentações, reuniões, networking e liderança.",
      },
      {
        id: "presencial-transicao",
        title: "Da conversa para a demonstração",
        minutes: 13,
        summary:
          "A transição funciona melhor quando a pessoa já explicou um problema que você consegue mostrar no sistema.",
        concept: [
          "Demonstração sem contexto parece propaganda.",
          "Pedir permissão reduz sensação de pressão.",
          "Mostrar pouco e relevante é melhor do que mostrar tudo.",
        ],
        steps: [
          "Resuma a dor em uma frase.",
          "Conecte com uma área do sistema.",
          "Peça dois ou três minutos.",
          "Mostre o fluxo e devolva a conversa ao cliente.",
        ],
        example: {
          title: "Transição natural",
          scenario:
            "A pessoa diz que esquece de retornar alguns orçamentos.",
          response:
            "Diga: 'Entendi. Posso te mostrar rapidamente como o acompanhamento fica organizado no sistema? Leva dois minutos.'",
        },
        mistakes: [
          "Abrir o notebook antes de a pessoa demonstrar interesse.",
          "Fazer uma demo longa em pé no balcão.",
          "Encerrar a demo sem perguntar o que fez sentido.",
        ],
        exercise:
          "Treine três frases de transição a partir de três dores diferentes.",
        lifeSkill:
          "Aprender a pedir permissão antes de avançar melhora comunicação e respeito em qualquer relação.",
      },
    ],
  },
  {
    id: "virtual",
    category: "Abordagem",
    title: "WhatsApp, Instagram e conversa virtual",
    description:
      "Aprenda a gerar resposta, manter contexto e conduzir conversas digitais sem spam, texto enorme ou automação robótica.",
    level: "Fundamentos",
    objectives: [
      "Escrever mensagens curtas e personalizadas.",
      "Criar continuidade depois da primeira resposta.",
      "Saber quando enviar link, áudio, vídeo ou demonstração.",
    ],
    lessons: [
      {
        id: "virtual-primeira",
        title: "A primeira mensagem que merece resposta",
        minutes: 13,
        summary:
          "Uma boa primeira mensagem explica por que você está falando com aquela pessoa e pede uma resposta fácil.",
        concept: [
          "Mensagens genéricas parecem disparo em massa.",
          "Contexto reduz desconfiança.",
          "Perguntas simples diminuem esforço para responder.",
        ],
        steps: [
          "Cumprimente pelo nome quando souber.",
          "Diga rapidamente como encontrou ou por que escolheu aquele negócio.",
          "Explique o tema em uma frase.",
          "Faça uma pergunta simples e pare.",
        ],
        example: {
          title: "Direct personalizado",
          scenario:
            "Você encontrou uma confeitaria no Instagram.",
          response:
            "Envie: 'Oi, Ana! Vi o perfil da confeitaria e fiquei curioso: vocês recebem a maioria das encomendas pelo direct ou pelo WhatsApp? Trabalho com uma ferramenta de organização para pequenos negócios e queria entender como vocês fazem hoje.'",
        },
        mistakes: [
          "Mandar link na primeira linha.",
          "Enviar três áudios antes da pessoa responder.",
          "Fingir que é cliente para iniciar conversa.",
        ],
        exercise:
          "Escreva cinco primeiras mensagens para negócios reais, cada uma com um contexto diferente e no máximo 280 caracteres.",
        lifeSkill:
          "Comunicação escrita curta e contextual ajuda em e-mails, networking, trabalho remoto e atendimento.",
      },
      {
        id: "virtual-conversa",
        title: "Como continuar sem virar interrogatório",
        minutes: 14,
        summary:
          "Depois da resposta, alterne pergunta, escuta e informação útil.",
        concept: [
          "Conversa digital perde nuance de voz e expressão, então clareza importa ainda mais.",
          "Perguntar demais gera fadiga. Informar demais gera abandono.",
          "Cada mensagem deve avançar apenas um passo.",
        ],
        steps: [
          "Responda ao que a pessoa disse.",
          "Faça uma pergunta de aprofundamento.",
          "Ofereça uma informação relevante.",
          "Espere a resposta antes de avançar.",
        ],
        example: {
          title: "Ritmo de conversa",
          scenario:
            "A pessoa diz que controla pedidos em uma planilha.",
          response:
            "Responda: 'Entendi. E o que mais incomoda na planilha hoje: atualizar status, achar histórico ou organizar os clientes?' Depois de ouvir, conecte apenas o ponto correspondente.",
        },
        mistakes: [
          "Responder com mensagem pronta que ignora o que foi dito.",
          "Mandar bloco enorme de texto.",
          "Cobrar resposta em poucas horas sem motivo.",
        ],
        exercise:
          "Pegue uma conversa antiga e identifique onde você poderia ter feito uma pergunta melhor em vez de enviar mais informação.",
        lifeSkill:
          "Saber manter diálogo escrito melhora colaboração remota, atendimento e relações pessoais.",
      },
      {
        id: "virtual-midia",
        title: "Quando usar texto, áudio, vídeo e link",
        minutes: 12,
        summary:
          "Cada formato tem uma função. Escolher o formato certo diminui atrito.",
        concept: [
          "Texto é fácil de consultar e responder.",
          "Áudio transmite nuance, mas exige tempo e ambiente para ouvir.",
          "Vídeo é útil para mostrar interface.",
          "Link funciona melhor quando a pessoa já entendeu por que deve clicar.",
        ],
        steps: [
          "Use texto para primeira abordagem e perguntas.",
          "Pergunte antes de mandar áudio longo.",
          "Use vídeo curto para demonstrar uma tarefa específica.",
          "Envie link quando houver intenção clara de conhecer ou testar.",
        ],
        example: {
          title: "Vídeo de 40 segundos",
          scenario:
            "Cliente pergunta como acompanha pedidos.",
          response:
            "Grave apenas o fluxo de pedidos e status. Não faça um tour de dez minutos pelo sistema.",
        },
        mistakes: [
          "Áudio de cinco minutos para uma pergunta simples.",
          "Vídeo sem contexto.",
          "Link com 'dá uma olhada' sem explicar o que a pessoa encontrará.",
        ],
        exercise:
          "Grave um vídeo de até 60 segundos mostrando uma única função e revise se os primeiros 10 segundos deixam o objetivo claro.",
        lifeSkill:
          "Escolher o meio certo para cada mensagem melhora comunicação em qualquer ambiente digital.",
      },
    ],
  },
  {
    id: "objecoes",
    category: "Negociação",
    title: "Objeções, preço e fechamento",
    description:
      "Aprenda a entender o que está por trás de uma resistência e responder sem confronto, desconto automático ou pressão.",
    level: "Intermediário",
    objectives: [
      "Identificar o tipo real de objeção.",
      "Responder preço conectando com valor e contexto.",
      "Concluir conversas com próximo passo claro.",
    ],
    lessons: [
      {
        id: "objecoes-entender",
        title: "Não rebata: investigue",
        minutes: 14,
        summary:
          "A frase 'está caro' pode significar orçamento insuficiente, valor não percebido, comparação ou falta de prioridade.",
        concept: [
          "Responder antes de entender pode atacar o problema errado.",
          "Objeção é informação, não duelo.",
          "Uma pergunta curta costuma revelar o motivo real.",
        ],
        steps: [
          "Acolha sem concordar ou discordar imediatamente.",
          "Pergunte o que está pesando na decisão.",
          "Descubra a referência usada pela pessoa.",
          "Responda ao motivo real.",
        ],
        example: {
          title: "Está caro",
          scenario:
            "O cliente diz apenas: 'Achei caro.'",
          response:
            "Responda: 'Entendo. Quando você diz caro, está comparando com alguma ferramenta que já usa ou com o orçamento que separou para isso?'",
        },
        mistakes: [
          "Dar desconto antes de entender.",
          "Dizer 'mas é barato pelo que oferece'.",
          "Questionar a capacidade financeira da pessoa.",
        ],
        exercise:
          "Liste cinco significados possíveis para 'vou pensar' e escreva uma pergunta respeitosa para investigar cada um.",
        lifeSkill:
          "Investigar antes de reagir é útil em conflitos, negociações salariais e decisões importantes.",
      },
      {
        id: "objecoes-preco",
        title: "Como conversar sobre preço e valor",
        minutes: 16,
        summary:
          "Preço é número. Valor é a relação entre o que a pessoa recebe, o problema que resolve e o custo de alternativas.",
        concept: [
          "Comparar apenas preço ignora tempo, ferramentas substituídas e retrabalho.",
          "Você não deve inventar economia. Deve ajudar a pessoa a calcular com os próprios dados.",
          "Preço precisa ser apresentado com transparência e sem esconder recorrência ou condições.",
        ],
        steps: [
          "Confirme o que a pessoa considera importante.",
          "Mostre quais recursos estão ligados à necessidade.",
          "Compare com o processo atual usando dados que ela forneceu.",
          "Explique preço, período e condições claramente.",
        ],
        example: {
          title: "Valor com dados do cliente",
          scenario:
            "A pessoa usa três ferramentas pagas e ainda mantém planilhas.",
          response:
            "Pergunte quanto ela paga e quanto tempo gasta no processo. Faça a comparação com esses números, sem afirmar economia que você não calculou.",
        },
        mistakes: [
          "Criar preço âncora falso.",
          "Ocultar taxa ou recorrência.",
          "Prometer que o sistema 'se paga sozinho'.",
        ],
        exercise:
          "Monte uma planilha simples de comparação usando apenas custos reais e tempo estimado pelo próprio cliente.",
        lifeSkill:
          "Pensar em custo total e valor ajuda nas próprias compras, investimentos e decisões profissionais.",
      },
      {
        id: "objecoes-fechamento",
        title: "Fechamento sem pressão",
        minutes: 14,
        summary:
          "Fechar é transformar interesse em um próximo passo, não encurralar a pessoa.",
        concept: [
          "Próximos passos pequenos reduzem incerteza.",
          "Uma decisão boa precisa ser entendida e voluntária.",
          "Nem toda conversa deve terminar em compra. Às vezes o melhor resultado é agendar outra etapa.",
        ],
        steps: [
          "Resuma o que ficou alinhado.",
          "Pergunte se há alguma dúvida pendente.",
          "Proponha um próximo passo específico.",
          "Se a pessoa não estiver pronta, combine quando retomar ou encerre com respeito.",
        ],
        example: {
          title: "Próximo passo claro",
          scenario:
            "A pessoa gostou da demonstração, mas quer avaliar com o sócio.",
          response:
            "Diga: 'Perfeito. Faz sentido eu te mandar um resumo do que vimos e você me chama depois que conversarem? Se preferir, marcamos 15 minutos com vocês dois.'",
        },
        mistakes: [
          "Inventar urgência.",
          "Perguntar 'o que falta para fechar agora?' de forma agressiva.",
          "Continuar insistindo depois de um não claro.",
        ],
        exercise:
          "Escreva cinco formas de encerrar uma conversa deixando um próximo passo específico e respeitoso.",
        lifeSkill:
          "Saber concluir conversas com clareza melhora reuniões, projetos e acordos pessoais.",
      },
    ],
  },
  {
    id: "persuasao",
    category: "Comunicação",
    title: "Persuasão ética e linguagem de valor",
    description:
      "Aprenda a construir mensagens convincentes com clareza, contraste, especificidade e narrativa, sem técnicas enganosas.",
    level: "Intermediário",
    objectives: [
      "Transformar recurso em benefício e impacto.",
      "Usar contraste e exemplos de forma honesta.",
      "Reconhecer limites entre persuasão e manipulação.",
    ],
    lessons: [
      {
        id: "persuasao-valor",
        title: "Função → benefício → impacto",
        minutes: 14,
        summary:
          "Uma estrutura simples para tornar qualquer explicação mais relevante.",
        concept: [
          "Função descreve o que existe.",
          "Benefício descreve o que fica mais fácil.",
          "Impacto conecta o benefício à rotina da pessoa.",
        ],
        steps: [
          "Nomeie a função.",
          "Pergunte 'e daí?'.",
          "Explique o benefício.",
          "Conecte a uma situação concreta do cliente.",
        ],
        example: {
          title: "Catálogo online",
          scenario:
            "Função: catálogo online.",
          response:
            "Benefício: clientes consultam itens sem depender de atendimento. Impacto: a equipe reduz perguntas repetitivas e pode focar em negociações que realmente precisam de conversa.",
        },
        mistakes: [
          "Confundir benefício com adjetivo.",
          "Inventar impacto financeiro.",
          "Usar o mesmo benefício para todos.",
        ],
        exercise:
          "Faça a estrutura função → benefício → impacto para dez coisas que você usa no dia a dia, não apenas o Orçaly.",
        lifeSkill:
          "Essa estrutura melhora currículos, entrevistas, apresentações de projetos e comunicação de ideias.",
      },
      {
        id: "persuasao-contraste",
        title: "Contraste sem distorção",
        minutes: 13,
        summary:
          "Pessoas entendem valor melhor quando conseguem comparar estados, alternativas ou processos.",
        concept: [
          "Contraste não exige atacar concorrente.",
          "Comparar antes/depois funciona melhor quando ambos são descritos com honestidade.",
          "Uma boa comparação usa critérios relevantes para quem decide.",
        ],
        steps: [
          "Defina o critério de comparação.",
          "Descreva o processo atual.",
          "Descreva a alternativa.",
          "Deixe claro o que melhora e o que continua exigindo trabalho.",
        ],
        example: {
          title: "Antes e depois do processo",
          scenario:
            "Hoje o cliente usa mensagens para acompanhar pedidos.",
          response:
            "Compare busca manual por conversas com uma lista organizada de pedidos e status. Não diga que 'nunca mais haverá erro', porque isso depende do uso da equipe.",
        },
        mistakes: [
          "Comparação injusta.",
          "Escolher só critérios que favorecem sua oferta.",
          "Criar 'preço antigo' que nunca existiu.",
        ],
        exercise:
          "Compare duas ferramentas que você conhece usando cinco critérios objetivos e escreva onde cada uma é melhor.",
        lifeSkill:
          "Comparação por critérios ajuda a pensar melhor sobre compras, carreira e decisões complexas.",
      },
      {
        id: "persuasao-etica",
        title: "Onde termina a persuasão e começa a manipulação",
        minutes: 15,
        summary:
          "Persuasão preserva escolha informada. Manipulação esconde, distorce ou explora vulnerabilidade.",
        concept: [
          "Informação verdadeira ainda pode ser usada de forma enganosa quando omite algo essencial.",
          "Pressão desnecessária reduz qualidade da decisão.",
          "Cliente arrependido custa reputação, suporte e confiança.",
        ],
        steps: [
          "Pergunte se a mensagem é verdadeira.",
          "Pergunte se falta informação que mudaria a decisão.",
          "Pergunte se você aceitaria receber a mesma abordagem.",
          "Prefira clareza mesmo quando ela reduz chance de fechar.",
        ],
        example: {
          title: "Escassez",
          scenario:
            "Você quer acelerar a decisão.",
          response:
            "Só use prazo ou limite se ele realmente existir. Se não existe, diga apenas que pode ajudar quando a pessoa estiver pronta.",
        },
        mistakes: [
          "Escassez falsa.",
          "Depoimento inventado.",
          "Explorar medo ou vergonha.",
        ],
        exercise:
          "Revise cinco anúncios que encontrar hoje e identifique quais informações seriam necessárias para uma decisão realmente informada.",
        lifeSkill:
          "Reconhecer manipulação protege você como consumidor, cidadão e profissional.",
      },
    ],
  },
  {
    id: "organico",
    category: "Marketing",
    title: "Tráfego gratuito e prospecção orgânica",
    description:
      "Aprenda a construir atenção e confiança sem mídia paga usando posicionamento, conteúdo, networking e prospecção contextual.",
    level: "Intermediário",
    objectives: [
      "Escolher público e tema com clareza.",
      "Criar conteúdo baseado em problemas reais.",
      "Construir rotina de prospecção sem spam.",
    ],
    lessons: [
      {
        id: "organico-nicho",
        title: "Escolha quem você quer ajudar",
        minutes: 14,
        summary:
          "Quanto mais específico o público inicial, mais fácil criar mensagem, conteúdo e exemplos relevantes.",
        concept: [
          "Nicho não significa limitar para sempre. Significa começar com contexto.",
          "Conhecimento do dia a dia do público melhora a qualidade da comunicação.",
          "Boa segmentação usa problema, perfil e contexto, não estereótipo.",
        ],
        steps: [
          "Liste segmentos que você entende ou consegue pesquisar.",
          "Escolha problemas recorrentes nesses negócios.",
          "Observe onde essas pessoas conversam e aprendem.",
          "Produza conteúdo e abordagem usando a linguagem do processo, não clichês.",
        ],
        example: {
          title: "Falar com assistência técnica",
          scenario:
            "Você decide começar por assistências de celular.",
          response:
            "Em vez de conteúdo genérico sobre 'gestão', fale de entrada do aparelho, orçamento, peça, status, garantia e retorno ao cliente.",
        },
        mistakes: [
          "Escolher nicho só porque parece lucrativo.",
          "Usar estereótipos sobre o público.",
          "Trocar de nicho toda semana sem aprender nada.",
        ],
        exercise:
          "Escolha um nicho e escreva 20 tarefas ou dores que fazem parte da rotina dele.",
        lifeSkill:
          "Aprender a observar um grupo profundamente melhora pesquisa, comunicação e desenvolvimento de produtos.",
      },
      {
        id: "organico-conteudo",
        title: "Conteúdo que ensina e gera conversa",
        minutes: 17,
        summary:
          "Conteúdo útil não precisa revelar tudo. Precisa ajudar a pessoa a enxergar ou resolver uma parte do problema.",
        concept: [
          "Conteúdo educativo constrói autoridade pela utilidade.",
          "Demonstração de processo costuma ser mais convincente que propaganda.",
          "Consistência é mais importante que explosões ocasionais de postagem.",
        ],
        steps: [
          "Escolha uma dor pequena e específica.",
          "Explique por que ela acontece.",
          "Mostre um método, exemplo ou demonstração.",
          "Finalize com pergunta ou convite coerente.",
        ],
        example: {
          title: "Post sobre pedidos perdidos",
          scenario:
            "Seu público recebe pedidos em vários canais.",
          response:
            "Faça um vídeo mostrando três sinais de que o processo está desorganizado e depois demonstre como uma lista centralizada muda a visualização.",
        },
        mistakes: [
          "Todo post terminar em 'compre agora'.",
          "Copiar tendências sem relação com o público.",
          "Produzir só frases motivacionais genéricas.",
        ],
        exercise:
          "Planeje sete conteúdos: três educativos, dois demonstrativos, um estudo de caso fictício claramente identificado e um convite.",
        lifeSkill:
          "Ensinar publicamente ajuda a organizar conhecimento e desenvolver clareza de pensamento.",
      },
      {
        id: "organico-rotina",
        title: "Prospecção orgânica como sistema",
        minutes: 15,
        summary:
          "Resultado consistente vem de rotina mensurável, não de mandar mensagens aleatórias quando bate ansiedade.",
        concept: [
          "Prospecção pode ser organizada por quantidade de conversas de qualidade, respostas e próximos passos.",
          "Métrica de vaidade não substitui conversa real.",
          "Respeitar limites da plataforma e das pessoas protege reputação.",
        ],
        steps: [
          "Defina um número sustentável de contatos por dia.",
          "Registre quem respondeu e qual contexto.",
          "Faça follow-up apenas quando houver razão.",
          "Revise semanalmente quais abordagens geram conversa de verdade.",
        ],
        example: {
          title: "Rotina pequena e sustentável",
          scenario:
            "Você tem uma hora por dia.",
          response:
            "Use 20 minutos para pesquisar cinco negócios, 20 para abordagens personalizadas e 20 para responder/fazer follow-up. Meça resposta, não quantidade bruta de mensagens.",
        },
        mistakes: [
          "Disparo em massa.",
          "Não registrar conversas.",
          "Confundir visualização de conteúdo com intenção de compra.",
        ],
        exercise:
          "Crie uma planilha simples com contato, contexto, data, resposta e próximo passo. Use por uma semana.",
        lifeSkill:
          "Transformar objetivos em sistemas pequenos e mensuráveis serve para estudo, saúde, carreira e finanças.",
      },
    ],
  },
  {
    id: "pago",
    category: "Marketing",
    title: "Tráfego pago para parceiros",
    description:
      "Aprenda fundamentos de mídia paga: hipótese, público, criativo, página, orçamento, métricas e decisão de continuar ou parar.",
    level: "Avançado",
    objectives: [
      "Entender a lógica de um teste de campanha.",
      "Separar métricas de atenção e métricas de negócio.",
      "Evitar gastar sem hipótese ou critério.",
    ],
    lessons: [
      {
        id: "pago-hipotese",
        title: "Antes do anúncio: escreva uma hipótese",
        minutes: 16,
        summary:
          "Campanha sem hipótese é dinheiro gasto sem saber o que você está aprendendo.",
        concept: [
          "Uma hipótese liga público, problema, mensagem e ação esperada.",
          "Teste bom muda poucas variáveis por vez.",
          "O objetivo do primeiro teste é aprender, não provar que você estava certo.",
        ],
        steps: [
          "Escolha um público específico.",
          "Defina um problema que ele reconhece.",
          "Crie uma mensagem e uma oferta simples.",
          "Defina qual métrica fará você continuar, ajustar ou parar.",
        ],
        example: {
          title: "Hipótese de campanha",
          scenario:
            "Você quer testar donos de pequenas gráficas.",
          response:
            "Hipótese: 'Se mostrarmos a dor de orçamento e acompanhamento para gráficas pequenas, um anúncio demonstrativo levará pessoas interessadas a iniciar conversa ou cadastro.'",
        },
        mistakes: [
          "Anunciar para 'todo empreendedor'.",
          "Mudar público, criativo e página ao mesmo tempo.",
          "Julgar resultado apenas por curtidas.",
        ],
        exercise:
          "Escreva três hipóteses completas de campanha, cada uma para um nicho diferente.",
        lifeSkill:
          "Pensar em hipótese e teste melhora decisões em negócios, produto, estudo e experimentação pessoal.",
      },
      {
        id: "pago-criativo",
        title: "Criativo e página: mantenha a promessa coerente",
        minutes: 17,
        summary:
          "O anúncio cria uma expectativa. A página precisa continuar a mesma conversa.",
        concept: [
          "Criativo precisa ser compreensível antes de ser bonito.",
          "Mensagem específica filtra melhor quem se interessa.",
          "Mudança brusca entre anúncio e destino aumenta abandono.",
        ],
        steps: [
          "Abra com problema ou resultado observável.",
          "Mostre a interface quando ela ajuda a provar a mensagem.",
          "Use chamada simples.",
          "Garanta que a página repete contexto e próximo passo.",
        ],
        example: {
          title: "Coerência",
          scenario:
            "O anúncio fala sobre organizar pedidos.",
          response:
            "A página ou mensagem seguinte deve continuar mostrando pedido e acompanhamento, não abrir com um módulo financeiro aleatório.",
        },
        mistakes: [
          "Criativo bonito sem mensagem.",
          "Promessa exagerada para ganhar clique.",
          "Página que não explica o que acontece depois.",
        ],
        exercise:
          "Escolha três anúncios que você vê hoje e avalie se o destino mantém a mesma promessa.",
        lifeSkill:
          "Coerência entre promessa e entrega é base de confiança em qualquer relação profissional.",
      },
      {
        id: "pago-metricas",
        title: "Métricas, orçamento e quando parar",
        minutes: 19,
        summary:
          "A função das métricas é ajudar a decidir. Não colecionar números para parecer profissional.",
        concept: [
          "Impressão, clique, conversa, cadastro e cliente medem etapas diferentes.",
          "Custo por resultado precisa ser comparado ao valor econômico real do resultado.",
          "Poucos dados exigem cautela; muitos dados ruins exigem mudança.",
        ],
        steps: [
          "Defina o evento mais próximo de valor para o negócio.",
          "Acompanhe custo por etapa.",
          "Identifique onde o funil perde pessoas.",
          "Decida com regra prévia quando pausar ou testar nova hipótese.",
        ],
        example: {
          title: "Muitos cliques, nenhum cadastro",
          scenario:
            "O anúncio recebe atenção, mas ninguém avança.",
          response:
            "Não conclua imediatamente que 'o tráfego está ruim'. Revise mensagem, público, página, confiança e fricção do cadastro.",
        },
        mistakes: [
          "Aumentar orçamento para compensar campanha ruim.",
          "Otimizar para clique quando o objetivo é cliente.",
          "Ignorar custo total da aquisição.",
        ],
        exercise:
          "Desenhe um funil com impressão → clique → conversa → cadastro → cliente e escreva o que você investigaria se cada etapa estivesse fraca.",
        lifeSkill:
          "Ler métricas como sinais de processo ajuda em finanças, saúde, estudo e gestão.",
      },
    ],
  },
  {
    id: "demo",
    category: "Demonstração",
    title: "Demonstração, follow-up e próximo passo",
    description:
      "Aprenda a conduzir uma demonstração curta, manter a conversa viva depois e transformar interesse em uma próxima ação concreta.",
    level: "Intermediário",
    objectives: [
      "Conduzir uma demonstração de cinco a dez minutos.",
      "Fazer perguntas durante a apresentação.",
      "Criar follow-up útil em vez de cobrança.",
    ],
    lessons: [
      {
        id: "demo-roteiro",
        title: "Roteiro de demonstração em cinco minutos",
        minutes: 15,
        summary:
          "Uma demo curta precisa de foco, sequência e contexto.",
        concept: [
          "Cinco minutos são suficientes para provar uma ideia, não para ensinar o produto inteiro.",
          "O melhor roteiro parte de um problema que o cliente já confirmou.",
          "Cada tela precisa responder à pergunta: por que estou mostrando isso?",
        ],
        steps: [
          "30 segundos: confirme objetivo.",
          "3 minutos: mostre o fluxo principal.",
          "1 minuto: mostre visão final ou indicador.",
          "30 segundos: pergunte o que mais chamou atenção.",
        ],
        example: {
          title: "Demo para loja",
          scenario:
            "A dor é acompanhar pedidos.",
          response:
            "Mostre pedido entrando, status mudando e histórico sendo consultado. Depois pergunte como isso se compara ao processo atual.",
        },
        mistakes: [
          "Começar pela configuração.",
          "Demonstrar sem saber a dor.",
          "Passar do tempo sem perceber.",
        ],
        exercise:
          "Faça três demos cronometradas de cinco minutos. Grave a última e conte quantas vezes você mostrou algo sem explicar o motivo.",
        lifeSkill:
          "Apresentar uma ideia com tempo limitado é útil em reuniões, entrevistas e pitches.",
      },
      {
        id: "demo-perguntas",
        title: "Mantenha a demonstração bilateral",
        minutes: 13,
        summary:
          "Uma demo não é palestra. Perguntas curtas mantêm atenção e ajudam a adaptar o caminho.",
        concept: [
          "Perguntas durante a demo verificam entendimento.",
          "Resposta do cliente revela o que merece aprofundamento.",
          "Interação reduz a chance de você seguir um roteiro irrelevante.",
        ],
        steps: [
          "Mostre um fluxo curto.",
          "Pergunte como é feito hoje.",
          "Compare sem julgar.",
          "Aprofunde apenas se houver interesse.",
        ],
        example: {
          title: "Pergunta de comparação",
          scenario:
            "Você mostrou mudança de status de pedido.",
          response:
            "Pergunte: 'Hoje, quando um pedido muda de etapa, como sua equipe fica sabendo?'",
        },
        mistakes: [
          "Perguntar 'entendeu?' a cada minuto.",
          "Usar perguntas apenas para induzir concordância.",
          "Ignorar resposta e voltar ao roteiro.",
        ],
        exercise:
          "Escreva duas perguntas naturais para cada uma das cinco telas mais importantes da sua demo.",
        lifeSkill:
          "Apresentações interativas melhoram ensino, liderança e reuniões.",
      },
      {
        id: "demo-followup",
        title: "Follow-up que agrega contexto",
        minutes: 14,
        summary:
          "Follow-up útil relembra a necessidade, resume o que foi visto e propõe uma ação. Não é 'e aí, decidiu?'.",
        concept: [
          "Pessoas esquecem detalhes da conversa, especialmente quando avaliam várias prioridades.",
          "Resumo reduz esforço para retomar a decisão.",
          "Um bom follow-up respeita tempo e não transforma silêncio em permissão para pressionar.",
        ],
        steps: [
          "Relembre o contexto.",
          "Resuma dois pontos relevantes.",
          "Envie material apenas se ajudar.",
          "Proponha um próximo passo ou deixe a porta aberta.",
        ],
        example: {
          title: "Follow-up no dia seguinte",
          scenario:
            "A pessoa gostou de pedidos e clientes.",
          response:
            "Envie: 'Ontem você comentou que o maior desafio é acompanhar pedidos e não perder histórico de cliente. Separei justamente essas duas partes que vimos. Se quiser, posso te ajudar a testar esse fluxo com um exemplo do seu negócio.'",
        },
        mistakes: [
          "Mandar apenas 'bom dia, alguma novidade?'.",
          "Fazer follow-up diário sem acordo.",
          "Criar culpa por não responder.",
        ],
        exercise:
          "Escreva três follow-ups: após demo, após envio de proposta e após silêncio. Cada um precisa incluir contexto real.",
        lifeSkill:
          "Follow-up com contexto melhora networking, candidaturas, projetos e compromissos profissionais.",
      },
    ],
  },
];

function allLessonIds(course: Course) {
  return course.lessons.map((lesson) => lesson.id);
}

function totalMinutes(course: Course) {
  return course.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
}

export default function PartnerCoursesTab() {
  const [selectedId, setSelectedId] = useState(courses[0].id);
  const [openLessonId, setOpenLessonId] = useState<string | null>(
    courses[0].lessons[0].id,
  );
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          selectedId?: string;
          completedLessons?: string[];
        };

        if (
          parsed.selectedId &&
          courses.some((course) => course.id === parsed.selectedId)
        ) {
          setSelectedId(parsed.selectedId);
        }

        if (Array.isArray(parsed.completedLessons)) {
          setCompletedLessons(new Set(parsed.completedLessons));
        }
      } catch {
        // Progresso local corrompido não deve quebrar a academia.
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const selected = useMemo(
    () => courses.find((course) => course.id === selectedId) || courses[0],
    [selectedId],
  );

  const totalLessons = useMemo(
    () => courses.reduce((sum, course) => sum + course.lessons.length, 0),
    [],
  );

  const overallProgress = Math.round(
    (completedLessons.size / totalLessons) * 100,
  );

  const selectedCompleted = selected.lessons.filter((lesson) =>
    completedLessons.has(lesson.id),
  ).length;

  const selectedProgress = Math.round(
    (selectedCompleted / selected.lessons.length) * 100,
  );

  function persist(nextCompleted: Set<string>, nextSelectedId = selectedId) {
    setCompletedLessons(nextCompleted);

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedId: nextSelectedId,
          completedLessons: Array.from(nextCompleted),
        }),
      );
    } catch {
      // O curso continua funcionando mesmo sem armazenamento local.
    }
  }

  function selectCourse(courseId: string) {
    const course = courses.find((item) => item.id === courseId);
    if (!course) return;

    setSelectedId(courseId);
    setOpenLessonId(course.lessons[0]?.id || null);

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          selectedId: courseId,
          completedLessons: Array.from(completedLessons),
        }),
      );
    } catch {
      // Sem persistência, mas com navegação normal.
    }
  }

  function toggleLessonComplete(lessonId: string) {
    const next = new Set(completedLessons);

    if (next.has(lessonId)) {
      next.delete(lessonId);
    } else {
      next.add(lessonId);
    }

    persist(next);
  }

  function toggleCourseComplete(course: Course) {
    const next = new Set(completedLessons);
    const ids = allLessonIds(course);
    const allDone = ids.every((id) => next.has(id));

    for (const id of ids) {
      if (allDone) {
        next.delete(id);
      } else {
        next.add(id);
      }
    }

    persist(next);
  }

  return (
    <div className="partner-fade-up space-y-5">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#071b3a] p-5 text-white shadow-xl sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_310px] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-200/70">
              Academia do Parceiro
            </p>
            <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.05em] sm:text-4xl">
              Formação comercial para vender melhor e comunicar melhor.
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-white/58">
              Conteúdo pensado para o Orçaly, mas com fundamentos de vendas,
              psicologia, comunicação, marketing e negociação que continuam úteis
              para a vida profissional.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
            <div className="flex items-center justify-between text-xs font-black">
              <span>Progresso geral</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs font-bold text-white/45">
              {completedLessons.size} de {totalLessons} aulas concluídas. O
              progresso fica salvo neste navegador.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <section className="h-fit rounded-[1.8rem] border border-white bg-white p-3 shadow-sm xl:sticky xl:top-24">
          <div className="px-3 py-3">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">
              Trilhas
            </p>
            <h2 className="mt-1 text-xl font-black text-[#071b3a]">
              Escolha o que quer dominar
            </h2>
          </div>

          <div className="grid gap-2">
            {courses.map((course, index) => {
              const active = course.id === selected.id;
              const done = course.lessons.filter((lesson) =>
                completedLessons.has(lesson.id),
              ).length;
              const progress = Math.round(
                (done / course.lessons.length) * 100,
              );

              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => selectCourse(course.id)}
                  className={`rounded-[1.25rem] border p-4 text-left transition ${
                    active
                      ? "border-[#05245c] bg-[#05245c] text-white shadow-lg"
                      : "border-slate-100 bg-[#f8faff] text-[#071b3a] hover:border-blue-200 hover:bg-blue-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black ${
                        active
                          ? "bg-white/15 text-white"
                          : progress === 100
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-white text-[#05245c]"
                      }`}
                    >
                      {progress === 100 ? "✓" : index + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[10px] font-black uppercase tracking-[0.13em] ${
                          active ? "text-cyan-200/70" : "text-slate-400"
                        }`}
                      >
                        {course.category} · {course.level}
                      </span>
                      <strong className="mt-1 block text-sm leading-5">
                        {course.title}
                      </strong>
                      <span
                        className={`mt-2 block text-[11px] font-bold ${
                          active ? "text-white/45" : "text-slate-400"
                        }`}
                      >
                        {course.lessons.length} aulas · {totalMinutes(course)} min
                        · {progress}%
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-[1.8rem] border border-white bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-[#1359a5]">
                  {selected.category}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
                  {selected.level}
                </span>
                <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-violet-600">
                  {selected.lessons.length} aulas · {totalMinutes(selected)} min
                </span>
              </div>

              <h2 className="mt-3 max-w-4xl text-3xl font-black tracking-[-0.045em] text-[#071b3a]">
                {selected.title}
              </h2>
              <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
                {selected.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => toggleCourseComplete(selected)}
              className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black transition ${
                selectedProgress === 100
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-[#05245c] text-white hover:bg-[#031a43]"
              }`}
            >
              {selectedProgress === 100
                ? "✓ Curso concluído"
                : "Marcar curso completo"}
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="rounded-[1.4rem] border border-blue-100 bg-[#f7faff] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                O que você vai dominar
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

            <div className="rounded-[1.4rem] border border-violet-100 bg-violet-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                Progresso do curso
              </p>
              <p className="mt-3 text-4xl font-black tracking-[-0.05em] text-violet-950">
                {selectedProgress}%
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-500"
                  style={{ width: `${selectedProgress}%` }}
                />
              </div>
              <p className="mt-3 text-xs font-bold leading-5 text-violet-800/65">
                {selectedCompleted} de {selected.lessons.length} aulas
                concluídas.
              </p>
            </div>
          </div>

          <div className="mt-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Aulas
              </p>
              <h3 className="mt-1 text-xl font-black text-[#071b3a]">
                Clique em uma aula para estudar
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Cada aula inclui explicação, método, exemplo, erros comuns,
                exercício e aplicação para a vida.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {selected.lessons.map((lesson, index) => {
                const isOpen = openLessonId === lesson.id;
                const isDone = completedLessons.has(lesson.id);

                return (
                  <article
                    key={lesson.id}
                    className={`overflow-hidden rounded-[1.45rem] border transition ${
                      isOpen
                        ? "border-blue-200 bg-white shadow-md"
                        : "border-slate-100 bg-[#fbfcfe]"
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenLessonId((current) =>
                          current === lesson.id ? null : lesson.id,
                        )
                      }
                      className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
                    >
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-black transition ${
                          isDone
                            ? "bg-emerald-100 text-emerald-700"
                            : isOpen
                              ? "bg-[#05245c] text-white"
                              : "bg-blue-50 text-[#05245c]"
                        }`}
                      >
                        {isDone ? "✓" : index + 1}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
                          Aula {index + 1} · {lesson.minutes} min
                        </span>
                        <strong className="mt-1 block text-base leading-6 text-[#071b3a]">
                          {lesson.title}
                        </strong>
                        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                          {lesson.summary}
                        </span>
                      </span>

                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-lg font-black text-[#05245c] transition-transform duration-300 ${
                          isOpen ? "rotate-45" : ""
                        }`}
                      >
                        +
                      </span>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="border-t border-slate-100 p-4 sm:p-6">
                          <section className="rounded-[1.3rem] border border-blue-100 bg-blue-50/60 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#1359a5]">
                              Entenda o conceito
                            </p>
                            <div className="mt-4 grid gap-3">
                              {lesson.concept.map((paragraph) => (
                                <p
                                  key={paragraph}
                                  className="text-sm font-semibold leading-7 text-slate-600"
                                >
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          </section>

                          <div className="mt-4 grid gap-4 xl:grid-cols-2">
                            <section className="rounded-[1.3rem] border border-slate-100 bg-white p-5">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                                Passo a passo
                              </p>
                              <div className="mt-4 grid gap-3">
                                {lesson.steps.map((step, stepIndex) => (
                                  <div
                                    key={step}
                                    className="flex gap-3 rounded-xl bg-[#f8faff] p-3"
                                  >
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#05245c] text-[10px] font-black text-white">
                                      {stepIndex + 1}
                                    </span>
                                    <p className="text-sm font-semibold leading-6 text-slate-600">
                                      {step}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </section>

                            <section className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50 p-5">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                                Exemplo prático
                              </p>
                              <h4 className="mt-3 font-black text-emerald-950">
                                {lesson.example.title}
                              </h4>
                              <p className="mt-2 text-sm font-semibold leading-6 text-emerald-900/70">
                                <strong>Cenário:</strong>{" "}
                                {lesson.example.scenario}
                              </p>
                              <p className="mt-3 rounded-xl bg-white/75 p-4 text-sm font-semibold leading-6 text-emerald-950/75">
                                <strong>Como agir:</strong>{" "}
                                {lesson.example.response}
                              </p>
                            </section>
                          </div>

                          <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
                            <section className="rounded-[1.3rem] border border-red-100 bg-red-50 p-5">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-red-600">
                                Erros comuns
                              </p>
                              <ul className="mt-4 grid gap-3">
                                {lesson.mistakes.map((mistake) => (
                                  <li
                                    key={mistake}
                                    className="flex gap-3 text-sm font-semibold leading-6 text-red-900/70"
                                  >
                                    <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-100 text-[10px] font-black text-red-700">
                                      ×
                                    </span>
                                    {mistake}
                                  </li>
                                ))}
                              </ul>
                            </section>

                            <section className="rounded-[1.3rem] border border-amber-100 bg-amber-50 p-5">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                                Exercício
                              </p>
                              <p className="mt-3 text-sm font-bold leading-7 text-amber-950/75">
                                {lesson.exercise}
                              </p>
                            </section>
                          </div>

                          <section className="mt-4 rounded-[1.3rem] border border-violet-100 bg-violet-50 p-5">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-600">
                              Leve para a vida
                            </p>
                            <p className="mt-3 text-sm font-semibold leading-7 text-violet-950/70">
                              {lesson.lifeSkill}
                            </p>
                          </section>

                          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs font-bold text-slate-400">
                              Estude, pratique e só então marque a aula como
                              concluída.
                            </p>
                            <button
                              type="button"
                              onClick={() => toggleLessonComplete(lesson.id)}
                              className={`rounded-2xl px-5 py-3 text-sm font-black transition ${
                                isDone
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-[#05245c] text-white hover:bg-[#031a43]"
                              }`}
                            >
                              {isDone
                                ? "✓ Aula concluída"
                                : "Marcar aula como concluída"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="mt-7 rounded-[1.5rem] border border-emerald-100 bg-emerald-50 p-5 sm:p-6">
            <p className="font-black text-emerald-900">
              Princípio da Academia do Parceiro
            </p>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-7 text-emerald-900/70">
              O objetivo não é formar alguém que saiba repetir frases prontas.
              É desenvolver raciocínio comercial, comunicação, ética, capacidade
              de diagnóstico e pensamento crítico. Um parceiro que aprende isso
              vende melhor hoje e também leva as habilidades para qualquer
              carreira ou negócio no futuro.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
