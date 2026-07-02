$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\business-types.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-getMenuByBusinessType-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)

if ($content -match "getMenuByBusinessType") {
  Write-Host "getMenuByBusinessType ja existe em lib\business-types.ts. Nenhuma alteracao necessaria." -ForegroundColor Green
} else {
  $append = @'

export type BusinessMenuItem = {
  title: string
  description: string
  href: string
  badge?: string
  prepared?: boolean
}

export function getMenuByBusinessType(type: unknown): BusinessMenuItem[] {
  const config = getBusinessTypeConfig(type)

  const common: BusinessMenuItem[] = [
    { title: 'Dashboard', description: 'Resumo da operação.', href: '/painel' },
    { title: `${config.orderLabel}s`, description: 'Acompanhe solicitações, status e atendimento.', href: '/painel/pedidos' },
    { title: `${config.productLabel}s`, description: 'Cadastre itens, fotos, preços e disponibilidade.', href: '/painel/produtos' },
    { title: 'Clientes', description: 'Histórico, contatos e relacionamento.', href: '/painel/clientes' },
    { title: 'Site', description: 'Edite página pública, cores, textos e catálogo.', href: '/painel/site' },
    { title: 'Configurações', description: 'Empresa, recebimentos, equipe e preferências.', href: '/painel/configuracoes' },
    { title: 'Assinatura', description: 'Plano, renovação e pagamento.', href: '/assinatura' },
  ]

  if (config.id === 'food') {
    return [
      ...common,
      { title: 'Cardápio', description: 'Itens, categorias, adicionais e disponibilidade.', href: '/painel/produtos', badge: 'Food' },
      { title: 'Pedidos do dia', description: 'Pedidos recebidos para preparo, retirada ou entrega.', href: '/painel/pedidos', badge: 'Food' },
      { title: 'Entregas', description: 'Módulo de entrega em preparação para este segmento.', href: '/painel/modulos/entregas', prepared: true },
      { title: 'Horários', description: 'Configure horários de funcionamento.', href: '/painel/modulos/horarios', prepared: true },
      { title: 'Taxas de entrega', description: 'Configure bairros, taxas e pedido mínimo.', href: '/painel/modulos/taxas-entrega', prepared: true },
    ]
  }

  if (config.id === 'graphic' || config.id === 'custom_products') {
    return [
      ...common,
      { title: 'Orçamentos', description: 'Receba medidas, quantidades, arquivos e observações.', href: '/painel/pedidos', badge: 'Gráfica' },
      { title: 'Artes', description: 'Acompanhe arquivos enviados pelos clientes.', href: '/painel/modulos/artes', prepared: true },
      { title: 'Produção', description: 'Controle etapas, prazos e responsáveis.', href: '/painel/producao' },
      { title: 'Aprovação de arte', description: 'Módulo de aprovação em preparação.', href: '/painel/modulos/aprovacao-arte', prepared: true },
    ]
  }

  if (config.id === 'beauty' || config.id === 'barber') {
    return [
      ...common,
      { title: 'Agenda', description: 'Agendamentos em preparação para este segmento.', href: '/painel/modulos/agenda', prepared: true },
      { title: 'Serviços', description: 'Configure serviços, pacotes, duração e preço.', href: '/painel/produtos' },
      { title: 'Profissionais', description: 'Equipe e profissionais em preparação.', href: '/painel/modulos/profissionais', prepared: true },
      { title: 'Horários', description: 'Horários de atendimento em preparação.', href: '/painel/modulos/horarios', prepared: true },
    ]
  }

  if (config.id === 'technical_assistance') {
    return [
      ...common,
      { title: 'Ordens de serviço', description: 'Solicitações, defeitos, análise e proposta.', href: '/painel/pedidos', badge: 'Assistência' },
      { title: 'Diagnósticos', description: 'Módulo de diagnóstico em preparação.', href: '/painel/modulos/diagnosticos', prepared: true },
    ]
  }

  if (config.id === 'auto') {
    return [
      ...common,
      { title: 'Orçamentos auto', description: 'Serviços, veículo, análise e status.', href: '/painel/pedidos', badge: 'Auto' },
      { title: 'Veículos', description: 'Módulo de veículos em preparação.', href: '/painel/modulos/veiculos', prepared: true },
    ]
  }

  if (config.id === 'store') {
    return [
      ...common,
      { title: 'Catálogo', description: 'Produtos, variações, fotos e disponibilidade.', href: '/painel/produtos', badge: 'Loja' },
      { title: 'Pedidos da loja', description: 'Pedidos recebidos pela vitrine digital.', href: '/painel/pedidos', badge: 'Loja' },
    ]
  }

  if (config.id === 'events') {
    return [
      ...common,
      { title: 'Pacotes', description: 'Pacotes, datas e serviços para eventos.', href: '/painel/produtos', badge: 'Eventos' },
      { title: 'Solicitações', description: 'Pedidos de orçamento para eventos.', href: '/painel/pedidos', badge: 'Eventos' },
    ]
  }

  return common
}
'@

  $content = $content.TrimEnd() + "`r`n" + $append.TrimStart() + "`r`n"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

  Write-Host "Export getMenuByBusinessType adicionado em lib\business-types.ts" -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
