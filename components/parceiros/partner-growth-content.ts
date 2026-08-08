export type PartnerPlaybook = {
  id: string;
  segment: string;
  title: string;
  pains: string[];
  questions: string[];
  demo: string[];
  objections: string[];
  opening: string;
};

export type PartnerObjection = {
  id: string;
  phrase: string;
  meaning: string[];
  ask: string[];
  avoid: string;
  response: string;
  stopWhen: string;
};

export type PartnerTrainerScenario = {
  id: string;
  category: "Vendas" | "Objeções" | "Follow-up" | "Demonstração";
  client: string;
  context: string;
  prompt: string;
  options: Array<{
    text: string;
    score: number;
    feedback: string;
    dimensions: {
      clarity: number;
      diagnosis: number;
      respect: number;
      nextStep: number;
    };
  }>;
};

export type PartnerLibraryItem = {
  id: string;
  channel: string;
  title: string;
  copy: string;
};

export const partnerPlaybooks: PartnerPlaybook[] = [
  {
    id: "grafica",
    segment: "Gráfica",
    title: "Orçamentos, pedidos, artes e produção",
    pains: [
      "Orçamentos espalhados entre WhatsApp, papel e planilha.",
      "Dificuldade para saber o que está em produção e o que aguarda cliente.",
      "Retrabalho ao procurar histórico de pedidos e arquivos.",
      "Vitrine digital pouco organizada ou dependente de atendimento manual.",
    ],
    questions: [
      "Como um orçamento entra hoje e quem acompanha até virar pedido?",
      "Como vocês sabem o que está aguardando arte, aprovação ou produção?",
      "Quando um cliente pede algo parecido com um trabalho antigo, como localizam o histórico?",
      "Quanto do atendimento é gasto apenas respondendo preço e disponibilidade de itens recorrentes?",
    ],
    demo: [
      "Comece em propostas/orçamentos.",
      "Passe para pedido e acompanhamento de status.",
      "Mostre produtos/itens da vitrine.",
      "Finalize com visão operacional e financeiro.",
    ],
    objections: [
      "“Já fazemos pela planilha.”",
      "“Meu WhatsApp já resolve.”",
      "“Minha equipe não vai aprender.”",
    ],
    opening:
      "Vi que vocês trabalham com vários tipos de serviço gráfico. Como vocês organizam hoje o caminho entre orçamento, aprovação e produção?",
  },
  {
    id: "food",
    segment: "Restaurante / Food",
    title: "Cardápio, pedidos, entrega e atendimento",
    pains: [
      "Pedido chega por vários canais.",
      "Taxa de entrega e região viram cálculo manual.",
      "Cliente pergunta repetidamente cardápio, valor e prazo.",
      "Equipe perde visão do que está recebido, em preparo ou saiu.",
    ],
    questions: [
      "De onde vêm mais pedidos hoje?",
      "Como a cozinha ou produção recebe o pedido sem depender de repasse manual?",
      "Como calculam entrega por região?",
      "Como o cliente acompanha se o pedido já saiu?",
    ],
    demo: [
      "Vitrine/cardápio.",
      "Entrada do pedido.",
      "Status da operação.",
      "Entregas e taxas.",
    ],
    objections: [
      "“Já uso marketplace.”",
      "“Meu cliente prefere WhatsApp.”",
      "“Não quero trocar tudo de uma vez.”",
    ],
    opening:
      "Hoje vocês dependem mais de marketplace, WhatsApp ou pedido direto para receber as vendas?",
  },
  {
    id: "loja",
    segment: "Loja / Comércio",
    title: "Produtos, pedidos, estoque e relacionamento",
    pains: [
      "Catálogo desatualizado.",
      "Estoque separado do atendimento.",
      "Histórico de cliente pouco aproveitado.",
      "Pedidos online e presenciais difíceis de acompanhar juntos.",
    ],
    questions: [
      "Como vocês atualizam preço e disponibilidade para o cliente?",
      "Quando um produto acaba, onde isso é controlado?",
      "Vocês conseguem identificar clientes recorrentes?",
      "Como acompanham pedidos que ainda precisam de alguma ação?",
    ],
    demo: [
      "Itens da vitrine.",
      "Pedidos.",
      "Estoque.",
      "CRM e financeiro.",
    ],
    objections: [
      "“Meu Instagram já é minha loja.”",
      "“Tenho poucos produtos.”",
      "“Não preciso de CRM.”",
    ],
    opening:
      "Quando alguém vê um produto no Instagram, qual é o caminho até confirmar o pedido e o pagamento?",
  },
  {
    id: "servicos",
    segment: "Prestador de Serviços",
    title: "Solicitação, proposta, tarefa e cliente",
    pains: [
      "Pedido de orçamento sem retorno.",
      "Prazos guardados na memória.",
      "Cliente sem histórico centralizado.",
      "Proposta e execução desconectadas.",
    ],
    questions: [
      "Como uma nova solicitação vira proposta e depois trabalho?",
      "Como vocês lembram retornos e prazos?",
      "Onde fica o histórico das conversas importantes?",
      "Como acompanham o que está em andamento?",
    ],
    demo: [
      "CRM/cliente.",
      "Propostas.",
      "Tarefas/follow-up.",
      "Financeiro.",
    ],
    objections: [
      "“Sou só eu na empresa.”",
      "“Tenho poucos clientes.”",
      "“Uso agenda e WhatsApp.”",
    ],
    opening:
      "Quando surgem vários orçamentos e retornos na mesma semana, como você garante que nenhum fica para trás?",
  },
  {
    id: "oficina",
    segment: "Oficina / Auto",
    title: "Veículo, ordem, diagnóstico e peças",
    pains: [
      "Histórico do veículo espalhado.",
      "Aprovação de serviço difícil de acompanhar.",
      "Peças, mão de obra e orçamento sem visão única.",
      "Cliente liga para saber status.",
    ],
    questions: [
      "Como vocês registram o que foi diagnosticado em cada veículo?",
      "Como o cliente aprova um serviço adicional?",
      "Onde ficam peças e mão de obra ligadas à ordem?",
      "Como consultam o histórico quando o veículo retorna?",
    ],
    demo: [
      "Veículos.",
      "Ordens de serviço.",
      "Diagnóstico/aprovação.",
      "Peças e financeiro.",
    ],
    objections: [
      "“Meu sistema atual já emite OS.”",
      "“A equipe está acostumada com papel.”",
      "“Não quero cadastrar tudo.”",
    ],
    opening:
      "Quando um veículo retorna meses depois, vocês conseguem recuperar rapidamente diagnóstico, peças e serviços anteriores?",
  },
  {
    id: "assistencia",
    segment: "Assistência Técnica",
    title: "Aparelho, diagnóstico, orçamento e garantia",
    pains: [
      "Aparelhos sem rastreio claro.",
      "Cliente pergunta status várias vezes.",
      "Diagnóstico e aprovação ficam em conversas.",
      "Garantia e retorno difíceis de localizar.",
    ],
    questions: [
      "Como identificam cada aparelho recebido?",
      "Onde registram defeito relatado e diagnóstico técnico?",
      "Como acompanham aprovação do orçamento?",
      "Quando há retorno em garantia, como encontram o histórico?",
    ],
    demo: [
      "Aparelhos.",
      "Diagnóstico.",
      "Manutenção.",
      "Garantia e cliente.",
    ],
    objections: [
      "“Minha ficha de papel funciona.”",
      "“Não tenho volume suficiente.”",
      "“Meu técnico não gosta de sistema.”",
    ],
    opening:
      "Se um cliente ligar agora perguntando o status de um aparelho, quanto tempo leva para localizar exatamente em que etapa ele está?",
  },
  {
    id: "beleza",
    segment: "Beleza / Barbearia",
    title: "Agenda, profissional, serviço e recorrência",
    pains: [
      "Horários confirmados manualmente.",
      "Dificuldade para acompanhar recorrência.",
      "Serviços e profissionais sem visão organizada.",
      "Cliente esquece ou não retorna.",
    ],
    questions: [
      "Como os clientes marcam horário hoje?",
      "Como vocês evitam conflito ou esquecimento?",
      "Conseguem saber quem não volta há muito tempo?",
      "Como acompanham desempenho de serviços e profissionais?",
    ],
    demo: [
      "Agenda.",
      "Profissionais.",
      "Serviços.",
      "Clientes e lembretes.",
    ],
    objections: [
      "“Agenda do celular já serve.”",
      "“Cliente prefere mandar mensagem.”",
      "“Não quero complicar o atendimento.”",
    ],
    opening:
      "Quanto do seu dia é gasto confirmando horário, remarcando e procurando disponibilidade pelo WhatsApp?",
  },
  {
    id: "eventos",
    segment: "Eventos",
    title: "Proposta, contrato, data e execução",
    pains: [
      "Datas e compromissos dispersos.",
      "Proposta não conversa com contrato e execução.",
      "Checklist vive em mensagens.",
      "Equipe e itens do evento difíceis de coordenar.",
    ],
    questions: [
      "Como vocês saem do primeiro orçamento até o contrato?",
      "Onde controlam datas que não podem conflitar?",
      "Como a equipe sabe o que precisa estar pronto para cada evento?",
      "Onde ficam pagamentos, sinal e pendências?",
    ],
    demo: [
      "Propostas.",
      "Eventos/datas.",
      "Contratos.",
      "Checklist e financeiro.",
    ],
    objections: [
      "“Cada evento é diferente.”",
      "“Uso planilha por evento.”",
      "“Minha equipe é temporária.”",
    ],
    opening:
      "Quando existem vários eventos próximos, como você centraliza contrato, checklist, equipe e pagamento sem misturar informações?",
  },
];

export const partnerObjections: PartnerObjection[] = [
  {
    id: "caro",
    phrase: "“Está caro.”",
    meaning: [
      "O valor percebido ainda não acompanha o preço.",
      "Existe uma referência mais barata.",
      "O orçamento disponível é menor.",
      "A prioridade ainda não é alta.",
    ],
    ask: [
      "Quando você diz caro, está comparando com alguma ferramenta específica ou com o orçamento que separou?",
      "Qual parte do processo precisaria melhorar para o investimento fazer sentido?",
    ],
    avoid: "Dar desconto automaticamente ou responder que “é barato pelo que faz”.",
    response:
      "Entendo. Antes de falar em condição, quero conferir se estamos comparando a solução certa com o problema certo. Qual parte do custo ou do valor ainda não fechou para você?",
    stopWhen:
      "Quando a pessoa deixa claro que o orçamento não comporta a contratação agora e não existe alternativa honesta.",
  },
  {
    id: "pensar",
    phrase: "“Vou pensar.”",
    meaning: [
      "Existe dúvida não verbalizada.",
      "Precisa conversar com outra pessoa.",
      "Não é prioridade agora.",
      "É uma forma educada de encerrar.",
    ],
    ask: [
      "Claro. O que você ainda precisa avaliar para tomar uma decisão tranquila?",
      "Tem mais alguém que participa dessa decisão?",
    ],
    avoid: "Pressionar com urgência falsa ou cobrar resposta todo dia.",
    response:
      "Sem problema. Se ajudar, eu resumo os pontos ligados ao que você me contou e deixamos um próximo contato apenas se fizer sentido para você.",
    stopWhen:
      "Quando não há interesse e a pessoa não deseja combinar novo contato.",
  },
  {
    id: "sistema",
    phrase: "“Já uso outro sistema.”",
    meaning: [
      "Pode estar satisfeito.",
      "Pode ter custo de troca alto.",
      "Pode existir uma dor ainda não resolvida.",
    ],
    ask: [
      "O que você mais gosta no sistema atual?",
      "Existe alguma parte que ainda exige planilha, WhatsApp ou trabalho manual?",
    ],
    avoid: "Atacar o concorrente sem conhecer o contexto.",
    response:
      "Se o que você usa resolve bem, não faz sentido trocar só por trocar. Eu tentaria entender se existe alguma parte importante que ainda ficou fora.",
    stopWhen:
      "Quando a solução atual atende bem e não existe necessidade relevante.",
  },
  {
    id: "planilha",
    phrase: "“Minha planilha funciona.”",
    meaning: [
      "O processo atual é familiar.",
      "O volume talvez ainda seja pequeno.",
      "A pessoa não percebe custo de manutenção.",
    ],
    ask: [
      "Qual parte da planilha exige mais atualização manual?",
      "Quem consegue usar e entender ela quando você não está?",
    ],
    avoid: "Ridicularizar planilha; ela pode ser a ferramenta certa para aquele estágio.",
    response:
      "Planilha pode funcionar muito bem. Eu só avaliaria se o tempo de atualização, histórico e dependência de uma pessoa já começaram a incomodar.",
    stopWhen:
      "Quando o processo é simples, barato e realmente atende a necessidade atual.",
  },
  {
    id: "tempo",
    phrase: "“Não tenho tempo para aprender sistema.”",
    meaning: [
      "Medo de implantação.",
      "Experiência ruim anterior.",
      "Rotina já sobrecarregada.",
    ],
    ask: [
      "Qual parte da implantação mais preocupa: cadastro, treinamento ou mudança da rotina?",
      "Você preferiria começar por apenas um fluxo?",
    ],
    avoid: "Prometer que não existe curva de aprendizagem.",
    response:
      "Existe adaptação, como em qualquer ferramenta. O importante é começar pelo fluxo que mais incomoda e ampliar só quando a equipe estiver confortável.",
    stopWhen:
      "Quando a empresa não consegue dedicar nenhum tempo mínimo à mudança.",
  },
  {
    id: "whatsapp",
    phrase: "“Manda no WhatsApp.”",
    meaning: [
      "Pode haver interesse com pouco tempo.",
      "Pode ser uma saída educada.",
    ],
    ask: [
      "Posso te mandar um resumo de uma tela específica ligada ao que conversamos?",
      "Prefere uma demonstração de um minuto ou só o link para ver depois?",
    ],
    avoid: "Mandar dez imagens, áudio longo e link sem contexto.",
    response:
      "Envio sim. Vou mandar só o ponto que conversa com o problema que você comentou, para não virar mais uma mensagem enorme.",
    stopWhen:
      "Quando a pessoa pede explicitamente apenas material e não quer continuar a conversa.",
  },
  {
    id: "nao-preciso",
    phrase: "“Não preciso disso.”",
    meaning: [
      "Pode não existir problema relevante.",
      "Você pode ter apresentado algo irrelevante.",
      "A prioridade está em outra área.",
    ],
    ask: [
      "Sem problema. Hoje qual parte da operação mais toma tempo ou gera retrabalho?",
    ],
    avoid: "Tentar convencer a pessoa de que ela tem um problema que não reconhece.",
    response:
      "Pode ser que realmente não precise agora. Minha única pergunta seria qual processo hoje mais incomoda, para eu saber se existe algum ponto relevante ou se não faz sentido continuar.",
    stopWhen: "Quando não existe dor, prioridade ou interesse.",
  },
  {
    id: "socio",
    phrase: "“Preciso falar com meu sócio.”",
    meaning: [
      "Há outra pessoa na decisão.",
      "O cliente pode precisar de material para explicar internamente.",
    ],
    ask: [
      "Qual ponto seu sócio provavelmente vai querer avaliar primeiro?",
      "Faria sentido uma demo curta com vocês dois?",
    ],
    avoid: "Tentar contornar ou excluir quem também decide.",
    response:
      "Perfeito. Posso te deixar um resumo objetivo e, se ajudar, fazemos uma demonstração curta com vocês dois para ninguém depender de repassar tudo de memória.",
    stopWhen: "Quando a empresa decide internamente e não deseja participação externa.",
  },
  {
    id: "depois",
    phrase: "“Me procura mais para frente.”",
    meaning: [
      "Timing inadequado.",
      "Baixa prioridade.",
      "Orçamento ou operação em transição.",
    ],
    ask: [
      "Existe algum mês ou evento que torna esse assunto mais relevante?",
      "Posso registrar uma data e falar com você só naquele período?",
    ],
    avoid: "Fazer follow-up aleatório toda semana.",
    response:
      "Combinado. Se você me disser um período que faça sentido, eu registro e não fico te chamando antes.",
    stopWhen: "Quando a pessoa não deseja novo contato.",
  },
  {
    id: "resultado",
    phrase: "“Isso vai aumentar meu faturamento?”",
    meaning: [
      "A pessoa quer justificar economicamente a compra.",
      "Pode estar esperando uma promessa impossível.",
    ],
    ask: [
      "Qual resultado você espera melhorar: organização, velocidade, conversão, recorrência ou custo?",
    ],
    avoid: "Prometer aumento de faturamento ou percentual garantido.",
    response:
      "O Orçaly organiza processos e pode apoiar vendas e atendimento, mas faturamento depende de vários fatores. O que eu consigo demonstrar é como o fluxo muda e quais métricas você pode acompanhar.",
    stopWhen: "Quando a contratação depende de garantia de resultado que não pode ser dada.",
  },
];

export const partnerTrainerScenarios: PartnerTrainerScenario[] = [
  {
    id: "planilha-primeiro-contato",
    category: "Vendas",
    client: "Dono de uma pequena gráfica",
    context:
      "Ele usa planilha e WhatsApp, parece ocupado e diz que “por enquanto funciona”.",
    prompt: "Qual seria sua próxima fala?",
    options: [
      {
        text: "Planilha é muito ultrapassada. O Orçaly é muito mais completo.",
        score: 30,
        feedback:
          "Você atacou o processo atual antes de entender onde ele falha. Isso aumenta resistência.",
        dimensions: { clarity: 7, diagnosis: 2, respect: 4, nextStep: 2 },
      },
      {
        text: "Entendo. Qual parte da planilha mais dá trabalho hoje: atualizar pedido, procurar histórico ou acompanhar prazo?",
        score: 95,
        feedback:
          "Boa resposta: respeita o processo atual, faz diagnóstico e cria uma pergunta fácil de responder.",
        dimensions: { clarity: 9, diagnosis: 10, respect: 10, nextStep: 9 },
      },
      {
        text: "Posso te dar 20% de desconto se você testar hoje.",
        score: 20,
        feedback:
          "Você pulou diagnóstico e valor para preço. O cliente ainda nem reconheceu necessidade.",
        dimensions: { clarity: 5, diagnosis: 0, respect: 4, nextStep: 2 },
      },
    ],
  },
  {
    id: "caro-pos-demo",
    category: "Objeções",
    client: "Prestador de serviços",
    context:
      "A demo foi boa, mas ao ouvir o preço ele responde: “para mim está caro”.",
    prompt: "Como você reage?",
    options: [
      {
        text: "Mas é menos de R$ 4 por dia.",
        score: 50,
        feedback:
          "A conta pode ser verdadeira, mas não descobre por que o cliente considera caro.",
        dimensions: { clarity: 7, diagnosis: 3, respect: 7, nextStep: 4 },
      },
      {
        text: "Entendo. Você está comparando com alguma ferramenta atual ou o investimento ficou acima do que planejava?",
        score: 96,
        feedback:
          "Você investiga a referência do cliente sem brigar com a percepção dele.",
        dimensions: { clarity: 9, diagnosis: 10, respect: 10, nextStep: 9 },
      },
      {
        text: "Se fechar agora eu vejo um desconto.",
        score: 25,
        feedback:
          "Desconto antes de diagnóstico ensina o cliente a negociar contra o próprio valor apresentado.",
        dimensions: { clarity: 5, diagnosis: 0, respect: 5, nextStep: 2 },
      },
    ],
  },
  {
    id: "ja-usa-sistema",
    category: "Objeções",
    client: "Loja de roupas",
    context:
      "A dona diz que já utiliza outro sistema e não está procurando trocar.",
    prompt: "Qual resposta preserva melhor a conversa?",
    options: [
      {
        text: "O Orçaly tem muito mais funções, posso te mostrar.",
        score: 35,
        feedback:
          "Você presumiu superioridade sem conhecer o sistema nem a necessidade.",
        dimensions: { clarity: 6, diagnosis: 1, respect: 5, nextStep: 3 },
      },
      {
        text: "Se ele resolve bem, não faz sentido trocar só por trocar. Tem alguma parte da operação que ainda fica fora dele ou exige processo manual?",
        score: 98,
        feedback:
          "Excelente: reduz pressão, aumenta confiança e procura uma lacuna real em vez de fabricar problema.",
        dimensions: { clarity: 10, diagnosis: 10, respect: 10, nextStep: 9 },
      },
      {
        text: "Qual sistema? Provavelmente sai mais caro.",
        score: 15,
        feedback:
          "Ataque prematuro ao concorrente. Você ainda não tem dados para comparar.",
        dimensions: { clarity: 4, diagnosis: 1, respect: 2, nextStep: 1 },
      },
    ],
  },
  {
    id: "followup-silencio",
    category: "Follow-up",
    client: "Dono de restaurante",
    context:
      "Ele viu uma demonstração há quatro dias, disse que conversaria com a equipe e não respondeu.",
    prompt: "Qual follow-up é mais útil?",
    options: [
      {
        text: "Bom dia. Alguma novidade?",
        score: 45,
        feedback:
          "É curto, mas não oferece contexto nem ajuda o cliente a retomar a decisão.",
        dimensions: { clarity: 7, diagnosis: 3, respect: 7, nextStep: 3 },
      },
      {
        text: "Oi! Na nossa conversa você comentou que pedidos espalhados eram o principal ponto. A demo mostrou justamente entrada e acompanhamento. Se ainda estiver avaliando com a equipe, posso resumir esse fluxo em uma mensagem ou deixar para retomarmos quando fizer sentido.",
        score: 96,
        feedback:
          "Contexto, utilidade e liberdade para o cliente. Follow-up forte sem pressão.",
        dimensions: { clarity: 9, diagnosis: 9, respect: 10, nextStep: 10 },
      },
      {
        text: "Consegue me dar um retorno hoje? Preciso organizar minhas condições.",
        score: 20,
        feedback:
          "Você transferiu sua urgência para o cliente sem razão legítima.",
        dimensions: { clarity: 6, diagnosis: 0, respect: 2, nextStep: 2 },
      },
    ],
  },
  {
    id: "demo-muita-funcao",
    category: "Demonstração",
    client: "Assistência técnica",
    context:
      "Durante a demo o cliente disse que o problema principal é saber em que etapa está cada aparelho.",
    prompt: "O que você mostra em seguida?",
    options: [
      {
        text: "Aparelhos → diagnóstico/manutenção → status e histórico, fazendo uma pergunta sobre como ele controla isso hoje.",
        score: 100,
        feedback:
          "Você mantém a demonstração ligada à dor e transforma tela em história de uso.",
        dimensions: { clarity: 10, diagnosis: 10, respect: 10, nextStep: 10 },
      },
      {
        text: "Financeiro, CRM, site, assinatura e todas as configurações para provar que é completo.",
        score: 20,
        feedback:
          "Excesso de informação. O cliente já disse o que quer entender.",
        dimensions: { clarity: 2, diagnosis: 2, respect: 5, nextStep: 1 },
      },
      {
        text: "Paro a demo e falo o preço.",
        score: 35,
        feedback:
          "Ainda existe valor para demonstrar antes de mudar o assunto para investimento.",
        dimensions: { clarity: 5, diagnosis: 3, respect: 6, nextStep: 2 },
      },
    ],
  },
  {
    id: "sem-interesse",
    category: "Vendas",
    client: "Comerciante local",
    context:
      "Depois de uma abordagem curta, ele diz claramente: “obrigado, mas não tenho interesse”.",
    prompt: "O que fazer?",
    options: [
      {
        text: "Perguntar mais três vezes para descobrir a verdadeira objeção.",
        score: 10,
        feedback:
          "Um não claro precisa ser respeitado. Insistência prejudica reputação.",
        dimensions: { clarity: 4, diagnosis: 1, respect: 0, nextStep: 0 },
      },
      {
        text: "Agradecer o tempo, encerrar e deixar contato apenas se ele aceitar.",
        score: 100,
        feedback:
          "Perfeito. Ética comercial inclui saber quando parar.",
        dimensions: { clarity: 10, diagnosis: 8, respect: 10, nextStep: 10 },
      },
      {
        text: "Oferecer desconto para ver se muda de ideia.",
        score: 15,
        feedback:
          "O cliente não apresentou uma objeção de preço; apresentou falta de interesse.",
        dimensions: { clarity: 4, diagnosis: 0, respect: 2, nextStep: 1 },
      },
    ],
  },
];

export const partnerLibraryItems: PartnerLibraryItem[] = [
  {
    id: "whatsapp-primeiro",
    channel: "WhatsApp",
    title: "Primeiro contato",
    copy:
      "Oi, [NOME]! Vi que vocês trabalham com [SEGMENTO] e queria te fazer uma pergunta rápida: hoje vocês organizam pedidos, clientes e operação em um sistema só ou acabam usando várias ferramentas? Trabalho com o Orçaly e posso te mostrar uma demonstração curta se fizer sentido.",
  },
  {
    id: "whatsapp-followup",
    channel: "WhatsApp",
    title: "Follow-up contextual",
    copy:
      "Oi, [NOME]! Retomando nossa conversa: você comentou que [DOR]. Na demonstração vimos [RECURSO/FLUXO] justamente por causa disso. Se ainda estiver avaliando, posso te ajudar com alguma dúvida específica ou deixamos para outro momento.",
  },
  {
    id: "instagram-direct",
    channel: "Instagram",
    title: "Direct",
    copy:
      "Oi! Conheci o perfil de vocês e fiquei curioso sobre como organizam [PROCESSO DO SEGMENTO]. Eu apresento o Orçaly para empresas que querem concentrar site, pedidos, clientes e operação. Posso te mandar uma demo rápida de uma parte que faça sentido para vocês?",
  },
  {
    id: "presencial",
    channel: "Presencial",
    title: "Abertura em 30 segundos",
    copy:
      "Trabalho com uma plataforma para pequenos negócios organizarem atendimento, pedidos e gestão. Antes de explicar qualquer coisa, posso te perguntar como vocês controlam [PROCESSO PRINCIPAL] hoje?",
  },
  {
    id: "reels",
    channel: "Reels / TikTok",
    title: "Roteiro de vídeo curto",
    copy:
      "Gancho: “Se seus pedidos estão no WhatsApp, seu financeiro em planilha e seu catálogo no Instagram, veja isso.” Mostre em 3 cenas: problema real → uma tela do Orçaly resolvendo aquele fluxo → convite para conhecer. Não prometa faturamento ou resultado garantido.",
  },
  {
    id: "story",
    channel: "Story",
    title: "Story com demonstração",
    copy:
      "Story 1: uma dor específica do nicho. Story 2: gravação curta da tela que organiza esse processo. Story 3: “Quer ver como funcionaria no seu negócio?” + seu link/QR de indicação.",
  },
  {
    id: "anuncio",
    channel: "Tráfego pago",
    title: "Estrutura de anúncio",
    copy:
      "Público: [NICHO]. Problema: [DOR OBSERVÁVEL]. Criativo: mostre o processo atual e uma tela do Orçaly. CTA: conhecer/testar. Destino: página ou link de indicação coerente com a promessa. Métrica: custo por conversa, cadastro e cliente.",
  },
];
