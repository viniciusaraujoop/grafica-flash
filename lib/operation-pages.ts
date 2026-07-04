export type OperationMetric = {
  label: string
  value: string
  description: string
}

export type OperationAction = {
  label: string
  href: string
  primary?: boolean
}

export type OperationSection = {
  title: string
  description: string
  items: string[]
}

export type OperationPageDefinition = {
  id: string
  eyebrow: string
  title: string
  description: string
  status: string
  metrics: OperationMetric[]
  actions: OperationAction[]
  sections: OperationSection[]
  emptyTitle: string
  emptyDescription: string
  emptyActionLabel: string
  emptyActionHref: string
}

const voltarPainel: OperationAction = { label: 'Voltar ao painel', href: '/painel' }

export const operationPages = {
  artes: {
    id: 'artes',
    eyebrow: 'Operação gráfica',
    title: 'Artes recebidas',
    description: 'Gerencie arquivos enviados pelos clientes, acompanhe análises e vincule artes aos orçamentos.',
    status: 'MVP visual seguro',
    metrics: [
      { label: 'Artes recebidas', value: '0', description: 'Arquivos enviados pelos clientes.' },
      { label: 'Em análise', value: '0', description: 'Artes aguardando conferência.' },
      { label: 'Aprovadas', value: '0', description: 'Artes prontas para produção.' },
      { label: 'Aguardando correção', value: '0', description: 'Arquivos que precisam de ajuste.' },
    ],
    actions: [voltarPainel, { label: 'Ver pedidos', href: '/painel/pedidos', primary: true }, { label: 'Produção', href: '/painel/producao' }],
    sections: [
      { title: 'Listagem prevista', description: 'A tabela seguirá o padrão visual atual do painel.', items: ['Cliente', 'Orçamento/pedido vinculado', 'Arquivo', 'Data de envio', 'Status', 'Ações'] },
      { title: 'Ações futuras', description: 'As ações ficam preparadas sem criar banco novo neste patch.', items: ['Visualizar', 'Baixar', 'Aprovar', 'Solicitar correção', 'Adicionar observação'] },
      { title: 'Status', description: 'Fluxo pensado para gráfica e personalizados.', items: ['Recebida', 'Em análise', 'Aprovada', 'Reprovada', 'Aguardando nova arte'] },
    ],
    emptyTitle: 'Nenhuma arte recebida ainda.',
    emptyDescription: 'Quando clientes enviarem arquivos pelo orçamento, eles aparecerão aqui.',
    emptyActionLabel: 'Ver pedidos recebidos',
    emptyActionHref: '/painel/pedidos',
  },
  'aprovacao-arte': {
    id: 'aprovacao-arte',
    eyebrow: 'Operação gráfica',
    title: 'Aprovação de arte',
    description: 'Controle artes que precisam de aprovação do cliente ou validação interna antes da produção.',
    status: 'MVP visual seguro',
    metrics: [
      { label: 'Aguardando aprovação', value: '0', description: 'Artes esperando retorno.' },
      { label: 'Aprovadas', value: '0', description: 'Validadas para produção.' },
      { label: 'Correção solicitada', value: '0', description: 'Dependem de ajuste.' },
    ],
    actions: [voltarPainel, { label: 'Ver artes', href: '/painel/artes', primary: true }, { label: 'Produção', href: '/painel/producao' }],
    sections: [
      { title: 'Fluxo de aprovação', description: 'Preparado para não mandar tudo para pedidos.', items: ['Aguardar aprovação', 'Aprovar arte', 'Solicitar correção', 'Recusar arte', 'Registrar observação'] },
      { title: 'Integração futura', description: 'O módulo poderá se conectar com orçamento, proposta e produção.', items: ['Pedido vinculado', 'Cliente', 'Arquivo', 'Histórico de revisão'] },
    ],
    emptyTitle: 'Nenhuma arte aguardando aprovação.',
    emptyDescription: 'Quando clientes enviarem arquivos ou quando uma arte precisar de validação, ela aparecerá aqui.',
    emptyActionLabel: 'Ver artes recebidas',
    emptyActionHref: '/painel/artes',
  },
  entregas: {
    id: 'entregas',
    eyebrow: 'Operação Food',
    title: 'Entregas',
    description: 'Acompanhe entregas, retirada, status e informações do cliente.',
    status: 'MVP visual seguro',
    metrics: [
      { label: 'Aguardando preparo', value: '0', description: 'Pedidos que ainda serão preparados.' },
      { label: 'Prontas para entrega', value: '0', description: 'Pedidos prontos para sair.' },
      { label: 'Saiu para entrega', value: '0', description: 'Pedidos em rota.' },
      { label: 'Entregues', value: '0', description: 'Pedidos finalizados.' },
    ],
    actions: [voltarPainel, { label: 'Ver pedidos', href: '/painel/pedidos', primary: true }, { label: 'Taxas de entrega', href: '/painel/taxas-entrega' }],
    sections: [
      { title: 'Listagem prevista', description: 'Campos pensados para food e delivery.', items: ['Pedido', 'Cliente', 'Endereço', 'Taxa', 'Status', 'Forma de pagamento', 'Horário'] },
      { title: 'Status', description: 'Fluxo simples para operação diária.', items: ['Aguardando preparo', 'Em preparo', 'Pronto para entrega', 'Saiu para entrega', 'Entregue', 'Cancelado'] },
    ],
    emptyTitle: 'Nenhuma entrega registrada ainda.',
    emptyDescription: 'Quando pedidos forem marcados para entrega, eles aparecerão aqui.',
    emptyActionLabel: 'Ver pedidos',
    emptyActionHref: '/painel/pedidos',
  },
  horarios: {
    id: 'horarios',
    eyebrow: 'Operação Food',
    title: 'Horários de funcionamento',
    description: 'Configure os horários em que sua empresa atende, recebe pedidos ou fica indisponível.',
    status: 'MVP visual seguro',
    metrics: [
      { label: 'Dias ativos', value: '0', description: 'Dias configurados para atendimento.' },
      { label: 'Pausas', value: '0', description: 'Intervalos programados.' },
      { label: 'Mensagem', value: 'Padrão', description: 'Texto exibido quando fechado.' },
    ],
    actions: [voltarPainel, { label: 'Editar site', href: '/painel/site', primary: true }, { label: 'Ver pedidos', href: '/painel/pedidos' }],
    sections: [
      { title: 'Campos previstos', description: 'A estrutura visual já fica pronta para o formulário real.', items: ['Dia da semana', 'Abre às', 'Fecha às', 'Pausa início', 'Pausa fim', 'Ativo/inativo', 'Mensagem quando fechado'] },
      { title: 'Uso futuro', description: 'Esses dados poderão aparecer no site público e no marketplace.', items: ['Bloquear pedidos fora de horário', 'Exibir aviso no site', 'Organizar agenda', 'Ajudar atendimento'] },
    ],
    emptyTitle: 'Configure os horários de funcionamento.',
    emptyDescription: 'Esses horários ajudam seus clientes a saber quando podem fazer pedidos.',
    emptyActionLabel: 'Editar site',
    emptyActionHref: '/painel/site',
  },
  'taxas-entrega': {
    id: 'taxas-entrega',
    eyebrow: 'Operação Food',
    title: 'Taxas de entrega',
    description: 'Cadastre regiões, valores, pedido mínimo e tempo estimado de entrega.',
    status: 'MVP visual seguro',
    metrics: [
      { label: 'Regiões', value: '0', description: 'Bairros ou áreas cadastradas.' },
      { label: 'Taxas ativas', value: '0', description: 'Valores disponíveis para clientes.' },
      { label: 'Pedido mínimo', value: 'R$ 0,00', description: 'Regra padrão ainda não configurada.' },
    ],
    actions: [voltarPainel, { label: 'Ver entregas', href: '/painel/entregas', primary: true }, { label: 'Editar site', href: '/painel/site' }],
    sections: [
      { title: 'Campos previstos', description: 'Preparado para taxas por região.', items: ['Região/bairro', 'Valor da taxa', 'Pedido mínimo', 'Tempo estimado', 'Ativo/inativo'] },
      { title: 'Integração futura', description: 'O checkout poderá usar essas regras automaticamente.', items: ['Calcular taxa', 'Validar pedido mínimo', 'Mostrar prazo', 'Bloquear região inativa'] },
    ],
    emptyTitle: 'Nenhuma taxa de entrega cadastrada.',
    emptyDescription: 'Cadastre regiões e valores para organizar entregas.',
    emptyActionLabel: 'Ver entregas',
    emptyActionHref: '/painel/entregas',
  },
  'ordens-servico': {
    id: 'ordens-servico',
    eyebrow: 'Operação Auto/Assistência',
    title: 'Ordens de serviço',
    description: 'Controle serviços, análises, peças, mão de obra, aprovação do cliente e garantias.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Abertas', value: '0', description: 'Ordens de serviço em aberto.' },
      { label: 'Em análise', value: '0', description: 'Aguardando diagnóstico.' },
      { label: 'Em serviço', value: '0', description: 'Em execução.' },
    ],
    actions: [voltarPainel, { label: 'Ver análises', href: '/painel/analises', primary: true }, { label: 'Equipamentos', href: '/painel/equipamentos' }],
    sections: [
      { title: 'Campos futuros', description: 'Base para oficina e assistência.', items: ['Cliente', 'Veículo/equipamento', 'Problema relatado', 'Diagnóstico', 'Peças usadas', 'Mão de obra', 'Valor estimado', 'Status', 'Fotos', 'Garantia'] },
      { title: 'Status', description: 'Fluxo operacional sugerido.', items: ['Recebido', 'Em análise', 'Aguardando aprovação', 'Em serviço', 'Aguardando peça', 'Pronto', 'Entregue', 'Garantia'] },
    ],
    emptyTitle: 'Nenhuma ordem de serviço aberta.',
    emptyDescription: 'Crie ordens para acompanhar análise, execução e entrega.',
    emptyActionLabel: 'Ver pedidos',
    emptyActionHref: '/painel/pedidos',
  },
  analises: {
    id: 'analises',
    eyebrow: 'Operação Auto/Assistência',
    title: 'Análises',
    description: 'Organize diagnósticos, observações, aprovação do cliente e orçamento técnico.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Em análise', value: '0', description: 'Itens aguardando diagnóstico.' },
      { label: 'Aguardando aprovação', value: '0', description: 'Diagnósticos enviados ao cliente.' },
      { label: 'Concluídas', value: '0', description: 'Análises finalizadas.' },
    ],
    actions: [voltarPainel, { label: 'Ordens de serviço', href: '/painel/ordens-servico', primary: true }, { label: 'Equipamentos', href: '/painel/equipamentos' }],
    sections: [
      { title: 'Recursos previstos', description: 'Sem criar estrutura pesada agora.', items: ['Registrar diagnóstico', 'Adicionar fotos', 'Informar peças', 'Solicitar aprovação', 'Gerar orçamento técnico'] },
    ],
    emptyTitle: 'Nenhuma análise aberta.',
    emptyDescription: 'Quando uma solicitação entrar em diagnóstico, ela aparecerá aqui.',
    emptyActionLabel: 'Ver pedidos',
    emptyActionHref: '/painel/pedidos',
  },
  equipamentos: {
    id: 'equipamentos',
    eyebrow: 'Operação Auto/Assistência',
    title: 'Equipamentos e veículos',
    description: 'Cadastre veículo, aparelho ou equipamento vinculado ao cliente e ao atendimento.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Cadastrados', value: '0', description: 'Itens vinculados a clientes.' },
      { label: 'Com histórico', value: '0', description: 'Itens com atendimentos anteriores.' },
      { label: 'Em garantia', value: '0', description: 'Itens com garantia ativa.' },
    ],
    actions: [voltarPainel, { label: 'Clientes/CRM', href: '/painel/crm', primary: true }, { label: 'Ordens de serviço', href: '/painel/ordens-servico' }],
    sections: [
      { title: 'Campos futuros', description: 'Serve para auto e assistência técnica.', items: ['Cliente', 'Tipo', 'Marca', 'Modelo', 'Placa ou número de série', 'Ano', 'Observações', 'Histórico'] },
    ],
    emptyTitle: 'Nenhum equipamento ou veículo cadastrado.',
    emptyDescription: 'Cadastre veículos, aparelhos ou equipamentos para acompanhar histórico e garantia.',
    emptyActionLabel: 'Ver clientes',
    emptyActionHref: '/painel/crm',
  },
  pecas: {
    id: 'pecas',
    eyebrow: 'Operação Auto/Assistência',
    title: 'Peças',
    description: 'Organize peças usadas, custos, fornecedores e vínculo com ordens de serviço.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Peças usadas', value: '0', description: 'Itens vinculados a serviços.' },
      { label: 'Custo previsto', value: 'R$ 0,00', description: 'Soma futura de peças.' },
      { label: 'Fornecedores', value: '0', description: 'Base de fornecedores.' },
    ],
    actions: [voltarPainel, { label: 'Financeiro', href: '/painel/financeiro', primary: true }, { label: 'Ordens de serviço', href: '/painel/ordens-servico' }],
    sections: [
      { title: 'Recursos previstos', description: 'Preparado para integrar com financeiro.', items: ['Registrar peça', 'Informar custo', 'Vincular OS', 'Vincular fornecedor', 'Gerar saída financeira'] },
    ],
    emptyTitle: 'Nenhuma peça registrada.',
    emptyDescription: 'Registre peças usadas para compor custo de serviço e financeiro.',
    emptyActionLabel: 'Ir ao financeiro',
    emptyActionHref: '/painel/financeiro',
  },
  garantias: {
    id: 'garantias',
    eyebrow: 'Operação Auto/Assistência',
    title: 'Garantias',
    description: 'Controle prazos, condições e serviços cobertos por garantia.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Ativas', value: '0', description: 'Garantias dentro do prazo.' },
      { label: 'Vencendo', value: '0', description: 'Garantias próximas do fim.' },
      { label: 'Encerradas', value: '0', description: 'Garantias finalizadas.' },
    ],
    actions: [voltarPainel, { label: 'Ordens de serviço', href: '/painel/ordens-servico', primary: true }, { label: 'Clientes/CRM', href: '/painel/crm' }],
    sections: [
      { title: 'Campos futuros', description: 'Controle simples antes de automação completa.', items: ['Cliente', 'OS vinculada', 'Prazo', 'Condições', 'Status', 'Observações'] },
    ],
    emptyTitle: 'Nenhuma garantia registrada.',
    emptyDescription: 'As garantias vinculadas a serviços aparecerão aqui.',
    emptyActionLabel: 'Ver ordens de serviço',
    emptyActionHref: '/painel/ordens-servico',
  },
  aparelhos: {
    id: 'aparelhos',
    eyebrow: 'Assistência técnica',
    title: 'Aparelhos',
    description: 'Cadastre tipo, marca, modelo, número de série, defeito e fotos do aparelho.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Aparelhos', value: '0', description: 'Aparelhos cadastrados.' },
      { label: 'Em manutenção', value: '0', description: 'Com atendimento aberto.' },
      { label: 'Com garantia', value: '0', description: 'Itens cobertos.' },
    ],
    actions: [voltarPainel, { label: 'Análises', href: '/painel/analises', primary: true }, { label: 'Manutenção', href: '/painel/manutencao' }],
    sections: [
      { title: 'Campos futuros', description: 'Específico para assistência técnica.', items: ['Tipo do aparelho', 'Marca', 'Modelo', 'Número de série', 'Defeito relatado', 'Fotos', 'Observações'] },
    ],
    emptyTitle: 'Nenhum aparelho cadastrado.',
    emptyDescription: 'Quando uma assistência receber um aparelho, ele poderá ser acompanhado aqui.',
    emptyActionLabel: 'Ver pedidos',
    emptyActionHref: '/painel/pedidos',
  },
  defeitos: {
    id: 'defeitos',
    eyebrow: 'Assistência técnica',
    title: 'Defeitos',
    description: 'Classifique defeitos relatados, sintomas, fotos e diagnóstico inicial.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Registrados', value: '0', description: 'Defeitos catalogados.' },
      { label: 'Mais comuns', value: '0', description: 'Base futura de recorrência.' },
      { label: 'Em diagnóstico', value: '0', description: 'Aguardando análise.' },
    ],
    actions: [voltarPainel, { label: 'Aparelhos', href: '/painel/aparelhos', primary: true }, { label: 'Análises', href: '/painel/analises' }],
    sections: [
      { title: 'Recursos previstos', description: 'Organização de atendimento técnico.', items: ['Registrar defeito', 'Anexar fotos', 'Classificar problema', 'Gerar análise técnica'] },
    ],
    emptyTitle: 'Nenhum defeito registrado.',
    emptyDescription: 'Defeitos relatados pelos clientes aparecerão aqui.',
    emptyActionLabel: 'Ver aparelhos',
    emptyActionHref: '/painel/aparelhos',
  },
  manutencao: {
    id: 'manutencao',
    eyebrow: 'Assistência técnica',
    title: 'Manutenção',
    description: 'Acompanhe execução, peças, testes finais, status e retirada.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Em manutenção', value: '0', description: 'Atendimentos em execução.' },
      { label: 'Testes finais', value: '0', description: 'Aguardando validação.' },
      { label: 'Prontos', value: '0', description: 'Disponíveis para retirada.' },
    ],
    actions: [voltarPainel, { label: 'Produção', href: '/painel/producao', primary: true }, { label: 'Garantias', href: '/painel/garantias' }],
    sections: [
      { title: 'Fluxo previsto', description: 'Etapas simples para assistência técnica.', items: ['Atualizar manutenção', 'Registrar peça', 'Teste final', 'Marcar pronto', 'Registrar retirada'] },
    ],
    emptyTitle: 'Nenhum item em manutenção.',
    emptyDescription: 'A manutenção de aparelhos e equipamentos aparecerá aqui.',
    emptyActionLabel: 'Ver produção',
    emptyActionHref: '/painel/producao',
  },
  agenda: {
    id: 'agenda',
    eyebrow: 'Beauty / Barbearia',
    title: 'Agenda',
    description: 'Organize horários, atendimentos, profissionais e lembretes para seus clientes.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Hoje', value: '0', description: 'Agendamentos de hoje.' },
      { label: 'Confirmados', value: '0', description: 'Clientes confirmados.' },
      { label: 'Livres', value: '0', description: 'Horários disponíveis.' },
    ],
    actions: [voltarPainel, { label: 'Profissionais', href: '/painel/profissionais', primary: true }, { label: 'Horários', href: '/painel/horarios' }],
    sections: [
      { title: 'Recursos previstos', description: 'Agenda sem mexer no layout global.', items: ['Criar agendamento', 'Confirmar horário', 'Remarcar cliente', 'Ver agenda do dia', 'Lembrete de retorno'] },
    ],
    emptyTitle: 'Nenhum agendamento cadastrado.',
    emptyDescription: 'Atendimentos e horários marcados aparecerão aqui.',
    emptyActionLabel: 'Configurar horários',
    emptyActionHref: '/painel/horarios',
  },
  profissionais: {
    id: 'profissionais',
    eyebrow: 'Beauty / Barbearia',
    title: 'Profissionais',
    description: 'Organize profissionais, serviços, horários e permissões da equipe.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Profissionais', value: '0', description: 'Equipe cadastrada.' },
      { label: 'Ativos', value: '0', description: 'Disponíveis para atendimento.' },
      { label: 'Comissões', value: '0', description: 'Configurações futuras.' },
    ],
    actions: [voltarPainel, { label: 'Equipe', href: '/painel/configuracoes/equipe', primary: true }, { label: 'Agenda', href: '/painel/agenda' }],
    sections: [
      { title: 'Campos previstos', description: 'A rota reaproveita a área de equipe quando necessário.', items: ['Nome', 'Cargo', 'Serviços', 'Horários', 'Comissão', 'Status'] },
    ],
    emptyTitle: 'Nenhum profissional cadastrado.',
    emptyDescription: 'Adicione profissionais para organizar agenda, serviços e comissões.',
    emptyActionLabel: 'Abrir equipe',
    emptyActionHref: '/painel/configuracoes/equipe',
  },
  pacotes: {
    id: 'pacotes',
    eyebrow: 'Beauty / Eventos',
    title: 'Pacotes',
    description: 'Crie pacotes de serviços, combos, validade, descontos e condições comerciais.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Pacotes', value: '0', description: 'Pacotes cadastrados.' },
      { label: 'Ativos', value: '0', description: 'Disponíveis para venda.' },
      { label: 'Promocionais', value: '0', description: 'Com desconto ativo.' },
    ],
    actions: [voltarPainel, { label: 'Produtos/Serviços', href: '/painel/produtos', primary: true }, { label: 'Cupons', href: '/painel/cupons' }],
    sections: [
      { title: 'Recursos previstos', description: 'Serve para beauty, barbearia e eventos.', items: ['Criar pacote', 'Definir validade', 'Vincular serviços', 'Aplicar desconto'] },
    ],
    emptyTitle: 'Nenhum pacote cadastrado.',
    emptyDescription: 'Crie pacotes para vender serviços combinados ou eventos fechados.',
    emptyActionLabel: 'Ver produtos/serviços',
    emptyActionHref: '/painel/produtos',
  },
  comissoes: {
    id: 'comissoes',
    eyebrow: 'Beauty / Barbearia',
    title: 'Comissões',
    description: 'Controle comissões de profissionais, atendimentos, pacotes e repasses.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'A pagar', value: 'R$ 0,00', description: 'Comissões pendentes.' },
      { label: 'Pagas', value: 'R$ 0,00', description: 'Comissões liquidadas.' },
      { label: 'Profissionais', value: '0', description: 'Com regras de comissão.' },
    ],
    actions: [voltarPainel, { label: 'Financeiro', href: '/painel/financeiro', primary: true }, { label: 'Profissionais', href: '/painel/profissionais' }],
    sections: [
      { title: 'Integração financeira futura', description: 'Preparado para não duplicar lógica agora.', items: ['Definir percentual', 'Vincular profissional', 'Calcular repasse', 'Gerar conta a pagar'] },
    ],
    emptyTitle: 'Nenhuma comissão cadastrada.',
    emptyDescription: 'Comissões de profissionais poderão ser acompanhadas aqui.',
    emptyActionLabel: 'Ir ao financeiro',
    emptyActionHref: '/painel/financeiro',
  },
  eventos: {
    id: 'eventos',
    eyebrow: 'Eventos',
    title: 'Eventos',
    description: 'Organize solicitações, datas, pacotes, contratos, sinal, equipe e checklist.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Solicitações', value: '0', description: 'Eventos recebidos.' },
      { label: 'Reservados', value: '0', description: 'Datas confirmadas.' },
      { label: 'Em preparação', value: '0', description: 'Eventos em checklist.' },
    ],
    actions: [voltarPainel, { label: 'Pacotes', href: '/painel/pacotes', primary: true }, { label: 'Contratos', href: '/painel/contratos' }],
    sections: [
      { title: 'Módulos futuros', description: 'Base para operação de eventos.', items: ['Solicitações', 'Datas disponíveis', 'Pacotes', 'Contratos', 'Sinal/pagamento', 'Checklist do evento', 'Equipe', 'Itens alugados'] },
    ],
    emptyTitle: 'Nenhum evento cadastrado.',
    emptyDescription: 'Solicitações, pacotes e contratos de eventos aparecerão aqui.',
    emptyActionLabel: 'Ver propostas',
    emptyActionHref: '/painel/propostas',
  },
  contratos: {
    id: 'contratos',
    eyebrow: 'Eventos',
    title: 'Contratos',
    description: 'Prepare contratos, termos, aceite, anexos e histórico do evento.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Rascunhos', value: '0', description: 'Contratos em preparação.' },
      { label: 'Enviados', value: '0', description: 'Aguardando aceite.' },
      { label: 'Aceitos', value: '0', description: 'Contratos confirmados.' },
    ],
    actions: [voltarPainel, { label: 'Propostas', href: '/painel/propostas', primary: true }, { label: 'Eventos', href: '/painel/eventos' }],
    sections: [
      { title: 'Recursos previstos', description: 'Sem implementar geração de PDF neste patch.', items: ['Criar contrato', 'Anexar documento', 'Registrar aceite', 'Vincular proposta', 'Vincular evento'] },
    ],
    emptyTitle: 'Nenhum contrato cadastrado.',
    emptyDescription: 'Contratos vinculados a eventos e propostas aparecerão aqui.',
    emptyActionLabel: 'Ver propostas',
    emptyActionHref: '/painel/propostas',
  },
  'checklist-evento': {
    id: 'checklist-evento',
    eyebrow: 'Eventos',
    title: 'Checklist do evento',
    description: 'Organize itens, responsáveis, prazos e conclusão de cada preparação.',
    status: 'Placeholder seguro',
    metrics: [
      { label: 'Itens', value: '0', description: 'Tarefas cadastradas.' },
      { label: 'Pendentes', value: '0', description: 'Ainda não concluídas.' },
      { label: 'Concluídas', value: '0', description: 'Preparações finalizadas.' },
    ],
    actions: [voltarPainel, { label: 'Tarefas', href: '/painel/tarefas', primary: true }, { label: 'Eventos', href: '/painel/eventos' }],
    sections: [
      { title: 'Recursos previstos', description: 'Preparação operacional de eventos.', items: ['Criar checklist', 'Delegar tarefa', 'Definir prazo', 'Marcar como concluído'] },
    ],
    emptyTitle: 'Nenhum checklist criado.',
    emptyDescription: 'Use checklists para organizar etapas e responsáveis de eventos.',
    emptyActionLabel: 'Ver tarefas',
    emptyActionHref: '/painel/tarefas',
  },
} satisfies Record<string, OperationPageDefinition>

export function getOperationPage(id: keyof typeof operationPages) {
  return operationPages[id]
}
