$ErrorActionPreference = "Stop"

$project = "C:\Users\arauj\grafica-flash"
$file = Join-Path $project "lib\panel-modules.ts"

if (!(Test-Path -LiteralPath $file)) {
  Write-Host "Arquivo nao encontrado: $file" -ForegroundColor Red
  exit 1
}

$backup = $file + ".backup-compat-exports-" + (Get-Date -Format "yyyyMMddHHmmss")
Copy-Item -LiteralPath $file -Destination $backup -Force
Write-Host "Backup criado: $backup" -ForegroundColor DarkYellow

$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$original = $content

# Compatibilidade com componentes antigos do painel.
# O PanelSidebar atual importa nomes antigos:
# - getPanelModulesForBusinessType
# - panelGroupLabels
# - PanelModuleGroup
# O lib novo tinha getModulesForBusinessType, mas não exportava os aliases antigos.
# Então corrigimos no ponto certo: lib/panel-modules.ts.
$append = @"

//
// Compatibilidade com componentes existentes do painel
// Mantém o visual aprovado sem obrigar troca da sidebar.
//

"@

if ($content -notmatch "export\s+type\s+PanelModuleGroup") {
  if ($content -match "export\s+type\s+ModuleGroup") {
    $append += @"
export type PanelModuleGroup = ModuleGroup

"@
  } else {
    $append += @"
export type PanelModuleGroup =
  | 'principal'
  | 'comercial'
  | 'operacao'
  | 'financeiro'
  | 'presenca_digital'
  | 'sistema'
  | 'administracao'
  | 'relatorios'

"@
  }
}

if ($content -notmatch "export\s+const\s+panelGroupLabels") {
  if ($content -match "export\s+const\s+moduleGroupLabels") {
    $append += @"
export const panelGroupLabels = moduleGroupLabels as Record<PanelModuleGroup, string>

"@
  } else {
    $append += @"
export const panelGroupLabels: Record<PanelModuleGroup, string> = {
  principal: 'Principal',
  comercial: 'Comercial',
  operacao: 'Operação',
  financeiro: 'Financeiro',
  presenca_digital: 'Presença digital',
  sistema: 'Sistema',
  administracao: 'Administração',
  relatorios: 'Relatórios',
}

"@
  }
}

if ($content -notmatch "export\s+function\s+getPanelModulesForBusinessType") {
  if ($content -match "export\s+function\s+getModulesForBusinessType") {
    $append += @"
export function getPanelModulesForBusinessType(businessType: unknown) {
  return getModulesForBusinessType(businessType)
}

"@
  } elseif ($content -match "export\s+function\s+getModulesForSegment") {
    $append += @"
export function getPanelModulesForBusinessType(businessType: unknown) {
  return getModulesForSegment(businessType)
}

"@
  } else {
    Write-Host "Não encontrei getModulesForBusinessType nem getModulesForSegment em lib/panel-modules.ts" -ForegroundColor Red
    exit 1
  }
}

if ($append.Trim().Length -gt 0) {
  $content = $content.TrimEnd() + "`r`n" + $append
}

if ($content -eq $original) {
  Write-Host "Nenhuma alteração necessária. Os exports já existem." -ForegroundColor Yellow
} else {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
  Write-Host "Exports de compatibilidade adicionados em lib/panel-modules.ts" -ForegroundColor Green
}

Remove-Item -Recurse -Force (Join-Path $project ".next") -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Agora rode: npm run build" -ForegroundColor Yellow
