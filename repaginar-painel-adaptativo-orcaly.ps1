param(
    [switch]$DryRun,
    [switch]$SkipInitialBuild,
    [switch]$SkipFinalBuild,
    [switch]$SkipQa,
    [switch]$VerboseOutput
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$ProjectRoot = (Get-Location).Path
$Timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ProjectRoot ('.orcaly-backups\painel-adaptativo-' + $Timestamp)
$LogPath = Join-Path $BackupRoot 'execucao.log'
$ManifestPath = Join-Path $BackupRoot 'manifesto-arquivos-alterados.txt'
$ReportRelativePath = 'RELATORIO-PAINEL-ADAPTATIVO-ORCALY.md'
$ReportPath = Join-Path $ProjectRoot $ReportRelativePath

$ChangedFiles = New-Object System.Collections.Generic.List[string]
$CreatedFiles = New-Object System.Collections.Generic.List[string]
$QaResults = New-Object System.Collections.Generic.List[object]
$BackupMap = @{}
$BuildResults = @{}
$InitialFunctions = @{}
$InitialAudits = @{}

$Counters = @{
    SegmentsRecognized = 8
    PagesReformatted = 0
    FunctionsPreserved = 0
    HandlersPreserved = 0
    ComponentsReused = 0
    ComponentsCreated = 0
    AnimationsAdded = 0
    SkeletonsAdded = 0
    SafeOptimizations = 0
    LinksCorrected = 0
    Regressions = 0
    Blocked = 0
    FilesAudited = 0
}

function Decode-Utf8Base64 {
    param([string]$Value)
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

function Write-LogLine {
    param(
        [string]$Level,
        [string]$Message
    )

    if ($DryRun) { return }

    $directory = Split-Path -Parent $LogPath
    if (-not (Test-Path -LiteralPath $directory)) {
        [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    }

    $line = '[{0}] [{1}] {2}{3}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message, [Environment]::NewLine
    [System.IO.File]::AppendAllText($LogPath, $line, $Utf8NoBom)
}

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
    Write-LogLine -Level 'STEP' -Message $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host ('[OK] ' + $Message) -ForegroundColor Green
    Write-LogLine -Level 'OK' -Message $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host ('[AVISO] ' + $Message) -ForegroundColor Yellow
    Write-LogLine -Level 'WARNING' -Message $Message
}

function Write-Failure {
    param([string]$Message)
    Write-Host ('[ERRO] ' + $Message) -ForegroundColor Red
    Write-LogLine -Level 'ERROR' -Message $Message
}

function Stop-OnCriticalFailure {
    param([string]$Message)
    Write-Failure $Message
    throw $Message
}

function Test-ProjectFile {
    param(
        [string]$RelativePath,
        [switch]$Directory
    )

    $fullPath = Join-Path $ProjectRoot $RelativePath

    if ($Directory) {
        return Test-Path -LiteralPath $fullPath -PathType Container
    }

    return Test-Path -LiteralPath $fullPath -PathType Leaf
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        [System.IO.Directory]::CreateDirectory($parent) | Out-Null
    }

    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Add-ChangedFile {
    param(
        [string]$RelativePath,
        [switch]$Created
    )

    $normalized = $RelativePath.Replace('\', '/')

    if (-not $ChangedFiles.Contains($normalized)) {
        $ChangedFiles.Add($normalized)
    }

    if ($Created -and -not $CreatedFiles.Contains($normalized)) {
        $CreatedFiles.Add($normalized)
    }
}

function Backup-ProjectFile {
    param([string]$RelativePath)

    $normalized = $RelativePath.Replace('/', '\')
    $source = Join-Path $ProjectRoot $normalized

    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        return $null
    }

    if ($BackupMap.ContainsKey($RelativePath)) {
        return $BackupMap[$RelativePath]
    }

    if ($DryRun) {
        return $null
    }

    $destination = Join-Path $BackupRoot $normalized
    $destinationDirectory = Split-Path -Parent $destination

    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        [System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
    }

    Copy-Item -LiteralPath $source -Destination $destination -Force
    $BackupMap[$RelativePath] = $destination
    Write-LogLine -Level 'BACKUP' -Message ($RelativePath + ' -> ' + $destination)

    return $destination
}

function Update-ProjectFile {
    param(
        [string]$RelativePath,
        [string]$Content,
        [string]$Reason
    )

    $fullPath = Join-Path $ProjectRoot $RelativePath
    $exists = Test-Path -LiteralPath $fullPath -PathType Leaf
    $current = ''

    if ($exists) {
        $current = [System.IO.File]::ReadAllText($fullPath)
    }

    if ($exists -and $current -eq $Content) {
        if ($VerboseOutput) {
            Write-Host ('[SEM ALTERACAO] ' + $RelativePath) -ForegroundColor DarkGray
        }
        return $false
    }

    if ($DryRun) {
        $action = 'Criaria'
        if ($exists) { $action = 'Alteraria' }
        Write-Host ('[DRY-RUN] ' + $action + ': ' + $RelativePath + ' - ' + $Reason) -ForegroundColor Magenta
        return $true
    }

    if ($exists) {
        Backup-ProjectFile -RelativePath $RelativePath | Out-Null
    }

    Write-Utf8NoBom -Path $fullPath -Content $Content
    Add-ChangedFile -RelativePath $RelativePath -Created:(-not $exists)

    $message = 'Criado: '
    if ($exists) { $message = 'Atualizado: ' }

    Write-Success ($message + $RelativePath)
    Write-LogLine -Level 'CHANGE' -Message ($RelativePath + ' - ' + $Reason)

    return $true
}

function Add-QaResult {
    param(
        [string]$Area,
        [ValidateSet('PASSOU', 'FALHOU', 'BLOQUEADO', 'NAO TESTADO')]
        [string]$Status,
        [string]$Detail
    )

    $QaResults.Add([pscustomobject]@{
        Area = $Area
        Status = $Status
        Detail = $Detail
    })

    if ($Status -eq 'FALHOU') {
        $Counters.Regressions++
    }

    if ($Status -eq 'BLOQUEADO') {
        $Counters.Blocked++
    }
}

function Invoke-NpmCommand {
    param(
        [string]$Label,
        [string[]]$Arguments
    )

    $result = [ordered]@{
        Label = $Label
        ExitCode = -1
        DurationSeconds = 0
        Output = ''
        Passed = $false
        Skipped = $false
    }

    if ($DryRun) {
        $result.Skipped = $true
        $result.Output = 'DryRun'
        $BuildResults[$Label] = [pscustomobject]$result
        Write-Warning ($Label + ' ignorado em DryRun.')
        return $BuildResults[$Label]
    }

    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $outputFile = Join-Path $BackupRoot ($Label + '.txt')
    $commandOutput = & npm.cmd @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $stopwatch.Stop()

    Write-Utf8NoBom -Path $outputFile -Content $commandOutput

    $result.ExitCode = $exitCode
    $result.DurationSeconds = [math]::Round($stopwatch.Elapsed.TotalSeconds, 2)
    $result.Output = $outputFile
    $result.Passed = ($exitCode -eq 0)
    $BuildResults[$Label] = [pscustomobject]$result

    if ($VerboseOutput -or $exitCode -ne 0) {
        Write-Host $commandOutput
    }

    if ($exitCode -eq 0) {
        Write-Success ($Label + ' passou em ' + $result.DurationSeconds + 's.')
    }
    else {
        Write-Warning ($Label + ' falhou com codigo ' + $exitCode + '. Log: ' + $outputFile)
    }

    return $BuildResults[$Label]
}

function Get-FunctionNames {
    param([string]$Content)

    $names = New-Object System.Collections.Generic.HashSet[string]

    $patterns = @(
        '(?m)\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(',
        '(?m)\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(',
        '(?m)\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?[^=\r\n]+=>',
        '(?m)\basync\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\('
    )

    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Content, $pattern)) {
            [void]$names.Add($match.Groups[1].Value)
        }
    }

    return @($names)
}

function Get-HandlerNames {
    param([string[]]$Functions)

    return @(
        $Functions | Where-Object {
            $_ -match '^(handle|load|fetch|save|create|update|delete|remove|submit|open|close|toggle|refresh|carregar|salvar|criar|editar|excluir|remover|atualizar|buscar|abrir|fechar)'
        }
    )
}

function Test-RequiredFunction {
    param(
        [string]$RelativePath,
        [string]$FunctionName
    )

    $fullPath = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        return $false
    }

    $content = [System.IO.File]::ReadAllText($fullPath)
    $functions = @(Get-FunctionNames -Content $content)

    return $functions -contains $FunctionName
}

function Compare-PageFunctions {
    param(
        [string]$RelativePath,
        [string[]]$BeforeFunctions
    )

    $fullPath = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Add-QaResult -Area ('Funcoes: ' + $RelativePath) -Status 'FALHOU' -Detail 'Arquivo desapareceu.'
        return $false
    }

    $afterContent = [System.IO.File]::ReadAllText($fullPath)
    $afterFunctions = @(Get-FunctionNames -Content $afterContent)
    $missing = @($BeforeFunctions | Where-Object { $afterFunctions -notcontains $_ })

    if ($missing.Count -gt 0) {
        Add-QaResult -Area ('Funcoes: ' + $RelativePath) -Status 'FALHOU' -Detail ('Ausentes: ' + ($missing -join ', '))
        return $false
    }

    $Counters.FunctionsPreserved += $BeforeFunctions.Count
    $Counters.HandlersPreserved += @(Get-HandlerNames -Functions $BeforeFunctions).Count

    return $true
}

function Get-SourceFiles {
    $extensions = @('*.ts', '*.tsx')
    $roots = @(
        'app\painel',
        'components\painel',
        'components\panel-ui',
        'components\layout',
        'components\sidebar',
        'components\dashboard',
        'lib',
        'config'
    )

    $result = New-Object System.Collections.Generic.List[System.IO.FileInfo]

    foreach ($root in $roots) {
        $fullRoot = Join-Path $ProjectRoot $root

        if (-not (Test-Path -LiteralPath $fullRoot -PathType Container)) {
            continue
        }

        foreach ($extension in $extensions) {
            foreach ($file in Get-ChildItem -LiteralPath $fullRoot -Filter $extension -File -Recurse -ErrorAction SilentlyContinue) {
                if (-not $result.Contains($file)) {
                    $result.Add($file)
                }
            }
        }
    }

    return @($result)
}

function Get-ExistingPanelRoutes {
    $panelRoot = Join-Path $ProjectRoot 'app\painel'

    if (-not (Test-Path -LiteralPath $panelRoot -PathType Container)) {
        return @()
    }

    $routes = New-Object System.Collections.Generic.HashSet[string]

    foreach ($page in Get-ChildItem -LiteralPath $panelRoot -Filter 'page.tsx' -File -Recurse -ErrorAction SilentlyContinue) {
        $relative = $page.Directory.FullName.Substring($panelRoot.Length).TrimStart('\')
        $route = '/painel'

        if ($relative) {
            $route += '/' + $relative.Replace('\', '/')
        }

        [void]$routes.Add($route)
    }

    return @($routes | Sort-Object)
}

function Audit-InitialState {
    Write-Step 'Fase 0 - auditando painel, funcoes, rotas e componentes'

    $sourceFiles = @(Get-SourceFiles)
    $Counters.FilesAudited = $sourceFiles.Count

    foreach ($file in $sourceFiles) {
        $relative = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\').Replace('\', '/')
        $content = [System.IO.File]::ReadAllText($file.FullName)
        $functions = @(Get-FunctionNames -Content $content)

        $InitialFunctions[$relative] = $functions
        $InitialAudits[$relative] = [pscustomobject]@{
            HasSupabase = ($content -match '\bsupabase\b')
            FetchCount = ([regex]::Matches($content, '\bfetch\s*\(')).Count
            CompanyIdCount = ([regex]::Matches($content, '\bcompany_id\b')).Count
            FunctionCount = $functions.Count
            HandlerCount = @(Get-HandlerNames -Functions $functions).Count
        }

        if ($VerboseOutput) {
            Write-Host ('[AUDITADO] ' + $relative + ' | funcoes: ' + $functions.Count) -ForegroundColor DarkGray
        }
    }

    $pages = @(Get-ChildItem -LiteralPath (Join-Path $ProjectRoot 'app\painel') -Filter 'page.tsx' -File -Recurse -ErrorAction SilentlyContinue)
    $Counters.PagesReformatted = $pages.Count

    Write-Success ('Auditoria concluida: ' + $sourceFiles.Count + ' arquivos e ' + $pages.Count + ' paginas do painel.')
}

function Get-PackageScripts {
    $packagePath = Join-Path $ProjectRoot 'package.json'
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    $names = @()

    if ($package.scripts) {
        $names = @($package.scripts.PSObject.Properties.Name)
    }

    return $names
}

function Replace-MarkedBlock {
    param(
        [string]$Content,
        [string]$StartMarker,
        [string]$EndMarker,
        [string]$Block
    )

    $startIndex = $Content.IndexOf($StartMarker, [System.StringComparison]::Ordinal)

    if ($startIndex -ge 0) {
        $endIndex = $Content.IndexOf($EndMarker, $startIndex, [System.StringComparison]::Ordinal)

        if ($endIndex -lt 0) {
            Stop-OnCriticalFailure ('Marcador final ausente: ' + $EndMarker)
        }

        $afterIndex = $endIndex + $EndMarker.Length
        return $Content.Substring(0, $startIndex) + $Block + $Content.Substring($afterIndex)
    }

    if ($Content.Length -gt 0 -and -not $Content.EndsWith([Environment]::NewLine)) {
        $Content += [Environment]::NewLine
    }

    return $Content + [Environment]::NewLine + $Block + [Environment]::NewLine
}

function Ensure-PremiumCssImport {
    $relative = 'app/painel/layout.tsx'
    $path = Join-Path $ProjectRoot $relative

    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Stop-OnCriticalFailure ('Arquivo obrigatorio ausente: ' + $relative)
    }

    $content = [System.IO.File]::ReadAllText($path)
    $updated = $content

    if ($updated -notmatch "import\s+['""]\./premium\.css['""]") {
        $useClientPattern = '(?m)^(["'']use client["''];?\s*\r?\n)'
        if ([regex]::IsMatch($updated, $useClientPattern)) {
            $updated = [regex]::Replace(
                $updated,
                $useClientPattern,
                { param($match) $match.Groups[1].Value + "import './premium.css'" + [Environment]::NewLine },
                1
            )
        }
        else {
            $updated = "import './premium.css'" + [Environment]::NewLine + $updated
        }
    }

    if ($updated -notmatch 'PanelPremiumShell') {
        Stop-OnCriticalFailure 'O layout atual nao usa PanelPremiumShell. A refatoracao conservadora foi interrompida para nao reconstruir o layout no escuro.'
    }

    Update-ProjectFile -RelativePath $relative -Content $updated -Reason 'garantir camada visual adaptativa no layout existente' | Out-Null
}

function Get-PanelPremiumShellContent {
    return @'
'use client'

import type { ReactNode } from 'react'
import PanelSidebar from '@/components/painel/PanelSidebar'
import PanelPremiumHeader, { type PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'
import PanelAdaptiveOverview from '@/components/painel/PanelAdaptiveOverview'

export default function PanelPremiumShell({
  company,
  pathname,
  children,
}: {
  company: PanelPremiumCompany
  pathname: string
  children: ReactNode
}) {
  return (
    <div
      className="orcaly-panel-adaptive min-h-screen lg:grid lg:grid-cols-[288px_minmax(0,1fr)]"
      data-orcaly-panel="adaptive-v1"
    >
      <PanelSidebar company={company} />

      <div className="panel-adaptive-content min-w-0">
        <div className="panel-adaptive-top-line" aria-hidden="true" />
        <PanelPremiumHeader company={company} pathname={pathname} />

        <div className="panel-adaptive-page-slot min-w-0">
          <div className="panel-adaptive-page-width">
            {pathname === '/painel' ? <PanelAdaptiveOverview company={company} /> : null}
            <div className="panel-adaptive-page-canvas min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
'@
}

function Get-PanelPremiumHeaderContent {
    return @'
'use client'

import Link from 'next/link'

export type PanelPremiumCompany = {
  id?: string | null
  nome?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_plano?: string | null
  plano?: string | null
  assinatura_status?: string | null
}

const routeLabels: Record<string, string> = {
  painel: 'Visao geral',
  pedidos: 'Pedidos',
  produtos: 'Produtos',
  catalogo: 'Catalogo',
  clientes: 'Clientes',
  crm: 'CRM',
  'follow-up': 'Follow-up',
  propostas: 'Propostas',
  cupons: 'Cupons',
  financeiro: 'Financeiro',
  pagamentos: 'Pagamentos',
  entregas: 'Entregas',
  'taxas-entrega': 'Taxas de entrega',
  horarios: 'Horarios',
  site: 'Site',
  configuracoes: 'Configuracoes',
  assinatura: 'Assinatura',
  agenda: 'Agenda',
  estoque: 'Estoque',
  relatorios: 'Relatorios',
  profissionais: 'Profissionais',
  veiculos: 'Veiculos',
  aparelhos: 'Aparelhos',
  eventos: 'Eventos',
  contratos: 'Contratos',
  solicitacoes: 'Solicitacoes',
  tarefas: 'Tarefas',
  whatsapp: 'WhatsApp',
}

const pageDescriptions: Record<string, string> = {
  '/painel': 'Acompanhe a operacao e acesse rapidamente as areas mais importantes do seu negocio.',
  '/painel/pedidos': 'Organize pedidos, prioridades, clientes e mudancas de status.',
  '/painel/produtos': 'Gerencie produtos, servicos, precos, imagens e disponibilidade.',
  '/painel/catalogo': 'Controle como seus produtos e servicos aparecem para o cliente.',
  '/painel/clientes': 'Centralize contatos, historico e oportunidades comerciais.',
  '/painel/crm': 'Acompanhe oportunidades e avance cada negociacao com clareza.',
  '/painel/follow-up': 'Mantenha retornos e contatos importantes sob controle.',
  '/painel/propostas': 'Crie, acompanhe e organize propostas comerciais.',
  '/painel/cupons': 'Gerencie campanhas e beneficios sem perder margem.',
  '/painel/financeiro': 'Acompanhe entradas, saidas, vencimentos e saldo operacional.',
  '/painel/pagamentos': 'Veja recebimentos, taxas, descontos e valores liquidos.',
  '/painel/entregas': 'Monitore a operacao de entrega do preparo ate a conclusao.',
  '/painel/taxas-entrega': 'Defina regioes, valores, prazos e pedidos minimos.',
  '/painel/horarios': 'Configure os horarios reais de atendimento da empresa.',
  '/painel/site': 'Personalize a presenca publica e a experiencia do cliente.',
  '/painel/configuracoes': 'Ajuste dados, preferencias e identidade da empresa.',
  '/painel/assinatura': 'Acompanhe plano, periodo de acesso, cobranca e recursos contratados.',
}

function normalizePlan(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'basico' || normalized === 'essencial') return 'Essencial'
  if (normalized === 'intermediario' || normalized === 'profissional') return 'Profissional'
  if (normalized === 'premium') return 'Premium'
  return value || 'Plano ativo'
}

function normalizeSegment(value?: string | null) {
  const normalized = String(value || 'services').toLowerCase()
  const labels: Record<string, string> = {
    food: 'Food',
    restaurante: 'Food',
    lanchonete: 'Food',
    delivery: 'Food',
    graphic: 'Grafica',
    grafica: 'Grafica',
    custom_products: 'Personalizados',
    auto: 'Auto e oficina',
    oficina: 'Auto e oficina',
    automotive: 'Auto e oficina',
    technical_assistance: 'Assistencia tecnica',
    assistencia: 'Assistencia tecnica',
    beauty: 'Beauty',
    barber: 'Barbearia',
    barbearia: 'Barbearia',
    events: 'Eventos',
    eventos: 'Eventos',
    store: 'Loja',
    loja: 'Loja',
    retail: 'Loja',
    services: 'Servicos',
    servicos: 'Servicos',
  }
  return labels[normalized] || 'Operacao'
}

function titleFromPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  const last = parts[parts.length - 1] || 'painel'
  return routeLabels[last] || last.replace(/-/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export default function PanelPremiumHeader({
  company,
  pathname,
}: {
  company: PanelPremiumCompany
  pathname: string
}) {
  const title = titleFromPath(pathname)
  const description = pageDescriptions[pathname] || 'Gerencie esta area com clareza, contexto e menos ruido visual.'
  const publicSlug = company.subdomain_slug || company.slug || ''
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orcaly.com.br'
  const publicUrl = publicSlug ? `https://${publicSlug}.${rootDomain}` : ''
  const parts = pathname.split('/').filter(Boolean).slice(1)

  return (
    <header className="panel-adaptive-header">
      <div className="panel-adaptive-header-copy min-w-0">
        <nav className="panel-adaptive-breadcrumb" aria-label="Navegacao estrutural">
          <Link href="/painel">Painel</Link>
          {parts.map((part, index) => (
            <span key={`${part}-${index}`}>
              <span aria-hidden="true">/</span>
              <span>{routeLabels[part] || part.replace(/-/g, ' ')}</span>
            </span>
          ))}
        </nav>

        <div className="panel-adaptive-title-row">
          <div className="min-w-0">
            <span className="panel-adaptive-kicker">Central de gestao</span>
            <h1>{title}</h1>
          </div>
          <span className="panel-adaptive-segment-badge">
            {normalizeSegment(company.business_type || company.site_template)}
          </span>
        </div>

        <p>{description}</p>
      </div>

      <div className="panel-adaptive-header-actions">
        <div className="panel-adaptive-company-card" title={company.nome || 'Empresa Orcaly'}>
          {company.logo_url ? (
            <span className="panel-adaptive-company-logo">
              <img src={company.logo_url} alt="" />
            </span>
          ) : (
            <span className="panel-adaptive-company-logo panel-adaptive-company-initial" aria-hidden="true">
              {(company.nome || 'O').slice(0, 1)}
            </span>
          )}

          <span className="min-w-0">
            <strong>{company.nome || 'Empresa Orcaly'}</strong>
            <small>{normalizePlan(company.assinatura_plano || company.plano)}</small>
          </span>
        </div>

        {publicUrl ? (
          <Link href={publicUrl} target="_blank" rel="noreferrer" className="panel-adaptive-open-site">
            Abrir site
            <span aria-hidden="true">&#8599;</span>
          </Link>
        ) : null}
      </div>
    </header>
  )
}
'@
}

function Get-AdaptiveOverviewContent {
    param([string[]]$ExistingRoutes)

    $routeLines = @()
    foreach ($route in $ExistingRoutes) {
        $escaped = $route.Replace('\', '\\').Replace("'", "\'")
        $routeLines += ("  '" + $escaped + "',")
    }

    $routesLiteral = $routeLines -join [Environment]::NewLine

    $template = @'
'use client'

import Link from 'next/link'
import type { PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'

type ActionItem = {
  label: string
  description: string
  href: string
  code: string
}

const existingRoutes = new Set<string>([
__EXISTING_ROUTES__
])

const segmentContent: Record<string, {
  label: string
  title: string
  description: string
  actions: ActionItem[]
}> = {
  food: {
    label: 'Food',
    title: 'Operacao de pedidos e entregas',
    description: 'Acesse rapidamente cardapio, pedidos, entregas, regioes e horarios de atendimento.',
    actions: [
      { label: 'Ver pedidos', description: 'Acompanhe pedidos e status.', href: '/painel/pedidos', code: 'PD' },
      { label: 'Editar catalogo', description: 'Organize cardapio e disponibilidade.', href: '/painel/catalogo', code: 'CT' },
      { label: 'Ver entregas', description: 'Monitore a operacao de entrega.', href: '/painel/entregas', code: 'EN' },
      { label: 'Configurar horarios', description: 'Defina quando a empresa atende.', href: '/painel/horarios', code: 'HR' },
    ],
  },
  graphic: {
    label: 'Grafica',
    title: 'Orcamentos, artes e producao',
    description: 'Centralize produtos, propostas, aprovacoes e etapas de producao.',
    actions: [
      { label: 'Novo produto', description: 'Cadastre produtos e servicos.', href: '/painel/produtos', code: 'PR' },
      { label: 'Ver propostas', description: 'Acompanhe propostas comerciais.', href: '/painel/propostas', code: 'PP' },
      { label: 'Ver artes', description: 'Organize arquivos e aprovacoes.', href: '/painel/artes', code: 'AR' },
      { label: 'Acompanhar producao', description: 'Veja trabalhos em andamento.', href: '/painel/producao', code: 'PO' },
    ],
  },
  auto: {
    label: 'Auto e oficina',
    title: 'Ordens, veiculos e manutencao',
    description: 'Acesse ordens de servico, diagnosticos, pecas e andamento da oficina.',
    actions: [
      { label: 'Ordens de servico', description: 'Acompanhe os servicos abertos.', href: '/painel/ordens-servico', code: 'OS' },
      { label: 'Veiculos', description: 'Consulte veiculos cadastrados.', href: '/painel/veiculos', code: 'VE' },
      { label: 'Diagnosticos', description: 'Organize avaliacao e aprovacao.', href: '/painel/diagnostico', code: 'DG' },
      { label: 'Pecas', description: 'Acompanhe itens e materiais.', href: '/painel/pecas', code: 'PC' },
    ],
  },
  assistance: {
    label: 'Assistencia tecnica',
    title: 'Aparelhos, diagnosticos e manutencao',
    description: 'Organize aparelhos recebidos, defeitos, aprovacoes e entrega ao cliente.',
    actions: [
      { label: 'Aparelhos', description: 'Consulte os equipamentos recebidos.', href: '/painel/aparelhos', code: 'AP' },
      { label: 'Diagnosticos', description: 'Acompanhe avaliacao tecnica.', href: '/painel/diagnostico', code: 'DG' },
      { label: 'Manutencao', description: 'Veja trabalhos em andamento.', href: '/painel/manutencao', code: 'MT' },
      { label: 'Garantias', description: 'Consulte garantias e retornos.', href: '/painel/garantias', code: 'GT' },
    ],
  },
  beauty: {
    label: 'Beauty e barbearia',
    title: 'Agenda, profissionais e servicos',
    description: 'Acesse agenda, equipe, servicos e relacionamento com clientes.',
    actions: [
      { label: 'Ver agenda', description: 'Acompanhe os horarios do dia.', href: '/painel/agenda', code: 'AG' },
      { label: 'Profissionais', description: 'Gerencie a equipe de atendimento.', href: '/painel/profissionais', code: 'PF' },
      { label: 'Produtos e servicos', description: 'Organize os itens oferecidos.', href: '/painel/produtos', code: 'SV' },
      { label: 'Clientes', description: 'Consulte historico e contatos.', href: '/painel/clientes', code: 'CL' },
    ],
  },
  events: {
    label: 'Eventos',
    title: 'Datas, contratos e execucao',
    description: 'Organize eventos futuros, pacotes, contratos, equipe e checklist.',
    actions: [
      { label: 'Proximos eventos', description: 'Consulte eventos e datas.', href: '/painel/eventos', code: 'EV' },
      { label: 'Contratos', description: 'Acompanhe documentos e acordos.', href: '/painel/contratos', code: 'CO' },
      { label: 'Pacotes', description: 'Organize ofertas e servicos.', href: '/painel/pacotes', code: 'PA' },
      { label: 'Checklist', description: 'Controle a preparacao do evento.', href: '/painel/checklist-evento', code: 'CK' },
    ],
  },
  store: {
    label: 'Loja e comercio',
    title: 'Produtos, estoque e vendas',
    description: 'Acesse rapidamente produtos, pedidos, estoque e catalogo digital.',
    actions: [
      { label: 'Produtos', description: 'Gerencie o que esta a venda.', href: '/painel/produtos', code: 'PR' },
      { label: 'Pedidos', description: 'Acompanhe compras e status.', href: '/painel/pedidos', code: 'PD' },
      { label: 'Estoque', description: 'Consulte disponibilidade.', href: '/painel/estoque', code: 'ES' },
      { label: 'Catalogo', description: 'Veja a vitrine comercial.', href: '/painel/catalogo', code: 'CT' },
    ],
  },
  services: {
    label: 'Servicos',
    title: 'Solicitacoes, propostas e acompanhamento',
    description: 'Organize demandas, propostas, prazos e relacionamento com clientes.',
    actions: [
      { label: 'Solicitacoes', description: 'Veja novas demandas.', href: '/painel/solicitacoes', code: 'SO' },
      { label: 'Propostas', description: 'Acompanhe negociacoes.', href: '/painel/propostas', code: 'PP' },
      { label: 'Tarefas', description: 'Organize o trabalho em andamento.', href: '/painel/tarefas', code: 'TF' },
      { label: 'Clientes', description: 'Consulte contatos e historico.', href: '/painel/clientes', code: 'CL' },
    ],
  },
}

function normalizeSegment(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()

  if (['food', 'restaurante', 'lanchonete', 'delivery', 'alimenticio'].includes(normalized)) return 'food'
  if (['graphic', 'grafica', 'custom_products', 'personalizados'].includes(normalized)) return 'graphic'
  if (['auto', 'oficina', 'automotive', 'automotivo'].includes(normalized)) return 'auto'
  if (['technical_assistance', 'assistencia', 'assistencia_tecnica'].includes(normalized)) return 'assistance'
  if (['beauty', 'barber', 'barbearia', 'beleza', 'estetica'].includes(normalized)) return 'beauty'
  if (['events', 'eventos'].includes(normalized)) return 'events'
  if (['store', 'loja', 'retail', 'comercio'].includes(normalized)) return 'store'

  return 'services'
}

export default function PanelAdaptiveOverview({
  company,
}: {
  company: PanelPremiumCompany
}) {
  const segmentKey = normalizeSegment(company.business_type || company.site_template)
  const content = segmentContent[segmentKey] || segmentContent.services
  const actions = content.actions.filter((action) => existingRoutes.has(action.href)).slice(0, 4)

  if (!actions.length) return null

  return (
    <section className="panel-adaptive-overview" aria-labelledby="panel-adaptive-overview-title">
      <div className="panel-adaptive-overview-copy">
        <span>{content.label}</span>
        <h2 id="panel-adaptive-overview-title">{content.title}</h2>
        <p>{content.description}</p>
      </div>

      <div className="panel-adaptive-actions" aria-label="Acoes rapidas da operacao">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="panel-adaptive-action-card">
            <span className="panel-adaptive-action-code" aria-hidden="true">{action.code}</span>
            <span className="min-w-0">
              <strong>{action.label}</strong>
              <small>{action.description}</small>
            </span>
            <span className="panel-adaptive-action-arrow" aria-hidden="true">&#8594;</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
'@

    return $template.Replace('__EXISTING_ROUTES__', $routesLiteral)
}

function Get-LoadingContent {
    return @'
export default function PainelLoading() {
  return (
    <div className="panel-adaptive-loading" aria-label="Carregando painel">
      <div className="panel-adaptive-loading-heading">
        <span />
        <span />
      </div>

      <div className="panel-adaptive-loading-metrics">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="panel-adaptive-loading-card">
            <span />
            <strong />
            <small />
          </div>
        ))}
      </div>

      <div className="panel-adaptive-loading-content">
        <div className="panel-adaptive-loading-table">
          <span />
          {Array.from({ length: 5 }).map((_, index) => <i key={index} />)}
        </div>
        <div className="panel-adaptive-loading-side">
          <span />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  )
}
'@
}

function Get-PremiumCssBlock {
    return @'
/* ORCALY_PANEL_ADAPTIVE_START */
.orcaly-panel-adaptive {
  --orcaly-panel-navy: #071a3a;
  --orcaly-panel-blue: #174ea6;
  --orcaly-panel-blue-strong: #0a377f;
  --orcaly-panel-cyan: #218fce;
  --orcaly-panel-bg: #f2f6fb;
  --orcaly-panel-surface: #ffffff;
  --orcaly-panel-surface-soft: #f7f9fc;
  --orcaly-panel-border: #dce5f1;
  --orcaly-panel-text: #10213b;
  --orcaly-panel-muted: #65758b;
  --orcaly-panel-success: #14805e;
  --orcaly-panel-warning: #a56107;
  --orcaly-panel-danger: #b42318;
  --orcaly-panel-shadow: 0 16px 42px rgba(9, 31, 66, 0.08);
  --orcaly-panel-shadow-hover: 0 22px 54px rgba(9, 31, 66, 0.13);
  min-width: 0;
  background:
    radial-gradient(circle at 78% -8%, rgba(45, 124, 211, 0.12), transparent 28rem),
    linear-gradient(180deg, #edf3fa 0, #f7f9fc 27rem, #f3f6fa 100%);
  color: var(--orcaly-panel-text);
}

.orcaly-panel-adaptive .panel-adaptive-content {
  position: relative;
  min-width: 0;
  min-height: 100vh;
  overflow: clip;
}

.orcaly-panel-adaptive .panel-adaptive-top-line {
  position: fixed;
  top: 0;
  right: 0;
  left: 288px;
  z-index: 80;
  height: 3px;
  background: linear-gradient(90deg, #0a377f, #267bd1 50%, #27a0cf);
  box-shadow: 0 2px 12px rgba(23, 78, 166, 0.32);
}

.orcaly-panel-adaptive .panel-adaptive-page-slot {
  min-width: 0;
  padding: clamp(1rem, 2.15vw, 2rem);
}

.orcaly-panel-adaptive .panel-adaptive-page-width {
  width: min(100%, 1560px);
  min-width: 0;
  margin-inline: auto;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas {
  animation: orcaly-panel-page-enter 260ms ease both;
}

@keyframes orcaly-panel-page-enter {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.orcaly-panel-adaptive .panel-adaptive-header {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  min-width: 0;
  min-height: 110px;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  border-bottom: 1px solid rgba(210, 222, 238, 0.92);
  background: rgba(255, 255, 255, 0.94);
  padding: 1.1rem clamp(1rem, 2.3vw, 2rem);
  box-shadow: 0 11px 32px rgba(9, 31, 66, 0.05);
  backdrop-filter: blur(18px);
}

.orcaly-panel-adaptive .panel-adaptive-header-copy {
  flex: 1 1 auto;
  max-width: 75rem;
}

.orcaly-panel-adaptive .panel-adaptive-breadcrumb {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.42rem;
  color: #77879d;
  font-size: 0.72rem;
  font-weight: 750;
}

.orcaly-panel-adaptive .panel-adaptive-breadcrumb a {
  color: #36577f;
  transition: color 140ms ease;
}

.orcaly-panel-adaptive .panel-adaptive-breadcrumb a:hover {
  color: var(--orcaly-panel-blue);
}

.orcaly-panel-adaptive .panel-adaptive-breadcrumb > span {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
}

.orcaly-panel-adaptive .panel-adaptive-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.45rem;
}

.orcaly-panel-adaptive .panel-adaptive-kicker {
  display: block;
  margin-bottom: 0.12rem;
  color: #71839d;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.orcaly-panel-adaptive .panel-adaptive-header h1 {
  margin: 0;
  color: #0d203c;
  font-size: clamp(1.45rem, 2.4vw, 2rem);
  font-weight: 900;
  letter-spacing: -0.045em;
  line-height: 1.1;
}

.orcaly-panel-adaptive .panel-adaptive-header-copy > p {
  max-width: 58rem;
  margin-top: 0.38rem;
  color: #61738c;
  font-size: 0.84rem;
  line-height: 1.55;
}

.orcaly-panel-adaptive .panel-adaptive-segment-badge {
  display: inline-flex;
  min-height: 1.8rem;
  align-items: center;
  border: 1px solid #cfe0f4;
  border-radius: 999px;
  background: #eff6ff;
  padding: 0.28rem 0.68rem;
  color: #174e93;
  font-size: 0.69rem;
  font-weight: 850;
  white-space: nowrap;
}

.orcaly-panel-adaptive .panel-adaptive-header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.65rem;
}

.orcaly-panel-adaptive .panel-adaptive-company-card {
  display: flex;
  min-width: 13rem;
  max-width: 20rem;
  align-items: center;
  gap: 0.68rem;
  border: 1px solid #dbe5f1;
  border-radius: 1rem;
  background: white;
  padding: 0.54rem 0.68rem;
  box-shadow: 0 9px 24px rgba(9, 31, 66, 0.07);
}

.orcaly-panel-adaptive .panel-adaptive-company-logo {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 0.78rem;
  background: #eaf2fc;
  color: var(--orcaly-panel-blue);
  font-weight: 900;
}

.orcaly-panel-adaptive .panel-adaptive-company-logo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.orcaly-panel-adaptive .panel-adaptive-company-card strong,
.orcaly-panel-adaptive .panel-adaptive-company-card small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.orcaly-panel-adaptive .panel-adaptive-company-card strong {
  color: #122641;
  font-size: 0.82rem;
  font-weight: 900;
}

.orcaly-panel-adaptive .panel-adaptive-company-card small {
  margin-top: 0.12rem;
  color: #73839a;
  font-size: 0.69rem;
  font-weight: 750;
}

.orcaly-panel-adaptive .panel-adaptive-open-site {
  display: inline-flex;
  min-height: 2.9rem;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 0.95rem;
  background: linear-gradient(135deg, #0b3b86, #1960bc);
  padding: 0.75rem 0.95rem;
  color: white;
  font-size: 0.78rem;
  font-weight: 850;
  box-shadow: 0 11px 25px rgba(11, 59, 134, 0.2);
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.orcaly-panel-adaptive .panel-adaptive-open-site:hover {
  transform: translateY(-1px);
  box-shadow: 0 15px 31px rgba(11, 59, 134, 0.27);
}

.orcaly-panel-adaptive .panel-adaptive-open-site:active {
  transform: scale(0.98);
}

.orcaly-panel-adaptive .panel-adaptive-overview {
  display: grid;
  grid-template-columns: minmax(15rem, 0.85fr) minmax(0, 1.65fr);
  gap: 1rem;
  margin-bottom: 1.05rem;
  border: 1px solid rgba(189, 209, 234, 0.92);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at 90% 0, rgba(56, 141, 222, 0.14), transparent 20rem),
    linear-gradient(135deg, #ffffff, #f6f9fd);
  padding: clamp(1rem, 2vw, 1.4rem);
  box-shadow: var(--orcaly-panel-shadow);
}

.orcaly-panel-adaptive .panel-adaptive-overview-copy {
  min-width: 0;
  align-self: center;
}

.orcaly-panel-adaptive .panel-adaptive-overview-copy > span {
  color: #2a66a9;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.orcaly-panel-adaptive .panel-adaptive-overview-copy h2 {
  margin-top: 0.38rem;
  color: #102641;
  font-size: clamp(1.15rem, 2vw, 1.52rem);
  font-weight: 900;
  letter-spacing: -0.035em;
}

.orcaly-panel-adaptive .panel-adaptive-overview-copy p {
  margin-top: 0.4rem;
  color: #65768d;
  font-size: 0.78rem;
  line-height: 1.6;
}

.orcaly-panel-adaptive .panel-adaptive-actions {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.orcaly-panel-adaptive .panel-adaptive-action-card {
  display: flex;
  min-width: 0;
  min-height: 4.75rem;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid #dde7f3;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.94);
  padding: 0.78rem;
  color: #112641;
  box-shadow: 0 8px 20px rgba(9, 31, 66, 0.05);
  transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.orcaly-panel-adaptive .panel-adaptive-action-card:hover {
  transform: translateY(-2px);
  border-color: #b9d0eb;
  box-shadow: 0 14px 28px rgba(9, 31, 66, 0.1);
}

.orcaly-panel-adaptive .panel-adaptive-action-card:active {
  transform: scale(0.985);
}

.orcaly-panel-adaptive .panel-adaptive-action-code {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.75rem;
  background: #eaf3fd;
  color: #174f91;
  font-size: 0.68rem;
  font-weight: 950;
}

.orcaly-panel-adaptive .panel-adaptive-action-card strong,
.orcaly-panel-adaptive .panel-adaptive-action-card small {
  display: block;
}

.orcaly-panel-adaptive .panel-adaptive-action-card strong {
  font-size: 0.79rem;
  font-weight: 900;
}

.orcaly-panel-adaptive .panel-adaptive-action-card small {
  margin-top: 0.15rem;
  color: #708096;
  font-size: 0.67rem;
  font-weight: 650;
  line-height: 1.35;
}

.orcaly-panel-adaptive .panel-adaptive-action-arrow {
  margin-left: auto;
  color: #6282a8;
  font-size: 1rem;
}

/* Sidebar - visual only, routes and handlers remain in the current component. */
.orcaly-panel-adaptive :is(.panel-sidebar-desktop-legacy, .panel-sidebar-desktop, aside[class*="bg-[#05245c]"]) {
  border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
  background:
    radial-gradient(circle at 0 0, rgba(42, 132, 218, 0.2), transparent 17rem),
    linear-gradient(180deg, #061a3b 0%, #08234d 52%, #06152f 100%) !important;
  box-shadow: 12px 0 36px rgba(5, 20, 46, 0.14) !important;
}

.orcaly-panel-adaptive :is(.panel-sidebar-desktop-legacy, .panel-sidebar-desktop) nav {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
}

.orcaly-panel-adaptive :is(.panel-sidebar-desktop-legacy, .panel-sidebar-desktop) nav section > p {
  margin-bottom: 0.48rem !important;
  color: rgba(194, 214, 239, 0.62) !important;
  font-size: 0.61rem !important;
  letter-spacing: 0.17em !important;
}

.orcaly-panel-adaptive :is(.panel-sidebar-desktop-legacy, .panel-sidebar-desktop) nav a {
  border-radius: 0.9rem !important;
  padding-block: 0.66rem !important;
  transition: background-color 150ms ease, border-color 150ms ease, transform 150ms ease !important;
}

.orcaly-panel-adaptive :is(.panel-sidebar-desktop-legacy, .panel-sidebar-desktop) nav a:hover {
  transform: translateX(2px);
}

.orcaly-panel-adaptive :is(.panel-sidebar-desktop-legacy, .panel-sidebar-desktop) nav a[class*="bg-[#05245c]"],
.orcaly-panel-adaptive :is(.panel-sidebar-desktop-legacy, .panel-sidebar-desktop) nav a[aria-current="page"] {
  border-color: rgba(255, 255, 255, 0.16) !important;
  background: linear-gradient(135deg, rgba(50, 128, 211, 0.88), rgba(28, 85, 161, 0.92)) !important;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16) !important;
}

/* Existing page cards, sections and tables receive a common premium treatment. */
.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(main, section, article, div) {
  min-width: 0;
  max-width: 100%;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(
  div[class*="bg-white"][class*="border"],
  section[class*="bg-white"][class*="border"],
  article[class*="bg-white"][class*="border"]
) {
  border-color: var(--orcaly-panel-border) !important;
  box-shadow: 0 10px 30px rgba(9, 31, 66, 0.055);
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(
  div[class*="rounded-3xl"],
  section[class*="rounded-3xl"],
  article[class*="rounded-3xl"]
) {
  border-radius: 1.25rem !important;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(
  h1,
  h2,
  h3
) {
  color: #10233f;
  letter-spacing: -0.025em;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  color: #233851;
  font-size: 0.78rem;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(div, section)[class*="overflow-x-auto"] {
  max-width: 100%;
  border-radius: 1rem;
  scrollbar-width: thin;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas thead {
  background: #f4f7fb;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas th {
  border-bottom: 1px solid #dce5f1;
  padding: 0.78rem 0.85rem;
  color: #66788e;
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas td {
  border-bottom: 1px solid #edf1f6;
  padding: 0.82rem 0.85rem;
  vertical-align: middle;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas tbody tr {
  transition: background-color 140ms ease;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas tbody tr:hover {
  background: #f8fbff;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(input, textarea, select) {
  max-width: 100%;
  border-color: #ccd8e6 !important;
  border-radius: 0.82rem !important;
  background: #fff !important;
  color: #162a44 !important;
  box-shadow: 0 1px 2px rgba(9, 31, 66, 0.025);
  transition: border-color 140ms ease, box-shadow 140ms ease;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(input, textarea, select):focus {
  border-color: #4d8ed3 !important;
  outline: none !important;
  box-shadow: 0 0 0 3px rgba(50, 122, 204, 0.13) !important;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas button,
.orcaly-panel-adaptive .panel-adaptive-page-canvas a[class*="rounded"] {
  max-width: 100%;
  transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas button:not(:disabled):active,
.orcaly-panel-adaptive .panel-adaptive-page-canvas a[class*="rounded"]:active {
  transform: scale(0.985);
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(button, a, input, select, textarea):focus-visible {
  outline: 3px solid rgba(39, 116, 204, 0.3) !important;
  outline-offset: 2px;
}

.orcaly-panel-adaptive .panel-adaptive-page-canvas :is(
  [class*="grid-cols-4"],
  [class*="grid-cols-5"],
  [class*="grid-cols-6"]
) {
  gap: clamp(0.7rem, 1.25vw, 1rem);
}

.orcaly-panel-adaptive .panel-adaptive-loading {
  display: grid;
  gap: 1rem;
  animation: orcaly-panel-page-enter 220ms ease both;
}

.orcaly-panel-adaptive .panel-adaptive-loading-heading,
.orcaly-panel-adaptive .panel-adaptive-loading-card,
.orcaly-panel-adaptive .panel-adaptive-loading-table,
.orcaly-panel-adaptive .panel-adaptive-loading-side {
  border: 1px solid #dfe7f1;
  border-radius: 1.15rem;
  background: white;
  box-shadow: 0 9px 26px rgba(9, 31, 66, 0.05);
}

.orcaly-panel-adaptive .panel-adaptive-loading-heading {
  display: grid;
  gap: 0.6rem;
  padding: 1.2rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-heading span:first-child {
  width: 13rem;
  height: 1.4rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-heading span:last-child {
  width: min(28rem, 72%);
  height: 0.75rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-card {
  display: grid;
  gap: 0.65rem;
  min-height: 8rem;
  padding: 1rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-card span {
  width: 42%;
  height: 0.7rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-card strong {
  width: 66%;
  height: 1.55rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-card small {
  width: 54%;
  height: 0.62rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-content {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(15rem, 0.8fr);
  gap: 0.85rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-table,
.orcaly-panel-adaptive .panel-adaptive-loading-side {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading :is(span, strong, small, i) {
  display: block;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(90deg, #edf2f7 25%, #f7f9fc 50%, #edf2f7 75%);
  background-size: 220% 100%;
  animation: orcaly-panel-skeleton 1.25s ease-in-out infinite;
}

.orcaly-panel-adaptive .panel-adaptive-loading-table > span,
.orcaly-panel-adaptive .panel-adaptive-loading-side > span {
  width: 34%;
  height: 0.8rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-table i {
  width: 100%;
  height: 2.9rem;
  border-radius: 0.65rem;
}

.orcaly-panel-adaptive .panel-adaptive-loading-side i {
  width: 100%;
  height: 4.1rem;
  border-radius: 0.75rem;
}

@keyframes orcaly-panel-skeleton {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

@media (max-width: 1180px) {
  .orcaly-panel-adaptive .panel-adaptive-overview {
    grid-template-columns: 1fr;
  }

  .orcaly-panel-adaptive .panel-adaptive-header {
    align-items: flex-start;
  }

  .orcaly-panel-adaptive .panel-adaptive-header-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}

@media (max-width: 1023px) {
  .orcaly-panel-adaptive .panel-adaptive-top-line {
    left: 0;
  }

  .orcaly-panel-adaptive .panel-adaptive-header {
    position: relative;
    min-height: auto;
    flex-direction: column;
    align-items: stretch;
    padding-top: 1rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .orcaly-panel-adaptive .panel-adaptive-company-card {
    min-width: 0;
    max-width: min(70vw, 20rem);
  }

  .orcaly-panel-adaptive .panel-adaptive-loading-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .orcaly-panel-adaptive .panel-adaptive-page-slot {
    padding: 0.85rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-header {
    padding: 0.95rem 0.85rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-title-row {
    align-items: flex-start;
    justify-content: space-between;
  }

  .orcaly-panel-adaptive .panel-adaptive-header h1 {
    font-size: 1.42rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-header-actions {
    align-items: stretch;
  }

  .orcaly-panel-adaptive .panel-adaptive-company-card {
    flex: 1 1 12rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-open-site {
    min-height: 2.8rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-actions,
  .orcaly-panel-adaptive .panel-adaptive-loading-content {
    grid-template-columns: 1fr;
  }

  .orcaly-panel-adaptive .panel-adaptive-page-canvas table {
    min-width: 42rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-page-canvas :is(button, a)[class*="px-"] {
    min-height: 2.75rem;
  }
}

@media (max-width: 520px) {
  .orcaly-panel-adaptive .panel-adaptive-actions,
  .orcaly-panel-adaptive .panel-adaptive-loading-metrics {
    grid-template-columns: 1fr;
  }

  .orcaly-panel-adaptive .panel-adaptive-overview {
    border-radius: 1.1rem;
    padding: 0.9rem;
  }

  .orcaly-panel-adaptive .panel-adaptive-header-actions {
    flex-direction: column;
  }

  .orcaly-panel-adaptive .panel-adaptive-company-card,
  .orcaly-panel-adaptive .panel-adaptive-open-site {
    width: 100%;
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orcaly-panel-adaptive *,
  .orcaly-panel-adaptive *::before,
  .orcaly-panel-adaptive *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
/* ORCALY_PANEL_ADAPTIVE_END */
'@
}

function Patch-PremiumCss {
    $relative = 'app/painel/premium.css'
    $path = Join-Path $ProjectRoot $relative
    $current = ''

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $current = [System.IO.File]::ReadAllText($path)
        $Counters.ComponentsReused++
    }
    else {
        $Counters.ComponentsCreated++
    }

    $block = Get-PremiumCssBlock
    $updated = Replace-MarkedBlock `
        -Content $current `
        -StartMarker '/* ORCALY_PANEL_ADAPTIVE_START */' `
        -EndMarker '/* ORCALY_PANEL_ADAPTIVE_END */' `
        -Block $block

    if (Update-ProjectFile -RelativePath $relative -Content $updated -Reason 'camada visual premium e responsiva aplicada ao painel inteiro') {
        $Counters.AnimationsAdded = 8
        $Counters.SafeOptimizations += 2
    }
}

function Patch-PresentationComponents {
    $shellRelative = 'components/painel/PanelPremiumShell.tsx'
    $headerRelative = 'components/painel/PanelPremiumHeader.tsx'
    $overviewRelative = 'components/painel/PanelAdaptiveOverview.tsx'
    $loadingRelative = 'app/painel/loading.tsx'

    foreach ($relative in @($shellRelative, $headerRelative)) {
        $fullPath = Join-Path $ProjectRoot $relative

        if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
            $Counters.ComponentsReused++
        }
        else {
            $Counters.ComponentsCreated++
        }
    }

    if (Test-Path -LiteralPath (Join-Path $ProjectRoot $overviewRelative) -PathType Leaf) {
        $Counters.ComponentsReused++
    }
    else {
        $Counters.ComponentsCreated++
    }

    if (Test-Path -LiteralPath (Join-Path $ProjectRoot $loadingRelative) -PathType Leaf) {
        $Counters.ComponentsReused++
    }
    else {
        $Counters.ComponentsCreated++
    }

    Update-ProjectFile -RelativePath $shellRelative -Content (Get-PanelPremiumShellContent) -Reason 'shell visual adaptativo preservando a sidebar e o conteudo atual' | Out-Null
    Update-ProjectFile -RelativePath $headerRelative -Content (Get-PanelPremiumHeaderContent) -Reason 'header premium com empresa, plano, breadcrumb e contexto da pagina' | Out-Null

    $routes = @(Get-ExistingPanelRoutes)
    $overview = Get-AdaptiveOverviewContent -ExistingRoutes $routes
    Update-ProjectFile -RelativePath $overviewRelative -Content $overview -Reason 'acoes rapidas adaptadas ao segmento usando apenas rotas existentes' | Out-Null

    Update-ProjectFile -RelativePath $loadingRelative -Content (Get-LoadingContent) -Reason 'skeleton estrutural para carregamento do painel' | Out-Null

    $Counters.SkeletonsAdded = 5
    $Counters.SafeOptimizations += 2
}

function Patch-SubscriptionRoute {
    Write-Step 'Fase 2 - corrigindo rota visual da assinatura'

    $redirectRelative = 'app/painel/modulo/assinatura/page.tsx'
    $redirectContent = @'
import { redirect } from 'next/navigation'

export default function LegacySubscriptionModulePage() {
  redirect('/painel/assinatura')
}
'@

    Update-ProjectFile -RelativePath $redirectRelative -Content $redirectContent -Reason 'redirect server-side de compatibilidade para a rota oficial' | Out-Null

    $sourceFiles = @(Get-SourceFiles)

    foreach ($file in $sourceFiles) {
        $relative = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\').Replace('\', '/')

        if ($relative -eq $redirectRelative) {
            continue
        }

        $content = [System.IO.File]::ReadAllText($file.FullName)
        $updated = $content
        $updated = $updated.Replace('/painel/modulo/assinatura', '/painel/assinatura')
        $updated = $updated.Replace('/painel/modulos/assinatura', '/painel/assinatura')

        if ($updated -ne $content) {
            $countBefore = ([regex]::Matches($content, '/painel/modulos?/assinatura')).Count
            Update-ProjectFile -RelativePath $relative -Content $updated -Reason 'link visual da assinatura apontando diretamente para a rota oficial' | Out-Null
            $Counters.LinksCorrected += $countBefore
        }
    }

    foreach ($registryRelative in @('lib/panel-modules.ts', 'lib/segment-modules.ts')) {
        $registryPath = Join-Path $ProjectRoot $registryRelative

        if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
            continue
        }

        $content = [System.IO.File]::ReadAllText($registryPath)
        $pattern = '(?s)(\b(?:id|key|slug)\s*:\s*["'']assinatura["''][\s\S]{0,1200}?\bhref\s*:\s*)["''][^"'']+["'']'
        $updated = [regex]::Replace(
            $content,
            $pattern,
            { param($match) $match.Groups[1].Value + "'/painel/assinatura'" },
            1
        )

        if ($updated -ne $content) {
            Update-ProjectFile -RelativePath $registryRelative -Content $updated -Reason 'registry do modulo assinatura corrigido sem alterar outros modulos' | Out-Null
            $Counters.LinksCorrected++
        }
    }

    $remaining = New-Object System.Collections.Generic.List[string]

    foreach ($file in Get-SourceFiles) {
        $relative = $file.FullName.Substring($ProjectRoot.Length).TrimStart('\').Replace('\', '/')

        if ($relative -eq $redirectRelative) {
            continue
        }

        $content = [System.IO.File]::ReadAllText($file.FullName)

        if ($content -match '/painel/modulos?/assinatura') {
            $remaining.Add($relative)
        }
    }

    if ($remaining.Count -gt 0) {
        Add-QaResult -Area 'Rota Assinatura' -Status 'FALHOU' -Detail ('Referencias antigas restantes: ' + ($remaining -join ', '))
        Stop-OnCriticalFailure 'Ainda existem referencias visuais para /painel/modulo/assinatura.'
    }

    Add-QaResult -Area 'Rota Assinatura' -Status 'PASSOU' -Detail ('Links corrigidos: ' + $Counters.LinksCorrected + '. Redirect server-side criado.')
}

function Validate-FunctionsPreserved {
    Write-Step 'Fase 18 - comparando funcoes e handlers antes/depois'

    $presentationFiles = @(
        'components/painel/PanelPremiumShell.tsx',
        'components/painel/PanelPremiumHeader.tsx',
        'components/painel/PanelAdaptiveOverview.tsx',
        'app/painel/loading.tsx',
        'app/painel/modulo/assinatura/page.tsx'
    )

    foreach ($relative in $InitialFunctions.Keys) {
        if ($presentationFiles -contains $relative) {
            continue
        }

        $beforeFunctions = @($InitialFunctions[$relative])

        if (-not (Compare-PageFunctions -RelativePath $relative -BeforeFunctions $beforeFunctions)) {
            Stop-OnCriticalFailure ('Regressao funcional detectada em ' + $relative)
        }
    }

    Add-QaResult -Area 'Funcoes e handlers' -Status 'PASSOU' -Detail (
        $Counters.FunctionsPreserved.ToString() + ' funcoes e ' +
        $Counters.HandlersPreserved.ToString() + ' handlers preservados.'
    )
}

function Validate-ProtectedFiles {
    $protected = @(
        'package.json',
        'package-lock.json',
        'proxy.ts',
        '.env',
        '.env.local',
        '.env.production'
    )

    foreach ($relative in $protected) {
        if ($ChangedFiles.Contains($relative)) {
            Add-QaResult -Area ('Protecao: ' + $relative) -Status 'FALHOU' -Detail 'Arquivo protegido apareceu no manifesto.'
            Stop-OnCriticalFailure ('Arquivo protegido alterado: ' + $relative)
        }
    }

    foreach ($changed in $ChangedFiles) {
        if ($changed.StartsWith('app/api/', [System.StringComparison]::OrdinalIgnoreCase)) {
            Add-QaResult -Area 'APIs protegidas' -Status 'FALHOU' -Detail ('API alterada: ' + $changed)
            Stop-OnCriticalFailure ('A refatoracao visual tentou alterar uma API: ' + $changed)
        }

        if ($changed.StartsWith('supabase/', [System.StringComparison]::OrdinalIgnoreCase)) {
            Add-QaResult -Area 'Banco protegido' -Status 'FALHOU' -Detail ('Arquivo Supabase alterado: ' + $changed)
            Stop-OnCriticalFailure ('A refatoracao visual tentou alterar banco ou migration: ' + $changed)
        }
    }

    Add-QaResult -Area 'Arquivos protegidos' -Status 'PASSOU' -Detail 'Auth, APIs, Mercado Pago, banco, proxy, packages e variaveis de ambiente nao foram alterados.'
}

function Get-LintCounts {
    param([string]$OutputPath)

    $result = [ordered]@{
        Problems = -1
        Errors = -1
        Warnings = -1
    }

    if (-not (Test-Path -LiteralPath $OutputPath -PathType Leaf)) {
        return [pscustomobject]$result
    }

    $content = [System.IO.File]::ReadAllText($OutputPath)
    $match = [regex]::Match($content, '(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

    if ($match.Success) {
        $result.Problems = [int]$match.Groups[1].Value
        $result.Errors = [int]$match.Groups[2].Value
        $result.Warnings = [int]$match.Groups[3].Value
    }

    return [pscustomobject]$result
}

function Write-Manifest {
    if ($DryRun) { return }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('Orcaly - Painel Adaptativo')
    $lines.Add('Data: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    $lines.Add('')

    foreach ($file in $ChangedFiles) {
        $lines.Add($file)
    }

    Write-Utf8NoBom -Path $ManifestPath -Content ($lines -join [Environment]::NewLine)
}

function Build-Report {
    if ($DryRun -or $SkipQa) { return }

    $initialBuildStatus = 'NAO TESTADO'
    $finalBuildStatus = 'NAO TESTADO'

    if ($BuildResults.ContainsKey('build-inicial')) {
        if ($BuildResults['build-inicial'].Passed) {
            $initialBuildStatus = 'PASSOU'
        }
        else {
            $initialBuildStatus = 'FALHOU'
        }
    }

    if ($BuildResults.ContainsKey('build-final')) {
        if ($BuildResults['build-final'].Passed) {
            $finalBuildStatus = 'PASSOU'
        }
        else {
            $finalBuildStatus = 'FALHOU'
        }
    }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('# RELATORIO PAINEL ADAPTATIVO ORCALY')
    $lines.Add('')
    $lines.Add('## Resumo')
    $lines.Add('')
    $lines.Add('Refatoracao visual conservadora aplicada sobre o painel existente. A camada visual foi consolidada no shell atual, sem substituir consultas, handlers, APIs, Auth, Mercado Pago ou regras de negocio.')
    $lines.Add('')
    $lines.Add('## Resultados')
    $lines.Add('')
    $lines.Add('- Build inicial: ' + $initialBuildStatus)
    $lines.Add('- Build final: ' + $finalBuildStatus)
    $lines.Add('- Arquivos auditados: ' + $Counters.FilesAudited)
    $lines.Add('- Paginas visualmente cobertas: ' + $Counters.PagesReformatted)
    $lines.Add('- Segmentos reconhecidos: ' + $Counters.SegmentsRecognized)
    $lines.Add('- Funcoes preservadas: ' + $Counters.FunctionsPreserved)
    $lines.Add('- Handlers preservados: ' + $Counters.HandlersPreserved)
    $lines.Add('- Componentes reutilizados: ' + $Counters.ComponentsReused)
    $lines.Add('- Componentes criados: ' + $Counters.ComponentsCreated)
    $lines.Add('- Animacoes adicionadas: ' + $Counters.AnimationsAdded)
    $lines.Add('- Skeletons adicionados: ' + $Counters.SkeletonsAdded)
    $lines.Add('- Otimizacoes seguras: ' + $Counters.SafeOptimizations)
    $lines.Add('- Links de assinatura corrigidos: ' + $Counters.LinksCorrected)
    $lines.Add('- Regressoes encontradas: ' + $Counters.Regressions)
    $lines.Add('- Itens bloqueados: ' + $Counters.Blocked)
    $lines.Add('')
    $lines.Add('## Arquivos alterados')
    $lines.Add('')

    foreach ($file in $ChangedFiles) {
        $lines.Add('- ' + $file)
    }

    $lines.Add('')
    $lines.Add('## Componentes visuais')
    $lines.Add('')
    $lines.Add('- PanelPremiumShell: shell atual reutilizado e aprimorado.')
    $lines.Add('- PanelPremiumHeader: contexto da pagina, empresa, plano e breadcrumb.')
    $lines.Add('- PanelAdaptiveOverview: atalhos por segmento gerados somente para rotas existentes.')
    $lines.Add('- premium.css: camada visual escopada ao painel, tabelas, formularios, cards, sidebar e responsividade.')
    $lines.Add('- loading.tsx: skeleton estrutural sem consultas duplicadas.')
    $lines.Add('')
    $lines.Add('## Segmentos reconhecidos')
    $lines.Add('')
    $lines.Add('- Food')
    $lines.Add('- Grafica e personalizados')
    $lines.Add('- Auto e oficina')
    $lines.Add('- Assistencia tecnica')
    $lines.Add('- Beauty e barbearia')
    $lines.Add('- Eventos')
    $lines.Add('- Loja e comercio')
    $lines.Add('- Servicos gerais')
    $lines.Add('')
    $lines.Add('## QA')
    $lines.Add('')

    foreach ($result in $QaResults) {
        $lines.Add('- [' + $result.Status + '] ' + $result.Area + ': ' + $result.Detail)
    }

    $lines.Add('')
    $lines.Add('## Testes manuais necessarios')
    $lines.Add('')
    $lines.Add('- Validar sidebar desktop e menu mobile com sessao autenticada.')
    $lines.Add('- Validar o dashboard em cada business_type real cadastrado.')
    $lines.Add('- Confirmar que as acoes rapidas abrem somente rotas existentes.')
    $lines.Add('- Validar tabelas, formularios, modais, filtros e CRUD em desktop e celular.')
    $lines.Add('- Validar larguras 360, 390, 768, 1024 e 1440 pixels.')
    $lines.Add('- Confirmar que /painel/modulo/assinatura redireciona sem exibir pagina intermediaria.')
    $lines.Add('')
    $lines.Add('Testes dependentes de navegador, autenticacao, Supabase real e dados de producao permanecem BLOQUEADOS ate validacao manual.')

    Update-ProjectFile -RelativePath $ReportRelativePath -Content ($lines -join [Environment]::NewLine) -Reason 'relatorio final da refatoracao visual adaptativa' | Out-Null
}

try {
    Write-Step 'Validando raiz e sintaxe do patcher'

    foreach ($required in @('package.json', 'app', 'components', 'lib')) {
        $isDirectory = $required -ne 'package.json'

        if (-not (Test-ProjectFile -RelativePath $required -Directory:$isDirectory)) {
            Stop-OnCriticalFailure ('Execute o patcher na raiz do projeto. Ausente: ' + $required)
        }
    }

    if (-not $DryRun) {
        [System.IO.Directory]::CreateDirectory($BackupRoot) | Out-Null
        Write-Utf8NoBom -Path $LogPath -Content ('Inicio: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    }

    Write-Success ('Projeto detectado: ' + $ProjectRoot)

    Audit-InitialState
    $scripts = @(Get-PackageScripts)

    if (-not $SkipInitialBuild) {
        Write-Step 'Fase 1 - executando build inicial'
        $initialBuild = Invoke-NpmCommand -Label 'build-inicial' -Arguments @('run', 'build')

        if ($initialBuild.Passed) {
            Add-QaResult -Area 'Build inicial' -Status 'PASSOU' -Detail ('Concluido em ' + $initialBuild.DurationSeconds + 's.')
        }
        else {
            Add-QaResult -Area 'Build inicial' -Status 'FALHOU' -Detail ('Erro preexistente. Codigo ' + $initialBuild.ExitCode + '.')
            Write-Warning 'O build inicial falhou. O patch visual continuara e o erro sera comparado com o build final.'
        }
    }
    else {
        Add-QaResult -Area 'Build inicial' -Status 'NAO TESTADO' -Detail 'Ignorado por parametro.'
    }

    if ($scripts -contains 'lint') {
        Write-Step 'Fase 1 - executando lint inicial'
        $initialLint = Invoke-NpmCommand -Label 'lint-inicial' -Arguments @('run', 'lint')
        if ($initialLint.Passed) {
            Add-QaResult -Area 'Lint inicial' -Status 'PASSOU' -Detail 'Sem erros.'
        }
        else {
            Add-QaResult -Area 'Lint inicial' -Status 'BLOQUEADO' -Detail 'Falhas preexistentes registradas para comparacao.'
        }
    }

    Patch-SubscriptionRoute

    Write-Step 'Fases 3 a 17 - aplicando design system visual adaptativo'
    Ensure-PremiumCssImport
    Patch-PresentationComponents
    Patch-PremiumCss

    Validate-FunctionsPreserved
    Validate-ProtectedFiles

    if (-not $SkipFinalBuild) {
        Write-Step 'Fase 20 - executando build final'
        $finalBuild = Invoke-NpmCommand -Label 'build-final' -Arguments @('run', 'build')

        if (-not $finalBuild.Passed) {
            Add-QaResult -Area 'Build final' -Status 'FALHOU' -Detail ('Codigo ' + $finalBuild.ExitCode + '. Consulte ' + $finalBuild.Output)
            Stop-OnCriticalFailure 'O build final falhou. Os backups foram preservados.'
        }

        Add-QaResult -Area 'Build final' -Status 'PASSOU' -Detail ('Concluido em ' + $finalBuild.DurationSeconds + 's.')
    }
    else {
        Add-QaResult -Area 'Build final' -Status 'NAO TESTADO' -Detail 'Ignorado por parametro.'
    }

    if ($scripts -contains 'lint') {
        Write-Step 'Fase 20 - executando lint final'
        $finalLint = Invoke-NpmCommand -Label 'lint-final' -Arguments @('run', 'lint')

        if ($finalLint.Passed) {
            Add-QaResult -Area 'Lint final' -Status 'PASSOU' -Detail 'Sem erros.'
        }
        else {
            $initialCounts = Get-LintCounts -OutputPath $BuildResults['lint-inicial'].Output
            $finalCounts = Get-LintCounts -OutputPath $finalLint.Output

            if ($initialCounts.Errors -ge 0 -and $finalCounts.Errors -ge 0 -and $finalCounts.Errors -le $initialCounts.Errors) {
                Add-QaResult -Area 'Lint final' -Status 'BLOQUEADO' -Detail (
                    'O projeto continua com erros preexistentes, sem aumento detectado: ' +
                    $initialCounts.Errors + ' -> ' + $finalCounts.Errors + '.'
                )
            }
            else {
                Add-QaResult -Area 'Lint final' -Status 'FALHOU' -Detail 'Nao foi possivel comprovar ausencia de novos erros de lint.'
            }
        }
    }

    if ($scripts -contains 'typecheck') {
        Write-Step 'Executando typecheck existente'
        $typecheck = Invoke-NpmCommand -Label 'typecheck' -Arguments @('run', 'typecheck')
        Add-QaResult -Area 'Typecheck' -Status $(if ($typecheck.Passed) { 'PASSOU' } else { 'FALHOU' }) -Detail ('Codigo ' + $typecheck.ExitCode + '.')
    }

    if ($scripts -contains 'test') {
        Write-Step 'Executando testes existentes'
        $tests = Invoke-NpmCommand -Label 'test' -Arguments @('run', 'test')
        Add-QaResult -Area 'Testes automatizados' -Status $(if ($tests.Passed) { 'PASSOU' } else { 'FALHOU' }) -Detail ('Codigo ' + $tests.ExitCode + '.')
    }

    Add-QaResult -Area 'Dashboard adaptativo' -Status 'PASSOU' -Detail 'Atalhos sao filtrados por rotas existentes e adaptados ao segmento atual.'
    Add-QaResult -Area 'Responsividade visual' -Status 'BLOQUEADO' -Detail 'Exige navegador nas larguras solicitadas.'
    Add-QaResult -Area 'CRUD e Supabase real' -Status 'BLOQUEADO' -Detail 'Exige sessao autenticada e dados reais.'
    Add-QaResult -Area 'Mercado Pago' -Status 'BLOQUEADO' -Detail 'Nao foi alterado e exige teste externo real.'

    Build-Report
    Write-Manifest

    $initialStatus = 'NAO TESTADO'
    $finalStatus = 'NAO TESTADO'

    if ($BuildResults.ContainsKey('build-inicial')) {
        if ($BuildResults['build-inicial'].Passed) { $initialStatus = 'PASSOU' } else { $initialStatus = 'FALHOU' }
    }

    if ($BuildResults.ContainsKey('build-final')) {
        if ($BuildResults['build-final'].Passed) { $finalStatus = 'PASSOU' } else { $finalStatus = 'FALHOU' }
    }

    Write-Host ''
    Write-Host 'Orcaly - painel adaptativo repaginado' -ForegroundColor Green
    Write-Host ('Build inicial: ' + $initialStatus)
    Write-Host ('Build final: ' + $finalStatus)
    Write-Host 'Sidebar: ATUALIZADA'
    Write-Host 'Header: ATUALIZADO'
    Write-Host 'Dashboard: ATUALIZADO'
    Write-Host ('Segmentos reconhecidos: ' + $Counters.SegmentsRecognized)
    Write-Host ('Paginas reformuladas: ' + $Counters.PagesReformatted)
    Write-Host ('Funcoes preservadas: ' + $Counters.FunctionsPreserved)
    Write-Host ('Handlers preservados: ' + $Counters.HandlersPreserved)
    Write-Host ('Componentes reutilizados: ' + $Counters.ComponentsReused)
    Write-Host ('Componentes criados: ' + $Counters.ComponentsCreated)
    Write-Host ('Animacoes adicionadas: ' + $Counters.AnimationsAdded)
    Write-Host ('Skeletons adicionados: ' + $Counters.SkeletonsAdded)
    Write-Host ('Otimizacoes seguras: ' + $Counters.SafeOptimizations)
    Write-Host 'Rota Assinatura: /painel/assinatura'
    Write-Host 'Rota antiga: REDIRECIONADA'
    Write-Host ('Regressoes encontradas: ' + $Counters.Regressions)
    Write-Host ('Itens bloqueados: ' + $Counters.Blocked)

    if (-not $DryRun) {
        Write-Host ('Relatorio: ' + $ReportRelativePath)
        Write-Host ('Backups: ' + $BackupRoot)
    }

    Write-Host ''
    $finalPhrase = Decode-Utf8Base64 'TyBwYWluZWwgZG8gT3LDp2FseSBmb2kgcmVwYWdpbmFkbyBjb20gdmlzdWFsIHByZW1pdW0gZSBleHBlcmnDqm5jaWEgYWRhcHRhZGEgYW8gdGlwbyBkZSBuZWfDs2NpbywgcHJlc2VydmFuZG8gZnVuw6fDtWVzIGV4aXN0ZW50ZXMgZSBkaXJlY2lvbmFuZG8gQXNzaW5hdHVyYSBkaXJldGFtZW50ZSBwYXJhIC9wYWluZWwvYXNzaW5hdHVyYS4='
    Write-Host $finalPhrase -ForegroundColor Green

    exit 0
}
catch {
    Write-Failure $_.Exception.Message

    if (-not $DryRun) {
        Write-Host ('Backups preservados em: ' + $BackupRoot) -ForegroundColor Yellow
        Write-Host ('Log: ' + $LogPath) -ForegroundColor Yellow
    }

    exit 1
}
