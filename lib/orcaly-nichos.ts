export type NichoId =
  | 'grafica'
  | 'personalizados'
  | 'assistencia_tecnica'
  | 'barbearia'
  | 'estetica'
  | 'vidracaria'
  | 'serralheria'
  | 'moveis_planejados'
  | 'oficina'
  | 'loja_local'
  | 'prestador_servico'

export type NichoModelo = {
  id: NichoId
  nome: string
  descricao: string
  categorias: string[]
  perguntas: string[]
  status: string[]
  mensagens_prontas: string[]
  modelo_proposta: {
    titulo: string
    introducao: string
    condicoes: string
    prazo_padrao: string
    validade_horas: number
  }
  campos_recomendados: string[]
}

export const nichosOrcaly: NichoModelo[] = [
  {
    id: 'grafica',
    nome: 'Gráfica',
    descricao: 'Orçamentos de impressos, comunicação visual, arte, produção e retirada.',
    categorias: ['Cartões de visita', 'Panfletos', 'Banners', 'Adesivos', 'Lonas', 'Placas', 'Convites'],
    perguntas: ['Qual material deseja?', 'Já possui a arte?', 'Qual tamanho?', 'Qual quantidade?', 'Qual prazo desejado?', 'Vai retirar ou precisa de entrega?'],
    status: ['Recebido', 'Aguardando arte', 'Aguardando pagamento', 'Em produção', 'Aguardando retirada', 'Saiu para entrega', 'Entregue'],
    mensagens_prontas: ['Recebemos seu orçamento e vamos analisar.', 'Sua arte está em aprovação.', 'Seu pedido entrou em produção.', 'Seu pedido está pronto para retirada.'],
    modelo_proposta: {
      titulo: 'Proposta gráfica personalizada',
      introducao: 'Segue proposta com materiais, quantidades e condições para produção gráfica.',
      condicoes: 'Produção iniciada após aprovação da arte e confirmação do sinal.',
      prazo_padrao: '2 a 5 dias úteis após aprovação da arte.',
      validade_horas: 48,
    },
    campos_recomendados: ['material', 'quantidade', 'largura', 'altura', 'arte', 'acabamento', 'prazo', 'entrega'],
  },
  {
    id: 'personalizados',
    nome: 'Personalizados',
    descricao: 'Produtos customizados, brindes, camisetas, canecas, lembranças e kits.',
    categorias: ['Camisas', 'Canecas', 'Chaveiros', 'Brindes', 'Kits personalizados', 'Lembrancinhas', 'Sacolas'],
    perguntas: ['Qual produto será personalizado?', 'Qual quantidade?', 'Qual cor/tamanho?', 'Personalização em quais lados?', 'Você já tem a arte?', 'Qual prazo?'],
    status: ['Recebido', 'Aguardando arte', 'Aguardando pagamento', 'Em produção', 'Aguardando retirada', 'Saiu para entrega', 'Entregue'],
    mensagens_prontas: ['Recebemos sua ideia de personalização.', 'Precisamos confirmar arte/tamanhos.', 'Seu personalizado entrou em produção.', 'Seu pedido está pronto.'],
    modelo_proposta: {
      titulo: 'Proposta de produto personalizado',
      introducao: 'Segue proposta de personalização conforme produto, quantidade e prazo informados.',
      condicoes: 'Produção após aprovação da arte e pagamento do sinal.',
      prazo_padrao: '3 a 7 dias úteis após aprovação da arte.',
      validade_horas: 48,
    },
    campos_recomendados: ['produto', 'quantidade', 'tamanhos', 'cores', 'arte', 'local_da_personalizacao', 'prazo'],
  },
  {
    id: 'assistencia_tecnica',
    nome: 'Assistência técnica',
    descricao: 'Triagem, diagnóstico, orçamento e acompanhamento de reparos.',
    categorias: ['Celular', 'Notebook', 'Computador', 'Tablet', 'Videogame', 'Periféricos'],
    perguntas: ['Qual aparelho?', 'Qual defeito?', 'Quando começou?', 'Já foi mexido antes?', 'Possui senha ou backup?', 'Deseja retirada/entrega?'],
    status: ['Recebido', 'Em diagnóstico', 'Aguardando aprovação', 'Aguardando peça', 'Em reparo', 'Pronto para retirada', 'Entregue'],
    mensagens_prontas: ['Recebemos seu aparelho para avaliação.', 'Seu diagnóstico está em andamento.', 'Orçamento enviado para aprovação.', 'Seu reparo foi finalizado.'],
    modelo_proposta: {
      titulo: 'Orçamento de assistência técnica',
      introducao: 'Segue orçamento com diagnóstico, serviço e condições para execução do reparo.',
      condicoes: 'Serviço executado após aprovação do orçamento. Peças podem variar conforme disponibilidade.',
      prazo_padrao: '1 a 5 dias úteis, conforme disponibilidade de peça.',
      validade_horas: 72,
    },
    campos_recomendados: ['aparelho', 'modelo', 'defeito', 'diagnostico', 'pecas', 'garantia', 'prazo'],
  },
  {
    id: 'barbearia',
    nome: 'Barbearia',
    descricao: 'Agendamentos, pacotes, serviços e relacionamento com clientes recorrentes.',
    categorias: ['Corte', 'Barba', 'Sobrancelha', 'Pigmentação', 'Combo', 'Assinatura mensal'],
    perguntas: ['Qual serviço deseja?', 'Qual dia e horário?', 'Tem preferência por profissional?', 'É primeira vez?', 'Deseja combo?'],
    status: ['Solicitado', 'Confirmado', 'Aguardando atendimento', 'Em atendimento', 'Finalizado', 'Cancelado'],
    mensagens_prontas: ['Recebemos sua solicitação de horário.', 'Seu horário foi confirmado.', 'Seu atendimento foi finalizado.'],
    modelo_proposta: {
      titulo: 'Agendamento de barbearia',
      introducao: 'Segue confirmação do serviço, horário e condições do atendimento.',
      condicoes: 'Atrasos podem exigir remarcação conforme disponibilidade.',
      prazo_padrao: 'Conforme horário agendado.',
      validade_horas: 24,
    },
    campos_recomendados: ['servico', 'profissional', 'data', 'horario', 'combo', 'observacao'],
  },
  {
    id: 'estetica',
    nome: 'Estética',
    descricao: 'Procedimentos, pacotes, sessões, avaliação e pós-atendimento.',
    categorias: ['Limpeza de pele', 'Depilação', 'Massagem', 'Design de sobrancelha', 'Procedimentos faciais', 'Pacotes'],
    perguntas: ['Qual procedimento deseja?', 'Já fez antes?', 'Tem alguma restrição?', 'Qual dia e horário?', 'Deseja pacote?'],
    status: ['Solicitado', 'Avaliação pendente', 'Confirmado', 'Em atendimento', 'Finalizado', 'Retorno agendado'],
    mensagens_prontas: ['Recebemos sua solicitação.', 'Sua avaliação foi agendada.', 'Seu procedimento foi confirmado.', 'Seu retorno pode ser agendado.'],
    modelo_proposta: {
      titulo: 'Proposta de procedimento estético',
      introducao: 'Segue proposta com procedimento, sessões e orientações gerais.',
      condicoes: 'Procedimento sujeito à avaliação profissional e disponibilidade de agenda.',
      prazo_padrao: 'Conforme agendamento.',
      validade_horas: 48,
    },
    campos_recomendados: ['procedimento', 'sessoes', 'avaliacao', 'restricoes', 'data', 'horario'],
  },
  {
    id: 'vidracaria',
    nome: 'Vidraçaria',
    descricao: 'Medição, orçamento, produção e instalação de vidros e esquadrias.',
    categorias: ['Box', 'Espelho', 'Janelas', 'Portas', 'Guarda-corpo', 'Tampo de mesa', 'Vidro temperado'],
    perguntas: ['Qual tipo de vidro/serviço?', 'Qual medida aproximada?', 'Precisa de instalação?', 'Tem foto do local?', 'Qual bairro?', 'Qual prazo?'],
    status: ['Recebido', 'Aguardando medida', 'Aguardando pagamento', 'Em produção', 'Aguardando instalação', 'Instalado', 'Entregue'],
    mensagens_prontas: ['Recebemos sua solicitação.', 'Precisamos confirmar as medidas.', 'Seu vidro entrou em produção.', 'Sua instalação foi concluída.'],
    modelo_proposta: {
      titulo: 'Proposta de vidraçaria',
      introducao: 'Segue proposta para fornecimento e/ou instalação conforme medidas informadas.',
      condicoes: 'Medidas finais podem ser confirmadas em visita técnica.',
      prazo_padrao: '5 a 12 dias úteis após confirmação de medidas.',
      validade_horas: 72,
    },
    campos_recomendados: ['tipo_vidro', 'largura', 'altura', 'espessura', 'instalacao', 'endereco', 'foto'],
  },
  {
    id: 'serralheria',
    nome: 'Serralheria',
    descricao: 'Portões, grades, estruturas metálicas, soldas e instalações.',
    categorias: ['Portão', 'Grade', 'Corrimão', 'Estrutura metálica', 'Solda', 'Cobertura', 'Manutenção'],
    perguntas: ['Qual serviço?', 'Qual medida aproximada?', 'Qual material?', 'Precisa de instalação?', 'Tem foto do local?', 'Qual prazo?'],
    status: ['Recebido', 'Aguardando medida', 'Aguardando pagamento', 'Em fabricação', 'Aguardando instalação', 'Instalado', 'Entregue'],
    mensagens_prontas: ['Recebemos sua solicitação.', 'Vamos avaliar medidas e material.', 'Sua peça entrou em fabricação.', 'Instalação finalizada.'],
    modelo_proposta: {
      titulo: 'Proposta de serralheria',
      introducao: 'Segue proposta para fabricação, reparo ou instalação conforme necessidade informada.',
      condicoes: 'Execução após aprovação, sinal e confirmação de medidas.',
      prazo_padrao: '7 a 15 dias úteis após confirmação.',
      validade_horas: 72,
    },
    campos_recomendados: ['servico', 'material', 'medidas', 'instalacao', 'foto_local', 'prazo'],
  },
  {
    id: 'moveis_planejados',
    nome: 'Móveis planejados',
    descricao: 'Projetos, ambientes, medição, proposta e etapas de fabricação.',
    categorias: ['Cozinha', 'Quarto', 'Banheiro', 'Sala', 'Home office', 'Painel', 'Guarda-roupa'],
    perguntas: ['Qual ambiente?', 'Tem medidas?', 'Tem referência/foto?', 'Qual material desejado?', 'Precisa de projeto?', 'Qual prazo?'],
    status: ['Recebido', 'Aguardando medidas', 'Projeto em análise', 'Proposta enviada', 'Em fabricação', 'Aguardando instalação', 'Instalado'],
    mensagens_prontas: ['Recebemos sua solicitação de móveis.', 'Precisamos das medidas/referências.', 'Sua proposta está em análise.', 'Seu projeto entrou em fabricação.'],
    modelo_proposta: {
      titulo: 'Proposta de móveis planejados',
      introducao: 'Segue proposta inicial para projeto, fabricação e instalação do ambiente.',
      condicoes: 'Valores podem variar após medição técnica e definição de materiais.',
      prazo_padrao: '20 a 45 dias após aprovação do projeto.',
      validade_horas: 120,
    },
    campos_recomendados: ['ambiente', 'medidas', 'material', 'referencias', 'projeto', 'instalacao'],
  },
  {
    id: 'oficina',
    nome: 'Oficina',
    descricao: 'Serviços automotivos, diagnóstico, peças e acompanhamento.',
    categorias: ['Revisão', 'Freios', 'Suspensão', 'Óleo', 'Elétrica', 'Motor', 'Pneus'],
    perguntas: ['Qual veículo?', 'Qual serviço/defeito?', 'Ano/modelo?', 'Quando percebeu?', 'Já fez diagnóstico?', 'Tem urgência?'],
    status: ['Recebido', 'Em diagnóstico', 'Aguardando aprovação', 'Aguardando peça', 'Em serviço', 'Pronto para retirada', 'Entregue'],
    mensagens_prontas: ['Recebemos sua solicitação.', 'Seu veículo está em diagnóstico.', 'Orçamento enviado para aprovação.', 'Serviço concluído.'],
    modelo_proposta: {
      titulo: 'Orçamento de oficina',
      introducao: 'Segue orçamento com serviço, peças e condições para execução.',
      condicoes: 'Valores de peças podem variar conforme disponibilidade e marca escolhida.',
      prazo_padrao: '1 a 5 dias úteis, conforme peça e serviço.',
      validade_horas: 48,
    },
    campos_recomendados: ['veiculo', 'ano_modelo', 'defeito', 'pecas', 'mao_obra', 'prazo'],
  },
  {
    id: 'loja_local',
    nome: 'Loja local',
    descricao: 'Produtos, pedidos, retirada, entrega e promoções locais.',
    categorias: ['Produtos em estoque', 'Promoções', 'Kits', 'Encomendas', 'Entrega local'],
    perguntas: ['Qual produto deseja?', 'Quantidade?', 'Vai retirar ou entrega?', 'Qual bairro?', 'Forma de pagamento?'],
    status: ['Recebido', 'Separando pedido', 'Aguardando pagamento', 'Aguardando retirada', 'Saiu para entrega', 'Entregue'],
    mensagens_prontas: ['Recebemos seu pedido.', 'Estamos separando seus produtos.', 'Seu pedido saiu para entrega.', 'Pedido entregue.'],
    modelo_proposta: {
      titulo: 'Pedido em loja local',
      introducao: 'Segue resumo do pedido com produtos, valores e condições.',
      condicoes: 'Separação após confirmação do pedido e pagamento, quando aplicável.',
      prazo_padrao: 'Mesmo dia ou próximo dia útil.',
      validade_horas: 24,
    },
    campos_recomendados: ['produto', 'quantidade', 'retirada_entrega', 'bairro', 'pagamento'],
  },
  {
    id: 'prestador_servico',
    nome: 'Prestador de serviço',
    descricao: 'Solicitações gerais, visita técnica, orçamento e execução.',
    categorias: ['Visita técnica', 'Instalação', 'Manutenção', 'Reparo', 'Consultoria', 'Serviço avulso'],
    perguntas: ['Qual serviço precisa?', 'Onde será feito?', 'Tem fotos?', 'Qual urgência?', 'Qual melhor horário?', 'Precisa de visita?'],
    status: ['Recebido', 'Aguardando informações', 'Visita agendada', 'Proposta enviada', 'Em execução', 'Finalizado', 'Entregue'],
    mensagens_prontas: ['Recebemos sua solicitação.', 'Precisamos de algumas informações.', 'Visita técnica agendada.', 'Serviço finalizado.'],
    modelo_proposta: {
      titulo: 'Proposta de serviço',
      introducao: 'Segue proposta para execução do serviço solicitado.',
      condicoes: 'Execução sujeita à confirmação de escopo, data e condições do local.',
      prazo_padrao: 'Conforme agenda e complexidade do serviço.',
      validade_horas: 72,
    },
    campos_recomendados: ['servico', 'endereco', 'fotos', 'urgencia', 'visita', 'prazo'],
  },
]

export function getNichoById(id: string | null | undefined) {
  return nichosOrcaly.find((nicho) => nicho.id === id) || null
}
