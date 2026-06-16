export type ModeloNegocio = {
  id: string
  nome: string
  subtitulo: string
  descricao: string
  exemplos: string[]
  perguntas: string[]
}

export const modelosNegocio: ModeloNegocio[] = [
  {
    id: 'grafica',
    nome: 'Gráfica e personalizados',
    subtitulo: 'Impressos, banners, adesivos e brindes',
    descricao: 'Ideal para empresas que precisam de medidas, material, acabamento e arte.',
    exemplos: ['Banner', 'Cartão de visita', 'Adesivo', 'Camisa personalizada'],
    perguntas: ['Produto', 'Quantidade', 'Material', 'Tamanho', 'Acabamento', 'Prazo desejado', 'Arte pronta?', 'Observação'],
  },
  {
    id: 'assistencia_tecnica',
    nome: 'Assistência técnica',
    subtitulo: 'Celular, computador, eletro e manutenção',
    descricao: 'Ideal para diagnóstico, defeito, marca, modelo, fotos e urgência.',
    exemplos: ['Celular', 'Notebook', 'Computador', 'Eletrodoméstico'],
    perguntas: ['Tipo de aparelho', 'Marca e modelo', 'Defeito apresentado', 'O aparelho liga?', 'Já teve contato com água?', 'Fotos ou links do problema', 'Urgência', 'Observação'],
  },
  {
    id: 'servicos_gerais',
    nome: 'Serviços variados',
    subtitulo: 'Profissionais, agenda e atendimento local',
    descricao: 'Ideal para quem vende serviço por data, horário, local e tipo de atendimento.',
    exemplos: ['Instalação', 'Consultoria', 'Aula', 'Manutenção'],
    perguntas: ['Serviço desejado', 'Data desejada', 'Horário desejado', 'Local do atendimento', 'Preferência de profissional', 'Observação'],
  },
  {
    id: 'alimenticio',
    nome: 'Alimentício',
    subtitulo: 'Restaurante, doces, salgados e encomendas',
    descricao: 'Ideal para pedidos com sabores, tamanhos, retirada, entrega e observações.',
    exemplos: ['Bolos', 'Salgados', 'Marmitas', 'Lanches'],
    perguntas: ['Produto desejado', 'Quantidade', 'Sabor ou variação', 'Tamanho', 'Entrega ou retirada?', 'Data e horário', 'Restrições ou observações'],
  },
  {
    id: 'beleza_estetica',
    nome: 'Beleza e estética',
    subtitulo: 'Salão, barbearia, unhas e procedimentos',
    descricao: 'Ideal para agendamento, profissional, serviço e preferências do cliente.',
    exemplos: ['Corte', 'Barba', 'Unhas', 'Limpeza de pele'],
    perguntas: ['Serviço desejado', 'Data desejada', 'Horário desejado', 'Profissional de preferência', 'Já é cliente?', 'Observação'],
  },
  {
    id: 'automotivo',
    nome: 'Automotivo',
    subtitulo: 'Oficina, estética automotiva e peças',
    descricao: 'Ideal para veículo, modelo, problema, serviço e urgência.',
    exemplos: ['Revisão', 'Lavagem', 'Funilaria', 'Peças'],
    perguntas: ['Tipo de veículo', 'Marca e modelo', 'Ano', 'Serviço desejado', 'Problema apresentado', 'Urgência', 'Fotos ou observações'],
  },
  {
    id: 'eventos',
    nome: 'Eventos e festas',
    subtitulo: 'Buffet, decoração, som, foto e cerimonial',
    descricao: 'Ideal para data, local, convidados, estrutura e tipo de evento.',
    exemplos: ['Aniversário', 'Casamento', 'Formatura', 'Evento corporativo'],
    perguntas: ['Tipo de evento', 'Data do evento', 'Horário', 'Local', 'Número de convidados', 'Serviços necessários', 'Observação'],
  },
  {
    id: 'construcao_reformas',
    nome: 'Construção e reformas',
    subtitulo: 'Obras, reparos, pintura e instalações',
    descricao: 'Ideal para medidas, local, prazo, fotos e materiais.',
    exemplos: ['Pintura', 'Reforma', 'Elétrica', 'Hidráulica'],
    perguntas: ['Serviço desejado', 'Local do serviço', 'Medidas aproximadas', 'Material incluso?', 'Prazo desejado', 'Fotos ou links do local', 'Observação'],
  },
  {
    id: 'moda_varejo',
    nome: 'Moda e varejo',
    subtitulo: 'Roupas, acessórios, calçados e encomendas',
    descricao: 'Ideal para tamanho, cor, variação, retirada e entrega.',
    exemplos: ['Camiseta', 'Calçado', 'Acessório', 'Encomenda'],
    perguntas: ['Produto desejado', 'Tamanho', 'Cor ou modelo', 'Quantidade', 'Entrega ou retirada?', 'Observação'],
  },
  {
    id: 'outros',
    nome: 'Outro tipo de negócio',
    subtitulo: 'Modelo flexível para qualquer empresa',
    descricao: 'Ideal para começar com perguntas simples e adaptar depois.',
    exemplos: ['Orçamento geral', 'Pedido personalizado', 'Serviço sob consulta'],
    perguntas: ['O que você precisa?', 'Quantidade', 'Prazo desejado', 'Detalhes importantes', 'Observação'],
  },
]
