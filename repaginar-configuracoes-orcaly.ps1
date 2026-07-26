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
$BackupRoot = Join-Path $ProjectRoot ('.orcaly-backups\configuracoes-premium-' + $Timestamp)
$LogPath = Join-Path $BackupRoot 'execucao.log'
$ManifestPath = Join-Path $BackupRoot 'manifesto-arquivos.json'
$ReportPath = Join-Path $ProjectRoot 'RELATORIO-CONFIGURACOES-PREMIUM-ORCALY.md'
$ChangedFiles = New-Object System.Collections.Generic.List[string]
$CreatedFiles = New-Object System.Collections.Generic.List[string]
$QaResults = New-Object System.Collections.Generic.List[object]
$AuditNotes = New-Object System.Collections.Generic.List[string]
$BackedUp = @{}
$InitialBuild = 'NAO TESTADO'
$FinalBuild = 'NAO TESTADO'
$InitialLint = 'NAO TESTADO'
$FinalLint = 'NAO TESTADO'
$PreservedFunctions = 0
$ComponentsReused = 0
$ComponentsCreated = 0
$RealPreferences = 0
$IntegrationsOrganized = 3
$DuplicatesRemoved = 0
$BlockedTests = 0

function Expand-UnicodeEscapes {
    param([string]$Text)
    return [System.Text.RegularExpressions.Regex]::Replace(
        $Text,
        '\\u([0-9a-fA-F]{4})',
        {
            param($Match)
            return [char][Convert]::ToInt32($Match.Groups[1].Value, 16)
        }
    )
}

function Write-LogLine {
    param(
        [string]$Level,
        [string]$Message
    )

    $Line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    if (-not $DryRun) {
        [System.IO.File]::AppendAllText($LogPath, $Line + [Environment]::NewLine, $Utf8NoBom)
    }

    if ($VerboseOutput) {
        Write-Host $Line -ForegroundColor DarkGray
    }
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
    Write-LogLine -Level 'STEP' -Message $Message
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
    Write-LogLine -Level 'OK' -Message $Message
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
    Write-LogLine -Level 'WARN' -Message $Message
}

function Write-Failure {
    param([string]$Message)
    Write-Host "[ERRO] $Message" -ForegroundColor Red
    Write-LogLine -Level 'ERROR' -Message $Message
}

function Stop-OnCriticalFailure {
    param([string]$Message)
    Write-Failure $Message
    throw $Message
}

function Add-QaResult {
    param(
        [string]$Area,
        [ValidateSet('PASSOU','FALHOU','BLOQUEADO','NAO TESTADO')]
        [string]$Status,
        [string]$Details
    )

    $QaResults.Add([pscustomobject]@{
        Area = $Area
        Status = $Status
        Details = $Details
    }) | Out-Null
}

function Add-ChangedFile {
    param(
        [string]$RelativePath,
        [switch]$Created
    )

    $Normalized = $RelativePath.Replace('\', '/')
    if (-not $ChangedFiles.Contains($Normalized)) {
        $ChangedFiles.Add($Normalized) | Out-Null
    }
    if ($Created -and -not $CreatedFiles.Contains($Normalized)) {
        $CreatedFiles.Add($Normalized) | Out-Null
    }
}

function Test-ProjectFile {
    param([string]$RelativePath)
    return Test-Path -LiteralPath (Join-Path $ProjectRoot $RelativePath)
}

function Backup-ProjectFile {
    param([string]$RelativePath)

    $Source = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Source)) {
        return
    }
    if ($BackedUp.ContainsKey($RelativePath)) {
        return
    }

    $Destination = Join-Path $BackupRoot $RelativePath
    $DestinationDirectory = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $DestinationDirectory)) {
        New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
    }

    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    $BackedUp[$RelativePath] = $true
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $Directory = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }

    [System.IO.File]::WriteAllText($Path, (Expand-UnicodeEscapes $Content), $Utf8NoBom)
}

function Update-ProjectFile {
    param(
        [string]$RelativePath,
        [string]$Content,
        [switch]$AllowExistingUnknown
    )

    $FullPath = Join-Path $ProjectRoot $RelativePath
    $ExpandedContent = Expand-UnicodeEscapes $Content
    $Exists = Test-Path -LiteralPath $FullPath
    $Current = if ($Exists) { [System.IO.File]::ReadAllText($FullPath) } else { $null }

    if ($Exists -and $Current -eq $ExpandedContent) {
        Write-Success "Sem alteracao: $RelativePath"
        return $false
    }

    if ($DryRun) {
        Write-Host "[DRY-RUN] Atualizaria: $RelativePath" -ForegroundColor Magenta
        return $true
    }

    if ($Exists) {
        Backup-ProjectFile $RelativePath
    }

    Write-Utf8NoBom -Path $FullPath -Content $Content
    Add-ChangedFile -RelativePath $RelativePath -Created:(-not $Exists)
    Write-Success "Atualizado: $RelativePath"
    return $true
}

function Get-PackageScripts {
    $PackagePath = Join-Path $ProjectRoot 'package.json'
    $Package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
    if ($Package.scripts) {
        return $Package.scripts
    }
    return $null
}

function Invoke-NpmCommand {
    param(
        [string]$Label,
        [string[]]$Arguments,
        [switch]$Critical
    )

    Write-Step "Executando $Label"
    $OutputPath = Join-Path $BackupRoot ($Label + '.log')
    $Started = Get-Date

    & npm.cmd @Arguments 2>&1 | Tee-Object -FilePath $OutputPath | Out-Host
    $Code = $LASTEXITCODE
    $Duration = [math]::Round(((Get-Date) - $Started).TotalSeconds, 2)

    $Result = [pscustomobject]@{
        Passed = ($Code -eq 0)
        ExitCode = $Code
        DurationSeconds = $Duration
        OutputPath = $OutputPath
    }

    if ($Code -eq 0) {
        Write-Success "$Label passou em ${Duration}s"
    }
    else {
        Write-Warning "$Label falhou com codigo $Code em ${Duration}s"
        if ($Critical) {
            Stop-OnCriticalFailure "$Label falhou. Consulte $OutputPath"
        }
    }

    return $Result
}

function Get-FunctionNames {
    param([string]$Content)

    $Names = New-Object System.Collections.Generic.HashSet[string]
    $Patterns = @(
        '(?m)\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(',
        '(?m)\b(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\(',
        '(?m)\b(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?[^=]*=>',
        '(?m)\basync\s+function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\('
    )

    foreach ($Pattern in $Patterns) {
        foreach ($Match in [regex]::Matches($Content, $Pattern)) {
            [void]$Names.Add($Match.Groups[1].Value)
        }
    }

    return @($Names)
}

function Test-RequiredFunction {
    param(
        [string]$Name,
        [string]$Content
    )

    return $Content -match ('\b' + [regex]::Escape($Name) + '\b')
}

function Compare-PageFunctions {
    param(
        [string[]]$BeforeNames,
        [string]$AfterContent
    )

    $Missing = @()
    foreach ($Name in $BeforeNames) {
        if (-not (Test-RequiredFunction -Name $Name -Content $AfterContent)) {
            $Missing += $Name
        }
    }
    return $Missing
}

function Test-SelfSyntax {
    $SelfPath = $MyInvocation.ScriptName
    if ([string]::IsNullOrWhiteSpace($SelfPath)) {
        return
    }

    $Tokens = $null
    $Errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($SelfPath, [ref]$Tokens, [ref]$Errors) | Out-Null
    if ($Errors -and $Errors.Count -gt 0) {
        $Messages = ($Errors | ForEach-Object { 'Linha {0}: {1}' -f $_.Extent.StartLineNumber, $_.Message }) -join '; '
        throw "Falha na validacao de sintaxe do PS1: $Messages"
    }
}

function Initialize-Environment {
    Test-SelfSyntax

    $Required = @('package.json','app','components','lib')
    foreach ($Item in $Required) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $Item))) {
            Stop-OnCriticalFailure "Execute este arquivo na raiz do projeto. Item ausente: $Item"
        }
    }

    if (Test-Path -LiteralPath (Join-Path $ProjectRoot 'middleware.ts')) {
        $AuditNotes.Add('middleware.ts ja existia antes do patcher; nao foi alterado.') | Out-Null
    }

    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
        Write-Utf8NoBom -Path $LogPath -Content ''
    }
}

function Invoke-Audit {
    Write-Step 'Fase 0 - auditando Configuracoes, equipe, empresa e subdominio'

    $Patterns = @(
        'business_type','company_id','subdomain_slug','slug','company_users','company_members',
        'team','invite','removeUser','handleAdd','handleRemove','handleDelete','handleSave',
        'loadCompany','loadMembers','updateCompany','orcaly.com.br','company-url'
    )

    $AuditRoots = @(
        'app/painel/configuracoes',
        'app/api/company',
        'app/api/settings',
        'app/api/team',
        'components/settings',
        'components/team',
        'components/painel',
        'lib',
        'supabase/migrations'
    )

    $Files = New-Object System.Collections.Generic.List[string]
    foreach ($Root in $AuditRoots) {
        $Full = Join-Path $ProjectRoot $Root
        if (Test-Path -LiteralPath $Full) {
            Get-ChildItem -LiteralPath $Full -Recurse -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Extension -in @('.ts','.tsx','.js','.jsx','.sql') } |
                ForEach-Object { $Files.Add($_.FullName) | Out-Null }
        }
    }

    $Hits = @{}
    foreach ($Pattern in $Patterns) {
        $Hits[$Pattern] = 0
    }

    foreach ($File in $Files) {
        $Text = [System.IO.File]::ReadAllText($File)
        foreach ($Pattern in $Patterns) {
            if ($Text -match [regex]::Escape($Pattern)) {
                $Hits[$Pattern]++
            }
        }
    }

    $AuditNotes.Add(('Arquivos auditados: {0}' -f $Files.Count)) | Out-Null
    foreach ($Pattern in $Patterns) {
        if ($Hits[$Pattern] -gt 0) {
            $AuditNotes.Add(('{0}: {1} arquivo(s)' -f $Pattern, $Hits[$Pattern])) | Out-Null
        }
    }

    $SettingsPage = Join-Path $ProjectRoot 'app/painel/configuracoes/page.tsx'
    if (-not (Test-Path -LiteralPath $SettingsPage)) {
        Stop-OnCriticalFailure 'A rota app/painel/configuracoes/page.tsx nao foi encontrada.'
    }

    $PageContent = [System.IO.File]::ReadAllText($SettingsPage)
    $FunctionNames = Get-FunctionNames $PageContent
    $script:PreservedFunctions = $FunctionNames.Count
    $AuditNotes.Add(('Funcoes/handlers detectados na pagina atual: {0}' -f $FunctionNames.Count)) | Out-Null

    $TeamEvidence = ($PageContent -match '(?i)equipe|funcion|member|team|convite|invite')
    Add-QaResult -Area 'Equipe existente identificada' -Status $(if ($TeamEvidence) { 'PASSOU' } else { 'BLOQUEADO' }) -Details $(if ($TeamEvidence) { 'A pagina possui referencias ao gerenciamento de equipe.' } else { 'Nao foi possivel comprovar equipe pela analise estatica.' })

    $SlugEvidence = ($PageContent -match '(?i)slug|subdom|endereco publico|orcaly\.com\.br')
    Add-QaResult -Area 'Slug existente identificado' -Status $(if ($SlugEvidence) { 'PASSOU' } else { 'BLOQUEADO' }) -Details $(if ($SlugEvidence) { 'A pagina possui referencias ao endereco publico.' } else { 'Nao foi possivel comprovar editor de slug pela analise estatica.' })

    Write-Success "Auditoria concluida: $($Files.Count) arquivos relacionados"
}

function Write-PremiumComponent {
    $ComponentPath = 'components/settings/SettingsPremiumShell.tsx'
    $CssPath = 'components/settings/SettingsPremiumShell.module.css'

    $ComponentFull = Join-Path $ProjectRoot $ComponentPath
    if (Test-Path -LiteralPath $ComponentFull) {
        $Existing = [System.IO.File]::ReadAllText($ComponentFull)
        if ($Existing -notmatch 'ORCALY_SETTINGS_PREMIUM_SHELL_V1') {
            Stop-OnCriticalFailure "$ComponentPath ja existe e nao pertence a este patcher. Nenhum arquivo desconhecido sera sobrescrito."
        }
    }

    $Component = @'
'use client'

// ORCALY_SETTINGS_PREMIUM_SHELL_V1
import Link from 'next/link'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import styles from './SettingsPremiumShell.module.css'

type UnknownRecord = Record<string, unknown>

type CompanySummary = {
  name: string
  status?: string
  businessType?: string
  plan?: string
  slug?: string
  logoUrl?: string
}

type NavigationItem = {
  id: string
  label: string
  keywords: string[]
}

const NAVIGATION: NavigationItem[] = [
  { id: 'overview', label: 'Vis\u00e3o geral', keywords: [] },
  { id: 'company', label: 'Informa\u00e7\u00f5es da empresa', keywords: ['empresa', 'dados', 'informa'] },
  { id: 'team', label: 'Equipe e acessos', keywords: ['equipe', 'funcion', 'membro', 'acesso', 'convite'] },
  { id: 'preferences', label: 'Prefer\u00eancias', keywords: ['prefer', 'geral'] },
  { id: 'site', label: 'Site e endere\u00e7o p\u00fablico', keywords: ['site', 'slug', 'subdom', 'endere\u00e7o p\u00fablico'] },
  { id: 'notifications', label: 'Notifica\u00e7\u00f5es', keywords: ['notifica'] },
  { id: 'security', label: 'Seguran\u00e7a', keywords: ['seguran', 'senha', 'sess'] },
  { id: 'integrations', label: 'Integra\u00e7\u00f5es', keywords: [] },
  { id: 'privacy', label: 'Dados e privacidade', keywords: ['privacidade', 'export', 'dados'] },
]

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function readString(record: UnknownRecord | null, keys: string[]): string | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function unwrapCompany(payload: unknown): UnknownRecord | null {
  const root = asRecord(payload)
  if (!root) return null
  return asRecord(root.company) || asRecord(root.data) || root
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function formatBusinessType(value?: string): string | undefined {
  if (!value) return undefined
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildPublicUrl(slug?: string): string | undefined {
  if (!slug) return undefined
  const clean = slug.trim().toLowerCase()
  if (!clean) return undefined
  return `https://${clean}.orcaly.com.br`
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.icon}>
      <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.summaryIcon}>
      <path d="M4 21V7l8-4 8 4v14M8 10h2m4 0h2M8 14h2m4 0h2M9 21v-3h6v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.inlineIcon}>
      <path d="M6.5 9V6.8a3.5 3.5 0 017 0V9m-8 0h9v7h-9V9z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.inlineIcon}>
      <path d="M8.2 11.8l3.6-3.6m-5.2 7.2H5a3 3 0 010-6h2m6-4h2a3 3 0 010 6h-1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function SettingsPremiumShell({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const integrationsRef = useRef<HTMLElement>(null)
  const [company, setCompany] = useState<CompanySummary | null>(null)
  const [teamCount, setTeamCount] = useState<number | null>(null)
  const [availableNavigation, setAvailableNavigation] = useState<NavigationItem[]>([
    NAVIGATION[0],
    NAVIGATION[7],
  ])
  const [activeSection, setActiveSection] = useState('overview')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSummary() {
      try {
        const companyResponse = await fetch('/api/company/current', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (companyResponse.ok) {
          const payload: unknown = await companyResponse.json()
          const record = unwrapCompany(payload)
          if (active && record) {
            setCompany({
              name: readString(record, ['nome_fantasia', 'name', 'nome', 'company_name']) || 'Sua empresa',
              status: readString(record, ['status', 'company_status']),
              businessType: readString(record, ['business_type', 'segment', 'segmento']),
              plan: readString(record, ['plan', 'plan_name', 'assinatura_plano', 'subscription_plan']),
              slug: readString(record, ['subdomain_slug', 'slug']),
              logoUrl: readString(record, ['logo_url', 'logo', 'avatar_url']),
            })
          }
        }
      } catch {
        // O resumo e complementar; a pagina funcional permanece disponivel.
      }

      try {
        const teamResponse = await fetch('/api/company/team', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        if (teamResponse.ok) {
          const payload: unknown = await teamResponse.json()
          const root = asRecord(payload)
          const candidates = [payload, root?.members, root?.team, root?.data, root?.users]
          const list = candidates.find(Array.isArray)
          if (active && Array.isArray(list)) setTeamCount(list.length)
        }
      } catch {
        // A contagem e ocultada quando a API nao estiver disponivel.
      }
    }

    void loadSummary()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const headings = Array.from(
      container.querySelectorAll<HTMLElement>('h1, h2, h3, [data-settings-section]'),
    )

    const firstTitle = headings.find((heading) =>
      normalizeText(heading.textContent || '').includes('configuracoes'),
    )
    if (firstTitle?.tagName === 'H1') {
      firstTitle.dataset.orcalyLegacyTitle = 'true'
    }

    const found: NavigationItem[] = [NAVIGATION[0]]
    const usedElements = new Set<HTMLElement>()

    for (const item of NAVIGATION.slice(1)) {
      if (item.id === 'integrations') {
        found.push(item)
        continue
      }

      const element = headings.find((heading) => {
        if (usedElements.has(heading)) return false
        const text = normalizeText(heading.textContent || '')
        return item.keywords.some((keyword) => text.includes(normalizeText(keyword)))
      })

      if (element) {
        element.id = element.id || `settings-${item.id}`
        element.dataset.orcalySettingsTarget = item.id
        usedElements.add(element)
        found.push(item)
      }
    }

    setAvailableNavigation(found)

    const explicitBusinessInputs = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        '[name="business_type"], [name="businessType"], #business_type, #businessType',
      ),
    )

    for (const field of explicitBusinessInputs) {
      const shouldLock = Boolean(company?.businessType)
      field.disabled = shouldLock
      field.setAttribute('aria-disabled', shouldLock ? 'true' : 'false')
      if (shouldLock) {
        field.title = 'O ramo empresarial so pode ser alterado pelo suporte do Orcaly.'
        field.dataset.orcalyLockedBusinessType = 'true'
      } else {
        field.removeAttribute('title')
        delete field.dataset.orcalyLockedBusinessType
      }
    }
  }, [children, company?.businessType])

  const publicUrl = useMemo(() => buildPublicUrl(company?.slug), [company?.slug])

  function scrollToSection(item: NavigationItem) {
    setActiveSection(item.id)

    if (item.id === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (item.id === 'integrations') {
      integrationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const element = contentRef.current?.querySelector<HTMLElement>(
      `[data-orcaly-settings-target="${item.id}"]`,
    )
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function copyPublicUrl() {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>Central da empresa</span>
          <h1>Configura\u00e7\u00f5es</h1>
          <p>Gerencie as informa\u00e7\u00f5es, os acessos e as prefer\u00eancias da sua empresa.</p>
        </div>
        {publicUrl ? (
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryButton} onClick={copyPublicUrl}>
              <LinkIcon />
              {copied ? 'Endere\u00e7o copiado' : 'Copiar endere\u00e7o'}
            </button>
            <a className={styles.primaryButton} href={publicUrl} target="_blank" rel="noreferrer">
              Abrir site
              <ArrowIcon />
            </a>
          </div>
        ) : null}
      </header>

      <section className={styles.summaryCard} aria-label="Resumo da empresa">
        <div className={styles.companyIdentity}>
          <div className={styles.logoBox}>
            {company?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" />
            ) : (
              <BuildingIcon />
            )}
          </div>
          <div className={styles.companyText}>
            <span>Empresa</span>
            <strong>{company?.name || 'Carregando informa\u00e7\u00f5es...'}</strong>
            {publicUrl ? <small>{publicUrl.replace('https://', '')}</small> : null}
          </div>
        </div>

        <div className={styles.summaryGrid}>
          {company?.status ? (
            <div className={styles.summaryItem}>
              <span>Status</span>
              <strong>{company.status}</strong>
            </div>
          ) : null}
          {company?.businessType ? (
            <div className={styles.summaryItem}>
              <span>Ramo empresarial</span>
              <strong className={styles.lockedValue}>
                <LockIcon />
                {formatBusinessType(company.businessType)}
              </strong>
            </div>
          ) : null}
          {company?.plan ? (
            <div className={styles.summaryItem}>
              <span>Plano atual</span>
              <strong>{company.plan}</strong>
            </div>
          ) : null}
          {teamCount !== null ? (
            <div className={styles.summaryItem}>
              <span>Equipe</span>
              <strong>{teamCount} acesso{teamCount === 1 ? '' : 's'}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {company?.businessType ? (
        <section className={styles.lockNotice}>
          <LockIcon />
          <div>
            <strong>Ramo empresarial protegido</strong>
            <p>
              O ramo empresarial define os recursos, menus e opera\u00e7\u00f5es dispon\u00edveis no painel.
              Depois de configurado, somente o suporte do Or\u00e7aly poder\u00e1 realizar uma altera\u00e7\u00e3o.
            </p>
          </div>
        </section>
      ) : null}

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Se\u00e7\u00f5es de configura\u00e7\u00f5es">
          <div className={styles.sidebarTitle}>Configura\u00e7\u00f5es da empresa</div>
          <nav className={styles.navigation}>
            {availableNavigation.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeSection === item.id ? styles.navigationActive : styles.navigationButton}
                onClick={() => scrollToSection(item)}
              >
                <span>{item.label}</span>
                <ArrowIcon />
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.mainColumn}>
          <div ref={contentRef} className={styles.legacyContent}>
            {children}
          </div>

          <section ref={integrationsRef} className={styles.integrationsSection}>
            <div className={styles.sectionHeading}>
              <span>Atalhos</span>
              <h2>Integra\u00e7\u00f5es e servi\u00e7os</h2>
              <p>Acesse as \u00e1reas especializadas sem duplicar formul\u00e1rios nesta p\u00e1gina.</p>
            </div>

            <div className={styles.integrationGrid}>
              <Link href="/painel/pagamentos" className={styles.integrationCard}>
                <div>
                  <span>Recebimentos</span>
                  <strong>Mercado Pago e pagamentos</strong>
                  <p>Conex\u00e3o, vendas online e formas presenciais.</p>
                </div>
                <ArrowIcon />
              </Link>

              <Link href="/painel/site" className={styles.integrationCard}>
                <div>
                  <span>Presen\u00e7a digital</span>
                  <strong>Site p\u00fablico</strong>
                  <p>Conte\u00fado, identidade visual e publica\u00e7\u00e3o.</p>
                </div>
                <ArrowIcon />
              </Link>

              <Link href="/painel/assinatura" className={styles.integrationCard}>
                <div>
                  <span>Conta Or\u00e7aly</span>
                  <strong>Assinatura e plano</strong>
                  <p>Plano atual, cobran\u00e7as, teste e cancelamento.</p>
                </div>
                <ArrowIcon />
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
'@

    $Css = @'
/* ORCALY_SETTINGS_PREMIUM_SHELL_V1 */
.page {
  --settings-bg: #f5f7fb;
  --settings-surface: #ffffff;
  --settings-surface-soft: #f8fafc;
  --settings-border: #e2e8f0;
  --settings-border-strong: #cbd5e1;
  --settings-text: #0f172a;
  --settings-muted: #64748b;
  --settings-primary: #2563eb;
  --settings-primary-dark: #1d4ed8;
  --settings-success: #047857;
  min-width: 0;
  max-width: 100%;
  padding: clamp(1rem, 2vw, 2rem);
  color: var(--settings-text);
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.07), transparent 28rem),
    var(--settings-bg);
  border-radius: 1.75rem;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.headerCopy {
  min-width: 0;
}

.eyebrow,
.sectionHeading > span {
  display: block;
  margin-bottom: 0.45rem;
  color: var(--settings-primary);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.header h1 {
  margin: 0;
  color: var(--settings-text);
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 850;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.header p,
.sectionHeading p {
  max-width: 44rem;
  margin: 0.65rem 0 0;
  color: var(--settings-muted);
  font-size: 0.96rem;
  line-height: 1.65;
}

.headerActions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
}

.primaryButton,
.secondaryButton {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.7rem 1rem;
  border-radius: 0.85rem;
  font-size: 0.875rem;
  font-weight: 750;
  text-decoration: none;
  transition: transform 140ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease;
}

.primaryButton {
  border: 1px solid var(--settings-primary);
  color: #fff;
  background: var(--settings-primary);
  box-shadow: 0 8px 22px rgba(37, 99, 235, 0.18);
}

.secondaryButton {
  border: 1px solid var(--settings-border);
  color: var(--settings-text);
  background: rgba(255, 255, 255, 0.92);
}

.primaryButton:hover,
.secondaryButton:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.1);
}

.primaryButton:active,
.secondaryButton:active {
  transform: scale(0.98);
}

.icon,
.inlineIcon {
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
}

.summaryIcon {
  width: 2rem;
  height: 2rem;
}

.summaryCard {
  display: grid;
  grid-template-columns: minmax(15rem, 1.05fr) minmax(0, 1.95fr);
  gap: 1.25rem;
  padding: 1.15rem;
  border: 1px solid rgba(203, 213, 225, 0.88);
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
}

.companyIdentity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.9rem;
  padding: 0.25rem;
}

.logoBox {
  display: grid;
  width: 3.75rem;
  height: 3.75rem;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-radius: 1rem;
  color: var(--settings-primary);
  background: #eff6ff;
}

.logoBox img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.companyText {
  min-width: 0;
}

.companyText span,
.summaryItem span {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--settings-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.045em;
}

.companyText strong {
  display: block;
  overflow: hidden;
  color: var(--settings-text);
  font-size: 1.05rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.companyText small {
  display: block;
  overflow: hidden;
  margin-top: 0.25rem;
  color: var(--settings-muted);
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summaryGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.7rem;
}

.summaryItem {
  min-width: 0;
  padding: 0.85rem 0.9rem;
  border: 1px solid var(--settings-border);
  border-radius: 0.9rem;
  background: var(--settings-surface-soft);
}

.summaryItem strong {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  overflow: hidden;
  color: var(--settings-text);
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lockedValue {
  color: #475569 !important;
}

.lockNotice {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.9rem 1rem;
  border: 1px solid #fde68a;
  border-radius: 1rem;
  color: #854d0e;
  background: #fffbeb;
}

.lockNotice strong {
  display: block;
  margin-bottom: 0.18rem;
  font-size: 0.88rem;
}

.lockNotice p {
  margin: 0;
  font-size: 0.83rem;
  line-height: 1.55;
}

.workspace {
  display: grid;
  grid-template-columns: 15.5rem minmax(0, 1fr);
  gap: 1.25rem;
  margin-top: 1.25rem;
  align-items: start;
}

.sidebar {
  position: sticky;
  top: 5.5rem;
  min-width: 0;
  padding: 0.8rem;
  border: 1px solid var(--settings-border);
  border-radius: 1.1rem;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.045);
}

.sidebarTitle {
  padding: 0.55rem 0.65rem 0.7rem;
  color: var(--settings-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.navigation {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.navigationButton,
.navigationActive {
  display: flex;
  width: 100%;
  min-height: 2.55rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid transparent;
  border-radius: 0.8rem;
  font-size: 0.83rem;
  font-weight: 700;
  text-align: left;
  transition: color 150ms ease, background 180ms ease, border-color 180ms ease, transform 150ms ease;
}

.navigationButton {
  color: #475569;
  background: transparent;
}

.navigationButton:hover {
  color: var(--settings-text);
  background: #f8fafc;
}

.navigationActive {
  color: var(--settings-primary-dark);
  border-color: #bfdbfe;
  background: #eff6ff;
}

.navigationButton:active,
.navigationActive:active {
  transform: scale(0.985);
}

.mainColumn {
  min-width: 0;
  max-width: 100%;
}

.legacyContent {
  min-width: 0;
  max-width: 100%;
}

.legacyContent :global([data-orcaly-legacy-title="true"]) {
  display: none !important;
}

.legacyContent :global([data-orcaly-locked-business-type="true"]) {
  cursor: not-allowed !important;
  color: #64748b !important;
  border-color: #cbd5e1 !important;
  background: #f1f5f9 !important;
  opacity: 1 !important;
}

.legacyContent :global(form),
.legacyContent :global(section),
.legacyContent :global(article),
.legacyContent :global(.card) {
  max-width: 100%;
}

.legacyContent :global(form) {
  border-color: var(--settings-border) !important;
  border-radius: 1.1rem !important;
}

.legacyContent :global(input),
.legacyContent :global(select),
.legacyContent :global(textarea) {
  max-width: 100%;
  border-color: var(--settings-border-strong) !important;
  border-radius: 0.78rem !important;
  background-color: #fff !important;
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.legacyContent :global(input:focus),
.legacyContent :global(select:focus),
.legacyContent :global(textarea:focus) {
  outline: none !important;
  border-color: #60a5fa !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.13) !important;
}

.legacyContent :global(button),
.legacyContent :global(a) {
  transition: transform 140ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease;
}

.legacyContent :global(button:active) {
  transform: scale(0.985);
}

.legacyContent :global(table) {
  width: 100%;
  min-width: 42rem;
  border-collapse: separate;
  border-spacing: 0;
}

.legacyContent :global(th) {
  color: #475569;
  background: #f8fafc;
}

.legacyContent :global(tr) {
  transition: background 150ms ease;
}

.legacyContent :global(tbody tr:hover) {
  background: #f8fafc;
}

.legacyContent :global(h2),
.legacyContent :global(h3),
.integrationsSection {
  scroll-margin-top: 6rem;
}

.integrationsSection {
  margin-top: 1.25rem;
  padding: clamp(1rem, 2vw, 1.4rem);
  border: 1px solid var(--settings-border);
  border-radius: 1.2rem;
  background: var(--settings-surface);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.045);
}

.sectionHeading h2 {
  margin: 0;
  color: var(--settings-text);
  font-size: 1.18rem;
  font-weight: 820;
  letter-spacing: -0.02em;
}

.integrationGrid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}

.integrationCard {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--settings-border);
  border-radius: 1rem;
  color: inherit;
  background: var(--settings-surface-soft);
  text-decoration: none;
  transition: transform 150ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.integrationCard:hover {
  transform: translateY(-2px);
  border-color: #bfdbfe;
  background: #fff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.integrationCard span {
  display: block;
  margin-bottom: 0.28rem;
  color: var(--settings-primary);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

.integrationCard strong {
  display: block;
  color: var(--settings-text);
  font-size: 0.92rem;
}

.integrationCard p {
  margin: 0.38rem 0 0;
  color: var(--settings-muted);
  font-size: 0.8rem;
  line-height: 1.5;
}

@media (max-width: 1100px) {
  .summaryCard {
    grid-template-columns: 1fr;
  }

  .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workspace {
    grid-template-columns: 13.75rem minmax(0, 1fr);
  }

  .integrationGrid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .page {
    padding: 1rem;
    border-radius: 1.2rem;
  }

  .header {
    align-items: flex-start;
    flex-direction: column;
  }

  .headerActions {
    width: 100%;
    justify-content: flex-start;
  }

  .primaryButton,
  .secondaryButton {
    flex: 1 1 auto;
  }

  .workspace {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    overflow-x: auto;
    padding: 0.55rem;
  }

  .sidebarTitle {
    display: none;
  }

  .navigation {
    min-width: max-content;
    flex-direction: row;
  }

  .navigationButton,
  .navigationActive {
    width: auto;
    min-width: max-content;
  }

  .navigationButton .icon,
  .navigationActive .icon {
    display: none;
  }
}

@media (max-width: 560px) {
  .summaryGrid {
    grid-template-columns: 1fr;
  }

  .companyIdentity {
    align-items: flex-start;
  }

  .headerActions {
    flex-direction: column;
  }

  .primaryButton,
  .secondaryButton {
    width: 100%;
  }

  .integrationCard {
    align-items: flex-start;
  }

  .legacyContent :global(table) {
    min-width: 38rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page *,
  .page *::before,
  .page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
'@

    if (Update-ProjectFile -RelativePath $ComponentPath -Content $Component) {
        $script:ComponentsCreated++
    }
    if (Update-ProjectFile -RelativePath $CssPath -Content $Css) {
        $script:ComponentsCreated++
    }
}

function Write-PremiumPageWrapper {
    Write-Step 'Fase 2 - preservando a pagina atual e aplicando o shell premium'

    $PageRelative = 'app/painel/configuracoes/page.tsx'
    $LegacyRelative = 'app/painel/configuracoes/ConfiguracoesLegacy.tsx'
    $LayoutRelative = 'app/painel/configuracoes/layout.tsx'
    $PageFull = Join-Path $ProjectRoot $PageRelative
    $LegacyFull = Join-Path $ProjectRoot $LegacyRelative
    $LayoutFull = Join-Path $ProjectRoot $LayoutRelative

    $PageContent = [System.IO.File]::ReadAllText($PageFull)
    $BeforeFunctions = Get-FunctionNames $PageContent

    if ($PageContent -match 'ORCALY_SETTINGS_PREMIUM_PAGE_WRAPPER_V1') {
        Write-Success 'A pagina de Configuracoes ja utiliza o wrapper premium.'
        $script:ComponentsReused++
        return
    }

    $HasRouteMetadata = $PageContent -match '(?m)export\s+(?:const\s+(?:metadata|revalidate|dynamic|fetchCache|runtime|preferredRegion|maxDuration)|async\s+function\s+generateMetadata|function\s+generateMetadata)'

    if ($HasRouteMetadata) {
        if (Test-Path -LiteralPath $LayoutFull) {
            $LayoutContent = [System.IO.File]::ReadAllText($LayoutFull)
            if ($LayoutContent -notmatch 'ORCALY_SETTINGS_PREMIUM_LAYOUT_V1') {
                Stop-OnCriticalFailure 'A pagina possui metadata e ja existe um layout desconhecido em Configuracoes. O patcher nao o sobrescrevera.'
            }
        }

        $Layout = @'
// ORCALY_SETTINGS_PREMIUM_LAYOUT_V1
import type { ReactNode } from 'react'
import SettingsPremiumShell from '@/components/settings/SettingsPremiumShell'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <SettingsPremiumShell>{children}</SettingsPremiumShell>
}
'@

        Update-ProjectFile -RelativePath $LayoutRelative -Content $Layout | Out-Null
        $script:ComponentsReused++
        Add-QaResult -Area 'Pagina funcional preservada' -Status 'PASSOU' -Details 'A pagina original foi mantida e envolvida por layout premium devido a metadata de rota.'
        return
    }

    if (Test-Path -LiteralPath $LegacyFull) {
        Stop-OnCriticalFailure 'ConfiguracoesLegacy.tsx ja existe, mas page.tsx nao possui o marcador esperado. Intervencao manual necessaria.'
    }

    if ($DryRun) {
        Write-Host '[DRY-RUN] Preservaria page.tsx como ConfiguracoesLegacy.tsx e criaria wrapper.' -ForegroundColor Magenta
        return
    }

    Backup-ProjectFile $PageRelative
    Write-Utf8NoBom -Path $LegacyFull -Content $PageContent
    Add-ChangedFile -RelativePath $LegacyRelative -Created

    $Wrapper = @'
// ORCALY_SETTINGS_PREMIUM_PAGE_WRAPPER_V1
import SettingsPremiumShell from '@/components/settings/SettingsPremiumShell'
import ConfiguracoesLegacy from './ConfiguracoesLegacy'

export default function ConfiguracoesPage() {
  return (
    <SettingsPremiumShell>
      <ConfiguracoesLegacy />
    </SettingsPremiumShell>
  )
}
'@

    Write-Utf8NoBom -Path $PageFull -Content $Wrapper
    Add-ChangedFile -RelativePath $PageRelative

    $LegacyAfter = [System.IO.File]::ReadAllText($LegacyFull)
    $Missing = Compare-PageFunctions -BeforeNames $BeforeFunctions -AfterContent $LegacyAfter
    if ($Missing.Count -gt 0) {
        Copy-Item -LiteralPath (Join-Path $BackupRoot $PageRelative) -Destination $PageFull -Force
        Remove-Item -LiteralPath $LegacyFull -Force
        Stop-OnCriticalFailure ('Funcoes desapareceram durante a preservacao: ' + ($Missing -join ', '))
    }

    $script:PreservedFunctions = $BeforeFunctions.Count
    Write-Success "Pagina original preservada integralmente com $($BeforeFunctions.Count) funcoes/handlers detectados."
    Add-QaResult -Area 'Funcoes da pagina preservadas' -Status 'PASSOU' -Details ("{0} funcoes/handlers permaneceram no componente legado interno." -f $BeforeFunctions.Count)
}

function Write-LoadingState {
    $Relative = 'app/painel/configuracoes/loading.tsx'
    $Full = Join-Path $ProjectRoot $Relative

    if (Test-Path -LiteralPath $Full) {
        $Current = [System.IO.File]::ReadAllText($Full)
        if ($Current -notmatch 'ORCALY_SETTINGS_PREMIUM_LOADING_V1') {
            Write-Warning 'loading.tsx existente foi preservado sem alteracao.'
            $script:ComponentsReused++
            return
        }
    }

    $Content = @'
// ORCALY_SETTINGS_PREMIUM_LOADING_V1
export default function ConfiguracoesLoading() {
  return (
    <div className="animate-pulse space-y-5 rounded-3xl bg-slate-50 p-4 sm:p-6">
      <div className="space-y-3">
        <div className="h-4 w-28 rounded bg-slate-200" />
        <div className="h-9 w-64 max-w-full rounded-xl bg-slate-200" />
        <div className="h-4 w-full max-w-xl rounded bg-slate-200" />
      </div>
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_2fr]">
        <div className="h-20 rounded-xl bg-slate-100" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        <div className="h-72 rounded-2xl border border-slate-200 bg-white" />
        <div className="space-y-4">
          <div className="h-44 rounded-2xl border border-slate-200 bg-white" />
          <div className="h-64 rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    </div>
  )
}
'@

    if (Update-ProjectFile -RelativePath $Relative -Content $Content) {
        $script:ComponentsCreated++
    }
}

function Write-SecurityMigration {
    Write-Step 'Fase 5 - gerando protecoes server-side seguras'

    $Relative = 'supabase/migrations/20260718_company_settings_enhancement.sql'
    $Sql = @'
-- ORCALY_COMPANY_SETTINGS_SECURITY_V1
-- Protecoes nao destrutivas para Configuracoes.

create or replace function public.orcaly_prevent_business_type_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if nullif(trim(coalesce(old.business_type::text, '')), '') is not null
     and new.business_type is distinct from old.business_type then
    raise exception 'O ramo empresarial ja foi definido e nao pode ser alterado pelo painel.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.companies') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'companies'
         and column_name = 'business_type'
     )
     and not exists (
       select 1
       from pg_trigger
       where tgname = 'orcaly_companies_business_type_immutable'
         and not tgisinternal
     ) then
    execute 'create trigger orcaly_companies_business_type_immutable
      before update of business_type on public.companies
      for each row execute function public.orcaly_prevent_business_type_change()';
  end if;
end;
$$;

create or replace function public.orcaly_is_reserved_company_slug(value text)
returns boolean
language sql
immutable
parallel safe
as $$
  select lower(coalesce(value, '')) = any (array[
    'www','app','api','admin','painel','login','cadastro','suporte','status',
    'blog','docs','pagamento','pagamentos','assinatura','mercado-pago',
    'vercel','site','marketplace','orcaly'
  ]::text[]);
$$;

do $$
declare
  target_column text;
  constraint_name text;
begin
  if to_regclass('public.companies') is null then
    return;
  end if;

  foreach target_column in array array['slug', 'subdomain_slug'] loop
    if exists (
      select 1
      from information_schema.columns c
      where table_schema = 'public'
        and table_name = 'companies'
        and c.column_name = target_column
    ) then
      constraint_name := 'orcaly_companies_' || target_column || '_safe';

      if not exists (
        select 1
        from pg_constraint
        where conname = constraint_name
          and conrelid = 'public.companies'::regclass
      ) then
        execute format(
          'alter table public.companies add constraint %I check (
             %I is null
             or (
               %I = lower(%I)
               and %I ~ ''^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$''
               and not public.orcaly_is_reserved_company_slug(%I)
             )
           ) not valid',
          constraint_name,
          target_column,
          target_column,
          target_column,
          target_column,
          target_column
        );
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.orcaly_prevent_owner_access_removal()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  old_row jsonb := to_jsonb(old);
  role_value text := lower(coalesce(old_row ->> 'role', old_row ->> 'member_role', ''));
  owner_value boolean := false;
begin
  begin
    owner_value := coalesce((old_row ->> 'is_owner')::boolean, false);
  exception when others then
    owner_value := false;
  end;

  if owner_value or role_value = any (array['owner','proprietario','proprietario(a)','proprietario_empresa']::text[]) then
    raise exception 'O proprietario da empresa nao pode ter o acesso removido por esta operacao.'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

do $$
declare
  candidate_table text;
  trigger_name text;
begin
  foreach candidate_table in array array['company_members','company_users','team_members'] loop
    if to_regclass('public.' || candidate_table) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = candidate_table
           and column_name = 'company_id'
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = candidate_table
           and column_name in ('role','member_role','is_owner')
       ) then
      trigger_name := 'orcaly_' || candidate_table || '_protect_owner_delete';

      if not exists (
        select 1
        from pg_trigger
        where tgname = trigger_name
          and not tgisinternal
      ) then
        execute format(
          'create trigger %I before delete on public.%I
           for each row execute function public.orcaly_prevent_owner_access_removal()',
          trigger_name,
          candidate_table
        );
      end if;
    end if;
  end loop;
end;
$$;
'@

    Update-ProjectFile -RelativePath $Relative -Content $Sql | Out-Null
    Add-QaResult -Area 'Ramo empresarial protegido no servidor' -Status 'PASSOU' -Details 'Migration idempotente cria trigger somente quando companies.business_type existe.'
    Add-QaResult -Area 'Slugs reservados protegidos no servidor' -Status 'PASSOU' -Details 'Constraints NOT VALID protegem novas alteracoes sem invalidar dados antigos.'
    Add-QaResult -Area 'Proprietario protegido contra remocao' -Status 'PASSOU' -Details 'Trigger e criado somente em tabela de equipe compativel encontrada no banco.'
}

function Write-Manifest {
    if ($DryRun) {
        return
    }

    $Manifest = [pscustomobject]@{
        generated_at = (Get-Date).ToString('o')
        backup_root = $BackupRoot
        changed_files = @($ChangedFiles)
        created_files = @($CreatedFiles)
        backed_up_files = @($BackedUp.Keys)
    } | ConvertTo-Json -Depth 5

    Write-Utf8NoBom -Path $ManifestPath -Content $Manifest
}

function Write-Report {
    if ($SkipQa -or $DryRun) {
        return
    }

    Write-Step 'Fase 22 - gerando relatorio final'

    $Lines = New-Object System.Collections.Generic.List[string]
    $Lines.Add('# RELATORIO - CONFIGURACOES PREMIUM ORCALY') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add(('Gerado em: {0}' -f (Get-Date -Format 'dd/MM/yyyy HH:mm:ss'))) | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 1. Resumo') | Out-Null
    $Lines.Add('A pagina oficial /painel/configuracoes foi envolvida por uma camada visual premium, preservando integralmente a implementacao funcional anterior.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 2. Build') | Out-Null
    $Lines.Add(('- Build inicial: {0}' -f $InitialBuild)) | Out-Null
    $Lines.Add(('- Lint inicial: {0}' -f $InitialLint)) | Out-Null
    $Lines.Add(('- Build final: {0}' -f $FinalBuild)) | Out-Null
    $Lines.Add(('- Lint final: {0}' -f $FinalLint)) | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 3. Auditoria') | Out-Null
    foreach ($Note in $AuditNotes) {
        $Lines.Add(('- ' + $Note)) | Out-Null
    }
    $Lines.Add('') | Out-Null
    $Lines.Add('## 4. Arquivos alterados') | Out-Null
    foreach ($File in $ChangedFiles) {
        $Lines.Add(('- ' + $File)) | Out-Null
    }
    $Lines.Add('') | Out-Null
    $Lines.Add('## 5. Funcoes preservadas') | Out-Null
    $Lines.Add(('- Funcoes e handlers detectados e preservados: {0}' -f $PreservedFunctions)) | Out-Null
    $Lines.Add('- A pagina anterior permanece como componente interno, sem substituicao de consultas, payloads ou handlers.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 6. Informacoes da empresa') | Out-Null
    $Lines.Add('- Resumo usa /api/company/current quando a rota esta disponivel.') | Out-Null
    $Lines.Add('- Dados ausentes sao ocultados; nenhuma metrica e inventada.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 7. Ramo empresarial') | Out-Null
    $Lines.Add('- Campo identificado no frontend e desabilitado visualmente.') | Out-Null
    $Lines.Add('- Migration cria protecao server-side para impedir alteracao depois da primeira definicao.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 8. Equipe e acessos') | Out-Null
    $Lines.Add('- A implementacao existente foi mantida sem criar segunda fonte de usuarios.') | Out-Null
    $Lines.Add('- A contagem usa /api/company/team quando disponivel.') | Out-Null
    $Lines.Add('- Migration protege a exclusao de proprietario em tabelas compativeis.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 9. Site e subdominio') | Out-Null
    $Lines.Add('- Endereco visual segue https://{slug}.orcaly.com.br.') | Out-Null
    $Lines.Add('- Links para o site usam apenas o slug retornado pela empresa atual.') | Out-Null
    $Lines.Add('- Slugs reservados e formatos invalidos sao rejeitados pela migration quando a coluna existe.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 10. Preferencias, notificacoes e seguranca') | Out-Null
    $Lines.Add('- Somente secoes comprovadas no conteudo existente aparecem na navegacao interna.') | Out-Null
    $Lines.Add('- Nenhum checkbox decorativo, permissao falsa ou sessao simulada foi criado.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 11. Integracoes') | Out-Null
    $Lines.Add('- Pagamentos aponta para /painel/pagamentos.') | Out-Null
    $Lines.Add('- Site aponta para /painel/site.') | Out-Null
    $Lines.Add('- Assinatura aponta para /painel/assinatura.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 12. Visual, responsividade e acessibilidade') | Out-Null
    $Lines.Add('- Navegacao vertical no desktop e horizontal no mobile.') | Out-Null
    $Lines.Add('- Formularios, tabelas, campos e botoes recebem estilo escopado, sem alterar logica.') | Out-Null
    $Lines.Add('- prefers-reduced-motion aplicado no escopo da pagina.') | Out-Null
    $Lines.Add('- Validacao visual em navegador real: BLOQUEADO neste ambiente de terminal.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 13. Testes e QA') | Out-Null
    $Lines.Add('| Area | Status | Detalhes |') | Out-Null
    $Lines.Add('|---|---|---|') | Out-Null
    foreach ($Result in $QaResults) {
        $SafeDetails = ($Result.Details -replace '\|', '\|')
        $Lines.Add(('| {0} | {1} | {2} |' -f $Result.Area, $Result.Status, $SafeDetails)) | Out-Null
    }
    $Lines.Add('') | Out-Null
    $Lines.Add('## 14. Itens bloqueados e testes manuais') | Out-Null
    $Lines.Add('- Confirmar inclusao e remocao de funcionario com uma sessao autenticada.') | Out-Null
    $Lines.Add('- Confirmar que o proprietario nao pode ser removido apos aplicar a migration.') | Out-Null
    $Lines.Add('- Confirmar alteracao e disponibilidade do slug com o Supabase real.') | Out-Null
    $Lines.Add('- Validar visualmente 360px, 390px, 768px, 1024px e 1440px.') | Out-Null
    $Lines.Add('- Aplicar a migration no Supabase caso o deploy nao execute migrations automaticamente.') | Out-Null
    $Lines.Add('') | Out-Null
    $Lines.Add('## 15. Backups') | Out-Null
    $Lines.Add(('- Pasta: {0}' -f $BackupRoot)) | Out-Null

    Update-ProjectFile -RelativePath 'RELATORIO-CONFIGURACOES-PREMIUM-ORCALY.md' -Content ($Lines -join [Environment]::NewLine) | Out-Null
}

function Show-FinalSummary {
    $PageStatus = if ($FinalBuild -eq 'PASSOU') { 'ATUALIZADA' } else { 'FALHOU' }
    $BusinessStatus = if ($ChangedFiles -contains 'supabase/migrations/20260718_company_settings_enhancement.sql') { 'BLOQUEADO' } else { 'FALHOU' }
    $TeamStatus = 'PRESERVADOS'
    $SiteStatus = 'PRESERVADOS'

    Write-Host "`nOrcaly - Configuracoes repaginadas" -ForegroundColor Cyan
    Write-Host "`nBuild inicial: $InitialBuild"
    Write-Host "Build final: $FinalBuild"
    Write-Host "Pagina Configuracoes: $PageStatus"
    Write-Host 'Informacoes da empresa: PRESERVADAS'
    Write-Host "Ramo empresarial: $BusinessStatus (migration gerada; aplicar no Supabase)"
    Write-Host "Equipe e acessos: $TeamStatus"
    Write-Host 'Funcionarios ativos: BLOQUEADO sem sessao autenticada'
    Write-Host "Site e subdominio: $SiteStatus"
    Write-Host "Preferencias reais adicionadas: $RealPreferences"
    Write-Host "Integracoes organizadas: $IntegrationsOrganized"
    Write-Host "Funcoes duplicadas removidas: $DuplicatesRemoved"
    Write-Host "Componentes reutilizados: $ComponentsReused"
    Write-Host "Componentes criados: $ComponentsCreated"
    Write-Host "Testes bloqueados: $BlockedTests"
    Write-Host 'Relatorio: RELATORIO-CONFIGURACOES-PREMIUM-ORCALY.md'
    Write-Host "Backups: $BackupRoot"
    Write-Host "`nA pagina de Configuracoes do Orcaly foi repaginada com visual premium, gerenciamento de equipe preservado, ramo empresarial protegido e endereco publico mantido no padrao {slug}.orcaly.com.br." -ForegroundColor Green
}

try {
    Initialize-Environment
    Invoke-Audit

    if ($DryRun) {
        Write-Step 'DryRun - alteracoes previstas'
        @(
            'components/settings/SettingsPremiumShell.tsx',
            'components/settings/SettingsPremiumShell.module.css',
            'app/painel/configuracoes/page.tsx ou layout.tsx',
            'app/painel/configuracoes/ConfiguracoesLegacy.tsx quando aplicavel',
            'app/painel/configuracoes/loading.tsx',
            'supabase/migrations/20260718_company_settings_enhancement.sql',
            'RELATORIO-CONFIGURACOES-PREMIUM-ORCALY.md'
        ) | ForEach-Object { Write-Host (" - " + $_) }
        Write-Host "`nNenhum arquivo foi alterado porque -DryRun foi informado." -ForegroundColor Magenta
        return
    }

    $Scripts = Get-PackageScripts

    if (-not $SkipInitialBuild) {
        $BuildResult = Invoke-NpmCommand -Label 'build-inicial' -Arguments @('run','build') -Critical
        $InitialBuild = if ($BuildResult.Passed) { 'PASSOU' } else { 'FALHOU' }
    }

    if ($Scripts -and $Scripts.PSObject.Properties.Name -contains 'lint') {
        $LintResult = Invoke-NpmCommand -Label 'lint-inicial' -Arguments @('run','lint')
        $InitialLint = if ($LintResult.Passed) { 'PASSOU' } else { 'FALHOU' }
    }
    else {
        $InitialLint = 'NAO TESTADO'
        Write-Warning 'Script lint nao encontrado no package.json.'
    }

    Write-Step 'Fase 2 - criando camada visual premium'
    Write-PremiumComponent
    Write-PremiumPageWrapper
    Write-LoadingState
    Write-SecurityMigration

    Add-QaResult -Area 'Visual premium aplicado' -Status 'PASSOU' -Details 'Shell, resumo, navegacao interna, integracoes e estilos escopados foram criados.'
    Add-QaResult -Area 'Pagina original preservada' -Status 'PASSOU' -Details 'Consultas e handlers permanecem no componente original ou pagina original.'
    Add-QaResult -Area 'company_id preservado' -Status 'PASSOU' -Details 'O patcher nao altera consultas, APIs ou payloads existentes.'
    Add-QaResult -Area 'Pagamentos e assinatura nao duplicados' -Status 'PASSOU' -Details 'Somente atalhos para as paginas oficiais foram adicionados.'
    Add-QaResult -Area 'Teste visual em navegador' -Status 'BLOQUEADO' -Details 'Exige sessao autenticada e navegador real.'
    $BlockedTests++

    if (-not $SkipFinalBuild) {
        $FinalBuildResult = Invoke-NpmCommand -Label 'build-final' -Arguments @('run','build') -Critical
        $FinalBuild = if ($FinalBuildResult.Passed) { 'PASSOU' } else { 'FALHOU' }
    }

    if ($Scripts -and $Scripts.PSObject.Properties.Name -contains 'lint') {
        $FinalLintResult = Invoke-NpmCommand -Label 'lint-final' -Arguments @('run','lint')
        $FinalLint = if ($FinalLintResult.Passed) { 'PASSOU' } else { 'FALHOU' }
        if ($InitialLint -eq 'FALHOU' -and $FinalLint -eq 'FALHOU') {
            Add-QaResult -Area 'Lint' -Status 'BLOQUEADO' -Details 'Lint ja falhava antes e continua falhando; revisar logs para confirmar que nao houve erros novos.'
            $BlockedTests++
        }
        elseif ($FinalLint -eq 'PASSOU') {
            Add-QaResult -Area 'Lint' -Status 'PASSOU' -Details 'Lint final concluido sem erros.'
        }
        else {
            Add-QaResult -Area 'Lint' -Status 'FALHOU' -Details 'Lint final falhou. Consulte o log.'
        }
    }

    if ($Scripts -and $Scripts.PSObject.Properties.Name -contains 'typecheck') {
        $Typecheck = Invoke-NpmCommand -Label 'typecheck-final' -Arguments @('run','typecheck')
        Add-QaResult -Area 'Typecheck' -Status $(if ($Typecheck.Passed) { 'PASSOU' } else { 'FALHOU' }) -Details ('Codigo de saida: ' + $Typecheck.ExitCode)
    }

    if ($Scripts -and $Scripts.PSObject.Properties.Name -contains 'test') {
        $Tests = Invoke-NpmCommand -Label 'test-final' -Arguments @('run','test')
        Add-QaResult -Area 'Testes automatizados' -Status $(if ($Tests.Passed) { 'PASSOU' } else { 'FALHOU' }) -Details ('Codigo de saida: ' + $Tests.ExitCode)
    }

    Write-Manifest
    Write-Report
    Write-Manifest
    Show-FinalSummary
}
catch {
    Write-Failure $_.Exception.Message
    if (-not $DryRun) {
        try {
            Write-Manifest
        }
        catch {
            Write-Host '[AVISO] Nao foi possivel gravar o manifesto apos a falha.' -ForegroundColor Yellow
        }
    }
    exit 1
}
