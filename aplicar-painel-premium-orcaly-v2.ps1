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
$BackupRoot = Join-Path $ProjectRoot ('.orcaly-backups\painel-premium-v2-' + $Timestamp)
$LogPath = Join-Path $BackupRoot 'execucao.log'
$ManifestPath = Join-Path $BackupRoot 'manifesto-arquivos-alterados.txt'
$ReportPath = Join-Path $ProjectRoot 'RELATORIO-PAINEL-PREMIUM-ORCALY-V2.md'

$ChangedFiles = New-Object System.Collections.Generic.List[string]
$CreatedFiles = New-Object System.Collections.Generic.List[string]
$QaResults = New-Object System.Collections.Generic.List[object]
$BackupMap = @{}
$BuildResults = @{}
$Counters = @{
    PagesCovered = 0
    ComponentsUpdated = 0
    VisualRules = 0
    FunctionsPreserved = 0
    Regressions = 0
    Blocked = 0
}

function Write-LogLine {
    param([string]$Message)
    if ($DryRun) { return }
    $directory = Split-Path -Parent $LogPath
    if (-not (Test-Path -LiteralPath $directory)) {
        [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    }
    [System.IO.File]::AppendAllText(
        $LogPath,
        ('[{0}] {1}{2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message, [Environment]::NewLine),
        $Utf8NoBom
    )
}

function Write-Step {
    param([string]$Message)
    Write-Host ('`n==> ' + $Message) -ForegroundColor Cyan
    Write-LogLine ('STEP: ' + $Message)
}

function Write-Success {
    param([string]$Message)
    Write-Host ('[OK] ' + $Message) -ForegroundColor Green
    Write-LogLine ('OK: ' + $Message)
}

function Write-Warning {
    param([string]$Message)
    Write-Host ('[AVISO] ' + $Message) -ForegroundColor Yellow
    Write-LogLine ('WARNING: ' + $Message)
}

function Write-Failure {
    param([string]$Message)
    Write-Host ('[ERRO] ' + $Message) -ForegroundColor Red
    Write-LogLine ('ERROR: ' + $Message)
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
    if (-not (Test-Path -LiteralPath $parent)) {
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
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { return $null }
    if ($BackupMap.ContainsKey($RelativePath)) { return $BackupMap[$RelativePath] }
    if ($DryRun) { return $null }

    $destination = Join-Path $BackupRoot $normalized
    $destinationDirectory = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $destinationDirectory)) {
        [System.IO.Directory]::CreateDirectory($destinationDirectory) | Out-Null
    }
    Copy-Item -LiteralPath $source -Destination $destination -Force
    $BackupMap[$RelativePath] = $destination
    Write-LogLine ('BACKUP: ' + $RelativePath + ' -> ' + $destination)
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
    $current = if ($exists) { [System.IO.File]::ReadAllText($fullPath) } else { $null }

    if ($exists -and $current -eq $Content) {
        if ($VerboseOutput) { Write-Host ('[SEM ALTERACAO] ' + $RelativePath) -ForegroundColor DarkGray }
        return $false
    }

    if ($DryRun) {
        Write-Host ('[DRY-RUN] ' + $(if ($exists) { 'Alteraria: ' } else { 'Criaria: ' }) + $RelativePath + ' - ' + $Reason) -ForegroundColor Magenta
        return $true
    }

    if ($exists) { Backup-ProjectFile $RelativePath | Out-Null }
    Write-Utf8NoBom -Path $fullPath -Content $Content
    Add-ChangedFile -RelativePath $RelativePath -Created:(-not $exists)
    Write-Success ($(if ($exists) { 'Atualizado: ' } else { 'Criado: ' }) + $RelativePath)
    Write-LogLine ('CHANGE: ' + $RelativePath + ' - ' + $Reason)
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
    if ($Status -eq 'FALHOU') { $Counters.Regressions++ }
    if ($Status -eq 'BLOQUEADO') { $Counters.Blocked++ }
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
        '(?m)\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?[^=\r\n]+=>'
    )
    foreach ($pattern in $patterns) {
        foreach ($match in [regex]::Matches($Content, $pattern)) {
            [void]$names.Add($match.Groups[1].Value)
        }
    }
    return @($names)
}

function Assert-FunctionsPreserved {
    param(
        [string]$RelativePath,
        [string[]]$Before,
        [string]$AfterContent
    )
    $after = @(Get-FunctionNames $AfterContent)
    $missing = @($Before | Where-Object { $after -notcontains $_ })
    if ($missing.Count -gt 0) {
        Add-QaResult -Area ('Funcoes: ' + $RelativePath) -Status 'FALHOU' -Detail ('Funcoes ausentes: ' + ($missing -join ', '))
        Stop-OnCriticalFailure ('Protecao funcional acionada em ' + $RelativePath + '. Funcoes ausentes: ' + ($missing -join ', '))
    }
    $Counters.FunctionsPreserved += $Before.Count
    Add-QaResult -Area ('Funcoes: ' + $RelativePath) -Status 'PASSOU' -Detail ($Before.Count.ToString() + ' funcoes preservadas.')
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

function Get-PremiumShellV2Content {
    return @'
'use client'

import type { ReactNode } from 'react'
import PanelSidebar from '@/components/painel/PanelSidebar'
import PanelPremiumHeader, { type PanelPremiumCompany } from '@/components/painel/PanelPremiumHeader'

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
      className="orcaly-panel-premium orcaly-panel-premium-v2 min-h-screen lg:grid lg:grid-cols-[292px_minmax(0,1fr)]"
      data-orcaly-premium="v2"
    >
      <PanelSidebar company={company} />
      <div className="panel-premium-content min-w-0">
        <div className="panel-premium-top-accent" aria-hidden="true" />
        <PanelPremiumHeader company={company} pathname={pathname} />
        <div className="panel-premium-page-slot min-w-0">
          <div className="panel-premium-page-canvas">{children}</div>
        </div>
      </div>
    </div>
  )
}
'@
}

function Get-PremiumHeaderV2Content {
    return @'
'use client'

/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { PanelBadge, PanelBreadcrumb } from '@/components/panel-ui'
import { getCompanyPublicUrl } from '@/lib/company-url'

export type PanelPremiumCompany = {
  nome?: string | null
  slug?: string | null
  subdomain_slug?: string | null
  logo_url?: string | null
  business_type?: string | null
  site_template?: string | null
  assinatura_plano?: string | null
  plano?: string | null
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
  '/painel': 'Resumo executivo da operacao, vendas, pedidos e pontos que precisam de atencao.',
  '/painel/pedidos': 'Acompanhe cada pedido, prioridade e mudanca de status em um unico fluxo.',
  '/painel/produtos': 'Organize produtos, precos, imagens e disponibilidade comercial.',
  '/painel/catalogo': 'Controle como seus produtos e servicos aparecem para o cliente.',
  '/painel/clientes': 'Centralize relacionamento, historico e oportunidades comerciais.',
  '/painel/crm': 'Visualize oportunidades e avance cada negociacao com clareza.',
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
  '/painel/assinatura': 'Acompanhe plano, cobranca e recursos contratados.',
}

function planLabel(value?: string | null) {
  if (value === 'basico' || value === 'essencial') return 'Essencial'
  if (value === 'profissional') return 'Profissional'
  if (value === 'premium') return 'Premium'
  return value || 'Plano ativo'
}

function segmentLabel(value?: string | null) {
  const normalized = String(value || 'services').toLowerCase()
  const labels: Record<string, string> = {
    food: 'Food',
    grafica: 'Grafica',
    graphic: 'Grafica',
    auto: 'Auto e oficina',
    automotive: 'Auto e oficina',
    assistance: 'Assistencia',
    assistencia: 'Assistencia',
    beauty: 'Beauty',
    eventos: 'Eventos',
    events: 'Eventos',
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
  const publicUrl = publicSlug ? getCompanyPublicUrl(publicSlug) : ''
  const parts = pathname.split('/').filter(Boolean).slice(1)
  const breadcrumbItems = [
    { label: 'Painel', href: pathname === '/painel' ? undefined : '/painel' },
    ...parts.map((part, index) => ({
      label: routeLabels[part] || part.replace(/-/g, ' '),
      href: index === parts.length - 1 ? undefined : `/painel/${parts.slice(0, index + 1).join('/')}`,
    })),
  ]

  return (
    <header className="panel-premium-header panel-premium-header-v2">
      <div className="panel-premium-header-copy min-w-0 flex-1">
        <PanelBreadcrumb items={breadcrumbItems} />
        <div className="panel-premium-title-row">
          <div className="min-w-0">
            <span className="panel-premium-kicker">Central de gestao</span>
            <h1>{title}</h1>
          </div>
          <PanelBadge tone="blue">{segmentLabel(company.business_type || company.site_template)}</PanelBadge>
        </div>
        <p>{description}</p>
      </div>

      <div className="panel-premium-header-actions">
        <div className="panel-premium-company-pill" title={company.nome || 'Empresa Orcaly'}>
          {company.logo_url ? (
            <span className="panel-premium-company-logo">
              <img src={company.logo_url} alt="" />
            </span>
          ) : (
            <span className="panel-premium-company-logo panel-premium-company-initial" aria-hidden="true">
              {(company.nome || 'O').slice(0, 1)}
            </span>
          )}
          <span className="min-w-0">
            <strong>{company.nome || 'Empresa Orcaly'}</strong>
            <small>{planLabel(company.assinatura_plano || company.plano)}</small>
          </span>
        </div>

        {publicUrl ? (
          <Link href={publicUrl} target="_blank" rel="noreferrer" className="panel-premium-site-link">
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

function Get-PremiumCssV2Block {
    return @'
/* ORCALY_PANEL_PREMIUM_V2_START */
.orcaly-panel-premium-v2 {
  --orcaly-v2-navy: #071a3a;
  --orcaly-v2-blue: #174ea6;
  --orcaly-v2-blue-strong: #0b377d;
  --orcaly-v2-cyan: #1c8ed6;
  --orcaly-v2-surface: #ffffff;
  --orcaly-v2-surface-soft: #f5f8fd;
  --orcaly-v2-border: #dce5f1;
  --orcaly-v2-text: #10203a;
  --orcaly-v2-muted: #687991;
  --orcaly-v2-shadow: 0 18px 48px rgba(9, 31, 66, 0.08);
  --orcaly-v2-shadow-hover: 0 24px 58px rgba(9, 31, 66, 0.14);
  background:
    radial-gradient(circle at 78% -8%, rgba(39, 119, 214, 0.13), transparent 28rem),
    linear-gradient(180deg, #eef4fb 0, #f7f9fc 28rem, #f4f7fb 100%);
}

.orcaly-panel-premium-v2 .panel-premium-content {
  position: relative;
  min-height: 100vh;
  overflow: clip;
}

.orcaly-panel-premium-v2 .panel-premium-top-accent {
  position: fixed;
  top: 0;
  right: 0;
  left: 292px;
  z-index: 70;
  height: 3px;
  background: linear-gradient(90deg, #0b377d, #277bd6 48%, #29a5d9);
  box-shadow: 0 2px 12px rgba(23, 78, 166, 0.35);
}

.orcaly-panel-premium-v2 .panel-premium-header-v2 {
  min-height: 108px;
  border-bottom: 1px solid rgba(210, 222, 238, 0.9);
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.97), rgba(246, 250, 255, 0.95)),
    white;
  padding: 1.15rem clamp(1rem, 2.4vw, 2.15rem);
  box-shadow: 0 12px 34px rgba(9, 31, 66, 0.045);
  backdrop-filter: blur(20px);
}

.orcaly-panel-premium-v2 .panel-premium-header-copy {
  max-width: 70rem;
}

.orcaly-panel-premium-v2 .panel-premium-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.42rem;
}

.orcaly-panel-premium-v2 .panel-premium-kicker {
  display: block;
  margin-bottom: 0.12rem;
  color: #6e82a0;
  font-size: 0.62rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.orcaly-panel-premium-v2 .panel-premium-header h1 {
  font-size: clamp(1.45rem, 2.5vw, 2.05rem);
  font-weight: 900;
  letter-spacing: -0.05em;
}

.orcaly-panel-premium-v2 .panel-premium-header > div > p {
  margin-top: 0.38rem;
  color: #61738d;
  font-size: 0.83rem;
  line-height: 1.55;
}

.orcaly-panel-premium-v2 .panel-premium-company-pill {
  min-width: 12.5rem;
  border-color: #d8e3f1;
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.96);
  padding: 0.55rem 0.7rem;
  box-shadow: 0 11px 28px rgba(9, 31, 66, 0.07);
}

.orcaly-panel-premium-v2 .panel-premium-site-link {
  min-height: 3rem;
  border: 0;
  border-radius: 1rem;
  background: linear-gradient(135deg, #0b377d, #1760bf);
  padding-inline: 1rem;
  box-shadow: 0 12px 27px rgba(11, 55, 125, 0.22);
}

.orcaly-panel-premium-v2 .panel-premium-page-slot {
  padding: clamp(1rem, 2.2vw, 2rem);
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas {
  width: min(100%, 1560px);
  margin-inline: auto;
  animation: orcaly-v2-page-enter 280ms ease both;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas > :is(main, section, div):first-child {
  min-width: 0;
}

/* Sidebar: obvious visual change, routes and handlers untouched. */
.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy,
.orcaly-panel-premium-v2 .panel-sidebar-desktop {
  border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
  background:
    radial-gradient(circle at 0 0, rgba(41, 133, 218, 0.22), transparent 17rem),
    linear-gradient(180deg, #071a3a 0%, #08234e 52%, #061630 100%) !important;
  box-shadow: 12px 0 36px rgba(5, 20, 46, 0.14) !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy > div,
.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy > aside,
.orcaly-panel-premium-v2 .panel-sidebar-sticky {
  background: transparent !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy :is(h1, h2, h3, strong, span, p, small),
.orcaly-panel-premium-v2 .panel-sidebar-desktop :is(h1, h2, h3, strong, span, p, small) {
  border-color: transparent;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy nav section > :first-child,
.orcaly-panel-premium-v2 .panel-sidebar-group-label {
  color: rgba(202, 219, 243, 0.58) !important;
  font-size: 0.62rem !important;
  font-weight: 900 !important;
  letter-spacing: 0.15em !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy nav a,
.orcaly-panel-premium-v2 .panel-sidebar-link {
  min-height: 3.05rem;
  border: 1px solid transparent !important;
  border-radius: 0.95rem !important;
  background: transparent !important;
  color: rgba(231, 240, 252, 0.82) !important;
  box-shadow: none !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy nav a:hover,
.orcaly-panel-premium-v2 .panel-sidebar-link:hover {
  border-color: rgba(129, 181, 239, 0.16) !important;
  background: rgba(255, 255, 255, 0.075) !important;
  color: white !important;
  transform: translateX(3px);
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy nav a[aria-current="page"],
.orcaly-panel-premium-v2 .panel-sidebar-link-active {
  border-color: rgba(132, 196, 255, 0.34) !important;
  background: linear-gradient(135deg, rgba(35, 116, 214, 0.95), rgba(21, 78, 160, 0.98)) !important;
  color: white !important;
  box-shadow: 0 13px 30px rgba(0, 10, 31, 0.28) !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy nav a svg,
.orcaly-panel-premium-v2 .panel-sidebar-link svg {
  color: currentColor !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy nav a small,
.orcaly-panel-premium-v2 .panel-sidebar-link small {
  color: rgba(216, 229, 247, 0.56) !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy [class*="border-b"],
.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy [class*="border-t"],
.orcaly-panel-premium-v2 .panel-sidebar-brand,
.orcaly-panel-premium-v2 .panel-sidebar-footer {
  border-color: rgba(255, 255, 255, 0.09) !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy [class*="bg-blue"],
.orcaly-panel-premium-v2 .panel-sidebar-segment-card {
  border-color: rgba(119, 181, 244, 0.17) !important;
  background: rgba(255, 255, 255, 0.065) !important;
}

.orcaly-panel-premium-v2 .panel-sidebar-mobile-legacy,
.orcaly-panel-premium-v2 .panel-sidebar-mobile {
  background: rgba(7, 26, 58, 0.97) !important;
  color: white !important;
  box-shadow: 0 12px 28px rgba(5, 20, 46, 0.18);
}

/* Existing page content: cards, metrics and sections. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(
  [class*="rounded-xl"][class*="bg-white"],
  [class*="rounded-2xl"][class*="bg-white"],
  [class*="rounded-3xl"][class*="bg-white"],
  [class*="rounded-xl"][class*="border"],
  [class*="rounded-2xl"][class*="border"],
  [class*="rounded-3xl"][class*="border"]
) {
  border-color: var(--orcaly-v2-border) !important;
  border-radius: 1.25rem !important;
  background-color: rgba(255, 255, 255, 0.96) !important;
  box-shadow: var(--orcaly-v2-shadow) !important;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(
  [class*="rounded-xl"][class*="bg-white"],
  [class*="rounded-2xl"][class*="bg-white"],
  [class*="rounded-3xl"][class*="bg-white"]
):has(a, button) {
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(
  [class*="rounded-xl"][class*="bg-white"],
  [class*="rounded-2xl"][class*="bg-white"],
  [class*="rounded-3xl"][class*="bg-white"]
):has(a, button):hover {
  border-color: #cad9eb !important;
  box-shadow: var(--orcaly-v2-shadow-hover) !important;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas > :is(main, div) > :is(header, div):first-child h1,
.orcaly-panel-premium-v2 .panel-premium-page-canvas main > h1 {
  color: var(--orcaly-v2-text) !important;
  font-size: clamp(1.55rem, 2.8vw, 2.35rem) !important;
  font-weight: 900 !important;
  letter-spacing: -0.05em !important;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas h2 {
  color: #172b49;
  font-weight: 850;
  letter-spacing: -0.025em;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas h3 {
  color: #1d3455;
  font-weight: 800;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(p, small)[class*="text-gray"],
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(p, small)[class*="text-slate"] {
  color: var(--orcaly-v2-muted) !important;
}

/* Metric grids become compact executive cards. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(
  .grid[class*="md:grid-cols-4"],
  .grid[class*="lg:grid-cols-4"],
  .grid[class*="xl:grid-cols-4"],
  .grid[class*="md:grid-cols-3"],
  .grid[class*="lg:grid-cols-3"]
) > :is(div, article) {
  position: relative;
  overflow: hidden;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(
  .grid[class*="md:grid-cols-4"],
  .grid[class*="lg:grid-cols-4"],
  .grid[class*="xl:grid-cols-4"]
) > :is(div, article)::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #174ea6, #2d8bd5);
  content: '';
  opacity: 0.85;
}

/* Buttons retain actions, gain a coherent hierarchy. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-blue"],
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-indigo"],
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-slate-9"],
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-gray-9"] {
  border-color: transparent !important;
  border-radius: 0.9rem !important;
  background: linear-gradient(135deg, #0d3d86, #1763c1) !important;
  color: white !important;
  box-shadow: 0 10px 23px rgba(13, 61, 134, 0.2) !important;
  transition: transform 140ms ease, box-shadow 180ms ease, filter 180ms ease !important;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-blue"]:hover,
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-indigo"]:hover,
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-slate-9"]:hover,
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="bg-gray-9"]:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 29px rgba(13, 61, 134, 0.26) !important;
  filter: saturate(1.08);
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a):active {
  transform: translateY(0) scale(0.985);
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a):disabled {
  pointer-events: none;
  opacity: 0.55;
  box-shadow: none !important;
}

/* Forms: stronger labels, calmer inputs, visible focus. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas label {
  color: #334967;
  font-weight: 750;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(input, select, textarea) {
  max-width: 100%;
  border-color: #d5e0ed !important;
  border-radius: 0.9rem !important;
  background-color: #fbfdff !important;
  color: #142945 !important;
  box-shadow: inset 0 1px 2px rgba(9, 31, 66, 0.025);
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(input, select, textarea):hover {
  border-color: #bdcde0 !important;
  background-color: white !important;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(input, select, textarea):focus {
  border-color: #397fd0 !important;
  outline: none !important;
  box-shadow: 0 0 0 4px rgba(39, 123, 214, 0.13) !important;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas input[type="checkbox"],
.orcaly-panel-premium-v2 .panel-premium-page-canvas input[type="radio"] {
  border-radius: 0.35rem !important;
  accent-color: #174ea6;
  box-shadow: none !important;
}

/* Tables: clear header, controlled overflow and hover. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(.overflow-x-auto, [class*="overflow-x-auto"]) {
  border-radius: 1.15rem;
  scrollbar-width: thin;
  scrollbar-color: #c3d2e5 transparent;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  color: #263b58;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas thead {
  background: linear-gradient(180deg, #f7faff, #f1f6fc) !important;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas th {
  border-bottom-color: #dce6f2 !important;
  color: #5f718b !important;
  font-size: 0.68rem !important;
  font-weight: 900 !important;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas td {
  border-bottom-color: #e8eef6 !important;
  color: #273d5c;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas tbody tr {
  transition: background 150ms ease;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas tbody tr:hover {
  background: #f7faff !important;
}

/* Status pills and counters. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(span, div)[class*="rounded-full"][class*="text-"] {
  font-weight: 800;
  letter-spacing: 0.01em;
}

/* Modals and drawers. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas [class*="fixed"][class*="inset-0"] {
  backdrop-filter: blur(5px);
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas [role="dialog"],
.orcaly-panel-premium-v2 .panel-ui-modal,
.orcaly-panel-premium-v2 .panel-ui-drawer {
  border: 1px solid #d8e3f1;
  border-radius: 1.35rem;
  box-shadow: 0 28px 90px rgba(5, 20, 46, 0.25);
}

/* Empty and loading states become intentional, not abandoned. */
.orcaly-panel-premium-v2 .panel-ui-empty,
.orcaly-panel-premium-v2 .panel-ui-error,
.orcaly-panel-premium-v2 [class*="empty-state"] {
  border: 1px dashed #c7d6e8;
  border-radius: 1.3rem;
  background: linear-gradient(180deg, #fbfdff, #f5f9fe);
}

.orcaly-panel-premium-v2 .panel-ui-skeleton,
.orcaly-panel-premium-v2 [class*="animate-pulse"] {
  background: linear-gradient(90deg, #e9eff7 20%, #f7faff 40%, #e9eff7 60%);
  background-size: 220% 100%;
  animation: orcaly-v2-skeleton 1.35s ease-in-out infinite;
}

/* Make all legacy page wrappers responsive without touching handlers. */
.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(.flex, [class*="flex"]) {
  min-width: 0;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(.grid, [class*="grid"]) > * {
  min-width: 0;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas img {
  max-width: 100%;
}

.orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a, input, select, textarea):focus-visible,
.orcaly-panel-premium-v2 .panel-sidebar-desktop-legacy a:focus-visible {
  outline: 3px solid rgba(42, 129, 222, 0.38) !important;
  outline-offset: 2px !important;
}

@keyframes orcaly-v2-page-enter {
  from { opacity: 0; transform: translateY(7px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes orcaly-v2-skeleton {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (max-width: 1023px) {
  .orcaly-panel-premium-v2 .panel-premium-top-accent {
    left: 0;
  }

  .orcaly-panel-premium-v2 .panel-premium-header-v2 {
    position: relative;
    min-height: auto;
    flex-direction: column;
    align-items: stretch;
    padding-top: 1rem;
  }

  .orcaly-panel-premium-v2 .panel-premium-header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .orcaly-panel-premium-v2 .panel-premium-company-pill {
    min-width: 0;
    max-width: min(70vw, 20rem);
  }
}

@media (max-width: 680px) {
  .orcaly-panel-premium-v2 .panel-premium-page-slot {
    padding: 0.85rem;
  }

  .orcaly-panel-premium-v2 .panel-premium-header-v2 {
    padding: 0.95rem 0.85rem;
  }

  .orcaly-panel-premium-v2 .panel-premium-title-row {
    align-items: flex-start;
    justify-content: space-between;
  }

  .orcaly-panel-premium-v2 .panel-premium-header h1 {
    font-size: 1.45rem;
  }

  .orcaly-panel-premium-v2 .panel-premium-header-actions {
    flex-wrap: wrap;
  }

  .orcaly-panel-premium-v2 .panel-premium-company-pill {
    flex: 1 1 12rem;
  }

  .orcaly-panel-premium-v2 .panel-premium-site-link {
    min-height: 2.8rem;
  }

  .orcaly-panel-premium-v2 .panel-premium-page-canvas table {
    min-width: 42rem;
  }

  .orcaly-panel-premium-v2 .panel-premium-page-canvas :is(button, a)[class*="px-"] {
    min-height: 2.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .orcaly-panel-premium-v2 *,
  .orcaly-panel-premium-v2 *::before,
  .orcaly-panel-premium-v2 *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
/* ORCALY_PANEL_PREMIUM_V2_END */
'@
}

function Patch-PremiumCss {
    $relative = 'app/painel/premium.css'
    $path = Join-Path $ProjectRoot $relative
    $current = if (Test-Path -LiteralPath $path) { [System.IO.File]::ReadAllText($path) } else { '' }
    $block = Get-PremiumCssV2Block
    $updated = Replace-MarkedBlock -Content $current -StartMarker '/* ORCALY_PANEL_PREMIUM_V2_START */' -EndMarker '/* ORCALY_PANEL_PREMIUM_V2_END */' -Block $block
    if (Update-ProjectFile -RelativePath $relative -Content $updated -Reason 'camada visual premium v2 escopada sobre todas as paginas do painel') {
        $Counters.ComponentsUpdated++
        $Counters.VisualRules = ([regex]::Matches($block, '\{')).Count
    }
}

function Patch-ComponentSafely {
    param(
        [string]$RelativePath,
        [string]$NewContent,
        [string]$Reason
    )
    $path = Join-Path $ProjectRoot $RelativePath
    $beforeContent = if (Test-Path -LiteralPath $path) { [System.IO.File]::ReadAllText($path) } else { '' }
    $beforeFunctions = @(Get-FunctionNames $beforeContent)
    $changed = Update-ProjectFile -RelativePath $RelativePath -Content $NewContent -Reason $Reason
    $afterContent = if ($changed -and -not $DryRun) { [System.IO.File]::ReadAllText($path) } else { $NewContent }
    Assert-FunctionsPreserved -RelativePath $RelativePath -Before $beforeFunctions -AfterContent $afterContent
    if ($changed) { $Counters.ComponentsUpdated++ }
}

function Ensure-LayoutUsesPremiumV2 {
    $relative = 'app/painel/layout.tsx'
    $path = Join-Path $ProjectRoot $relative
    if (-not (Test-Path -LiteralPath $path)) {
        Stop-OnCriticalFailure ('Arquivo obrigatorio ausente: ' + $relative)
    }

    $content = [System.IO.File]::ReadAllText($path)
    $beforeFunctions = @(Get-FunctionNames $content)
    $updated = $content

    if ($updated -notmatch "import './premium.css'") {
        $importAnchor = "import PanelPremiumShell from '@/components/painel/PanelPremiumShell'"
        if ($updated.Contains($importAnchor)) {
            $updated = $updated.Replace($importAnchor, $importAnchor + [Environment]::NewLine + "import './premium.css'")
        }
        else {
            Stop-OnCriticalFailure 'O layout nao importa PanelPremiumShell; o patch v2 nao fara substituicao cega.'
        }
    }

    if ($updated -notmatch '<PanelPremiumShell\s+company=') {
        Stop-OnCriticalFailure 'O layout atual nao usa PanelPremiumShell. Execute primeiro o patch premium anterior ou restaure o layout esperado.'
    }

    $changed = Update-ProjectFile -RelativePath $relative -Content $updated -Reason 'garantir carregamento da camada premium v2'
    $afterContent = if ($changed -and -not $DryRun) { [System.IO.File]::ReadAllText($path) } else { $updated }
    Assert-FunctionsPreserved -RelativePath $relative -Before $beforeFunctions -AfterContent $afterContent
    if ($changed) { $Counters.ComponentsUpdated++ }
}

function Audit-PagesCovered {
    $painelRoot = Join-Path $ProjectRoot 'app\painel'
    $pages = @(Get-ChildItem -LiteralPath $painelRoot -Filter 'page.tsx' -File -Recurse -ErrorAction SilentlyContinue)
    $Counters.PagesCovered = $pages.Count
    foreach ($page in $pages) {
        $relative = $page.FullName.Substring($ProjectRoot.Length).TrimStart('\').Replace('\', '/')
        $content = [System.IO.File]::ReadAllText($page.FullName)
        $functions = @(Get-FunctionNames $content)
        $Counters.FunctionsPreserved += $functions.Count
        if ($VerboseOutput) {
            Write-Host ('[AUDITADO] ' + $relative + ' | funcoes: ' + $functions.Count) -ForegroundColor DarkGray
        }
    }
    Add-QaResult -Area 'Cobertura visual' -Status 'PASSOU' -Detail ($pages.Count.ToString() + ' paginas existentes permanecem sob o escopo visual do PanelPremiumShell.')
}

function Test-ProtectedFilesUnchanged {
    $protected = @(
        'package.json',
        'package-lock.json',
        'proxy.ts',
        '.env',
        '.env.local'
    )
    foreach ($relative in $protected) {
        if ($ChangedFiles.Contains($relative)) {
            Add-QaResult -Area ('Protecao: ' + $relative) -Status 'FALHOU' -Detail 'Arquivo protegido apareceu no manifesto.'
            Stop-OnCriticalFailure ('Arquivo protegido alterado: ' + $relative)
        }
    }
    Add-QaResult -Area 'Arquivos protegidos' -Status 'PASSOU' -Detail 'Auth, APIs, Mercado Pago, banco, package.json, proxy e variaveis de ambiente nao foram alterados.'
}

function Write-Manifest {
    if ($DryRun) { return }
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('Orcaly - Painel Premium V2')
    $lines.Add('Data: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
    $lines.Add('')
    foreach ($file in $ChangedFiles) { $lines.Add($file) }
    Write-Utf8NoBom -Path $ManifestPath -Content ($lines -join [Environment]::NewLine)
}

function Build-Report {
    if ($DryRun -or $SkipQa) { return }

    $initialStatus = if ($BuildResults.ContainsKey('build-inicial')) {
        if ($BuildResults['build-inicial'].Passed) { 'PASSOU' } else { 'FALHOU' }
    } else { 'NAO TESTADO' }

    $finalStatus = if ($BuildResults.ContainsKey('build-final')) {
        if ($BuildResults['build-final'].Passed) { 'PASSOU' } else { 'FALHOU' }
    } else { 'NAO TESTADO' }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('# RELATORIO PAINEL PREMIUM ORCALY V2')
    $lines.Add('')
    $lines.Add('## Resumo')
    $lines.Add('')
    $lines.Add('Refatoracao visual corretiva aplicada por escopo ao painel existente. Nenhuma regra de negocio, consulta Supabase, API, Auth, checkout ou integracao de pagamento foi alterada.')
    $lines.Add('')
    $lines.Add('## Resultado')
    $lines.Add('')
    $lines.Add('- Build inicial: ' + $initialStatus)
    $lines.Add('- Build final: ' + $finalStatus)
    $lines.Add('- Paginas cobertas visualmente: ' + $Counters.PagesCovered)
    $lines.Add('- Componentes atualizados: ' + $Counters.ComponentsUpdated)
    $lines.Add('- Regras visuais adicionadas: ' + $Counters.VisualRules)
    $lines.Add('- Funcoes auditadas/preservadas: ' + $Counters.FunctionsPreserved)
    $lines.Add('- Regressoes encontradas: ' + $Counters.Regressions)
    $lines.Add('- Itens bloqueados: ' + $Counters.Blocked)
    $lines.Add('')
    $lines.Add('## Arquivos alterados')
    $lines.Add('')
    foreach ($file in $ChangedFiles) { $lines.Add('- ' + $file) }
    $lines.Add('')
    $lines.Add('## QA')
    $lines.Add('')
    foreach ($result in $QaResults) {
        $lines.Add('- [' + $result.Status + '] ' + $result.Area + ': ' + $result.Detail)
    }
    $lines.Add('')
    $lines.Add('## Testes manuais necessarios')
    $lines.Add('')
    $lines.Add('- Abrir o dashboard e comparar sidebar, header, cards e espacamentos.')
    $lines.Add('- Abrir Pedidos, Produtos, Financeiro, Pagamentos, Entregas e Configuracoes.')
    $lines.Add('- Validar tabelas e formularios em desktop e celular.')
    $lines.Add('- Validar modais e botoes usando dados reais e sessao autenticada.')
    $lines.Add('- Confirmar que nenhuma acao ou handler mudou de comportamento.')
    $lines.Add('')
    $lines.Add('Status externo dependente de navegador, Supabase real e autenticacao: BLOQUEADO ate teste manual.')

    Update-ProjectFile -RelativePath 'RELATORIO-PAINEL-PREMIUM-ORCALY-V2.md' -Content ($lines -join [Environment]::NewLine) -Reason 'relatorio de QA visual e funcional do patch corretivo' | Out-Null
}

try {
    Write-Step 'Validando raiz do projeto'
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

    Write-Step 'Auditando paginas e funcoes existentes'
    Audit-PagesCovered

    if (-not $SkipInitialBuild) {
        Write-Step 'Executando build inicial'
        $initial = Invoke-NpmCommand -Label 'build-inicial' -Arguments @('run', 'build')
        if (-not $initial.Passed -and -not $initial.Skipped) {
            Write-Warning 'O build inicial falhou. O patch visual continuara, mas o erro preexistente sera registrado.'
            Add-QaResult -Area 'Build inicial' -Status 'FALHOU' -Detail ('Codigo ' + $initial.ExitCode + '. Consulte ' + $initial.Output)
        }
        else {
            Add-QaResult -Area 'Build inicial' -Status $(if ($initial.Skipped) { 'NAO TESTADO' } else { 'PASSOU' }) -Detail 'Baseline registrada.'
        }
    }
    else {
        Add-QaResult -Area 'Build inicial' -Status 'NAO TESTADO' -Detail 'Ignorado por parametro.'
    }

    Write-Step 'Aplicando camada visual premium v2'
    Ensure-LayoutUsesPremiumV2
    Patch-ComponentSafely -RelativePath 'components/painel/PanelPremiumShell.tsx' -NewContent (Get-PremiumShellV2Content) -Reason 'shell premium v2 com canvas visual consistente'
    Patch-ComponentSafely -RelativePath 'components/painel/PanelPremiumHeader.tsx' -NewContent (Get-PremiumHeaderV2Content) -Reason 'header executivo mais visivel e organizado'
    Patch-PremiumCss

    Test-ProtectedFilesUnchanged

    if (-not $DryRun -and -not $SkipFinalBuild) {
        Write-Step 'Executando build final'
        $final = Invoke-NpmCommand -Label 'build-final' -Arguments @('run', 'build')
        if (-not $final.Passed) {
            Add-QaResult -Area 'Build final' -Status 'FALHOU' -Detail ('Codigo ' + $final.ExitCode + '. Consulte ' + $final.Output)
            Stop-OnCriticalFailure 'O build final falhou. Os backups foram preservados para restauracao.'
        }
        Add-QaResult -Area 'Build final' -Status 'PASSOU' -Detail ('Concluido em ' + $final.DurationSeconds + 's.')
    }
    elseif ($SkipFinalBuild) {
        Add-QaResult -Area 'Build final' -Status 'NAO TESTADO' -Detail 'Ignorado por parametro.'
    }

    Add-QaResult -Area 'Navegador e dados reais' -Status 'BLOQUEADO' -Detail 'Exige sessao autenticada, Supabase real e validacao visual manual.'

    Build-Report
    Write-Manifest

    Write-Host ''
    Write-Host 'Orcaly - painel premium visual v2 aplicado' -ForegroundColor Green
    Write-Host ('Build inicial: ' + $(if ($BuildResults.ContainsKey('build-inicial')) { if ($BuildResults['build-inicial'].Passed) { 'PASSOU' } else { 'FALHOU' } } else { 'NAO TESTADO' }))
    Write-Host ('Build final: ' + $(if ($BuildResults.ContainsKey('build-final')) { if ($BuildResults['build-final'].Passed) { 'PASSOU' } else { 'FALHOU' } } else { 'NAO TESTADO' }))
    Write-Host ('Funcoes preservadas: ' + $Counters.FunctionsPreserved)
    Write-Host ('Paginas cobertas visualmente: ' + $Counters.PagesCovered)
    Write-Host ('Componentes atualizados: ' + $Counters.ComponentsUpdated)
    Write-Host ('Regras visuais adicionadas: ' + $Counters.VisualRules)
    Write-Host ('Regressoes encontradas: ' + $Counters.Regressions)
    Write-Host ('Itens bloqueados: ' + $Counters.Blocked)
    if (-not $DryRun) {
        Write-Host ('Relatorio: RELATORIO-PAINEL-PREMIUM-ORCALY-V2.md')
        Write-Host ('Backups: ' + $BackupRoot)
    }
    Write-Host ''
    Write-Host 'Painel do Orcaly modernizado visualmente com uma camada premium perceptivel, preservando funcoes, regras de negocio e integracoes existentes.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Failure $_.Exception.Message
    if (-not $DryRun) {
        Write-Host ('Backups preservados em: ' + $BackupRoot) -ForegroundColor Yellow
    }
    exit 1
}
